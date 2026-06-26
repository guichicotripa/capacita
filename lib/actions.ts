"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha } from "./password";
import {
  criarSessao,
  encerrarSessao,
  getUsuarioAtual,
  criarMfaPendente,
  getMfaPendente,
} from "./auth";
import { statusDe } from "./status";
import { notificar } from "./email";
import { iaDisponivel, gerarCursoIA, type CursoGerado } from "./ai";
import { gerarSegredoMfa, verificarCodigoMfa } from "./mfa";
import { extrairTextoPptx } from "./pptx";

// Cria um treinamento + quiz a partir de um curso gerado (helper interno).
async function persistirCurso(curso: CursoGerado, clienteIdRaw: string) {
  return prisma.treinamento.create({
    data: {
      titulo: curso.titulo,
      descricao: curso.descricao,
      tipo: "texto",
      corpo: curso.corpo,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      geradoPorIa: true,
      perguntas: {
        create: curso.perguntas.map((p, i) => ({
          enunciado: p.enunciado,
          ordem: i,
          alternativas: {
            create: p.alternativas.map((a) => ({ texto: a.texto, correta: a.correta })),
          },
        })),
      },
    },
  });
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
    redirect("/login?erro=1");
  }

  // Se o usuário tem 2FA ativo, exige o código antes de abrir a sessão.
  if (usuario!.mfaAtivo) {
    await criarMfaPendente(usuario!.id);
    redirect("/login/mfa");
  }

  await criarSessao(usuario!.id);
  redirect(usuario!.papel === "admin" ? "/admin" : "/aluno");
}

// Passo 2 do login: valida o código TOTP do usuário com MFA pendente.
export async function verificarMfaLogin(formData: FormData) {
  const uid = await getMfaPendente();
  if (!uid) redirect("/login");

  const usuario = await prisma.usuario.findUnique({ where: { id: uid! } });
  if (!usuario || !usuario.mfaSecret) redirect("/login");

  const codigo = String(formData.get("codigo") || "");
  if (!verificarCodigoMfa(codigo, usuario!.mfaSecret!)) {
    redirect("/login/mfa?erro=1");
  }

  await criarSessao(usuario!.id);
  redirect(usuario!.papel === "admin" ? "/admin" : "/aluno");
}

export async function logout() {
  await encerrarSessao();
  redirect("/login");
}

// Inicia a ativação do 2FA: gera e salva o segredo (ainda não exigido no login).
export async function iniciarMfa() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  const segredo = gerarSegredoMfa();
  await prisma.usuario.update({
    where: { id: usuario!.id },
    data: { mfaSecret: segredo, mfaAtivo: false },
  });
  revalidatePath("/conta");
  redirect("/conta");
}

// Confirma o 2FA: valida o primeiro código e passa a exigir no login.
export async function confirmarMfa(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario!.mfaSecret) redirect("/conta");

  const codigo = String(formData.get("codigo") || "");
  if (!verificarCodigoMfa(codigo, usuario!.mfaSecret!)) {
    redirect("/conta?erro=1");
  }
  await prisma.usuario.update({
    where: { id: usuario!.id },
    data: { mfaAtivo: true },
  });
  revalidatePath("/conta");
  redirect("/conta?ok=1");
}

// Desativa o 2FA.
export async function desativarMfa() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  await prisma.usuario.update({
    where: { id: usuario!.id },
    data: { mfaAtivo: false, mfaSecret: null },
  });
  revalidatePath("/conta");
  redirect("/conta");
}

// Aluno marca um treinamento SEM quiz como concluido (sistema de honra).
// So vale se a atribuicao e dele e ainda nao venceu (acesso cortado apos o prazo).
export async function concluir(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const atribuicaoId = Number(formData.get("atribuicaoId"));
  const atrib = await prisma.atribuicao.findUnique({
    where: { id: atribuicaoId },
    include: { treinamento: { include: { _count: { select: { perguntas: true } } } } },
  });

  if (!atrib || atrib.usuarioId !== usuario!.id) {
    redirect("/aluno");
  }
  if (statusDe(atrib!) === "vencido") {
    // Prazo expirado: acesso cortado, nao deixa concluir.
    redirect("/aluno");
  }
  // Se o treinamento tem quiz, a conclusao tem que vir pela avaliacao.
  if (atrib!.treinamento._count.perguntas > 0) {
    redirect(`/aluno/${atribuicaoId}`);
  }

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { concluidoEm: new Date() },
  });

  revalidatePath("/aluno");
  redirect("/aluno");
}

// Aluno submete o quiz. Calcula a nota; se >= notaMinima, conclui; senao,
// registra a nota e libera nova tentativa.
export async function submeterQuiz(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const atribuicaoId = Number(formData.get("atribuicaoId"));
  const atrib = await prisma.atribuicao.findUnique({
    where: { id: atribuicaoId },
    include: {
      usuario: true,
      treinamento: { include: { perguntas: { include: { alternativas: true } } } },
    },
  });

  if (!atrib || atrib.usuarioId !== usuario!.id) redirect("/aluno");
  if (statusDe(atrib!) === "vencido") redirect("/aluno");

  const perguntas = atrib!.treinamento.perguntas;
  if (perguntas.length === 0) redirect(`/aluno/${atribuicaoId}`);

  let acertos = 0;
  for (const p of perguntas) {
    const escolhidaId = Number(formData.get(`p_${p.id}`));
    const correta = p.alternativas.find((a) => a.correta);
    if (correta && correta.id === escolhidaId) acertos++;
  }
  const nota = Math.round((acertos / perguntas.length) * 100);
  const aprovado = nota >= atrib!.treinamento.notaMinima;

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { nota, concluidoEm: aprovado ? new Date() : null },
  });

  await notificar({
    atribuicaoId,
    tipo: aprovado ? "aprovado" : "reprovado",
    mensagem: aprovado
      ? `Você foi aprovado em "${atrib!.treinamento.titulo}" com ${nota}%.`
      : `Você fez ${nota}% em "${atrib!.treinamento.titulo}" (mínimo ${atrib!.treinamento.notaMinima}%). Tente novamente.`,
    emailDestino: atrib!.usuario.email,
    assunto: `Capacita — Resultado: ${atrib!.treinamento.titulo}`,
  });

  revalidatePath("/aluno");
  redirect(`/aluno/${atribuicaoId}?nota=${nota}&aprovado=${aprovado ? 1 : 0}`);
}

// Admin gera um treinamento + quiz por IA a partir de um tema.
export async function gerarTreinamentoIA(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  if (!iaDisponivel()) {
    redirect("/admin/treinamentos?erro=ia");
  }

  const tema = String(formData.get("tema") || "").trim();
  const clienteIdRaw = String(formData.get("clienteId") || "");
  if (!tema) redirect("/admin/treinamentos");

  let curso;
  try {
    curso = await gerarCursoIA(tema);
  } catch (e) {
    console.error("Falha na geração por IA:", e);
    redirect("/admin/treinamentos?erro=ia");
  }

  await persistirCurso(curso!, clienteIdRaw);
  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin sobe um .pptx; extraímos o texto e a IA monta o curso + quiz.
export async function gerarCursoDePPT(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");
  if (!iaDisponivel()) redirect("/admin/treinamentos?erro=ia");

  const arquivo = formData.get("arquivo") as File | null;
  const clienteIdRaw = String(formData.get("clienteId") || "");
  if (!arquivo || arquivo.size === 0) redirect("/admin/treinamentos?erro=ppt");

  let texto: string;
  try {
    const buffer = Buffer.from(await arquivo!.arrayBuffer());
    texto = await extrairTextoPptx(buffer);
  } catch (e) {
    console.error("Falha ao ler o PPT:", e);
    redirect("/admin/treinamentos?erro=ppt");
  }
  if (!texto! || texto!.length < 30) {
    redirect("/admin/treinamentos?erro=ppt");
  }

  let curso;
  try {
    curso = await gerarCursoIA("(a partir da apresentação enviada)", texto!);
  } catch (e) {
    console.error("Falha na geração por IA:", e);
    redirect("/admin/treinamentos?erro=ia");
  }

  await persistirCurso(curso!, clienteIdRaw);
  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin substitui o quiz de um treinamento (apaga as perguntas atuais e cria as novas).
export async function salvarQuiz(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const treinamentoId = Number(formData.get("treinamentoId"));
  const notaMinima = Math.min(100, Math.max(0, Number(formData.get("notaMinima") || 70)));
  const total = Number(formData.get("totalPerguntas") || 0);

  // Reconstrói as perguntas a partir dos campos do form.
  const perguntas: {
    enunciado: string;
    alternativas: { texto: string; correta: boolean }[];
  }[] = [];
  for (let p = 0; p < total; p++) {
    const enunciado = String(formData.get(`p${p}_enunciado`) || "").trim();
    if (!enunciado) continue;
    const corretaIdx = Number(formData.get(`p${p}_correta`));
    const alternativas: { texto: string; correta: boolean }[] = [];
    for (let a = 0; a < 4; a++) {
      const texto = String(formData.get(`p${p}_alt${a}`) || "").trim();
      if (!texto) continue;
      alternativas.push({ texto, correta: a === corretaIdx });
    }
    if (alternativas.length >= 2 && alternativas.some((x) => x.correta)) {
      perguntas.push({ enunciado, alternativas });
    }
  }

  await prisma.$transaction([
    prisma.pergunta.deleteMany({ where: { treinamentoId } }),
    prisma.treinamento.update({
      where: { id: treinamentoId },
      data: {
        notaMinima,
        perguntas: {
          create: perguntas.map((p, i) => ({
            enunciado: p.enunciado,
            ordem: i,
            alternativas: { create: p.alternativas },
          })),
        },
      },
    }),
  ]);

  revalidatePath(`/admin/treinamentos/${treinamentoId}/quiz`);
  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin remove (cancela) um treinamento. A cascata do banco apaga atribuicoes,
// notificacoes e o quiz vinculados.
export async function removerTreinamento(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const treinamentoId = Number(formData.get("treinamentoId"));
  await prisma.treinamento.delete({ where: { id: treinamentoId } });

  revalidatePath("/admin/treinamentos");
  revalidatePath("/admin");
  redirect("/admin/treinamentos");
}

// Admin cria um treinamento.
export async function criarTreinamento(formData: FormData) {
  const tipo = String(formData.get("tipo") || "texto");
  const clienteIdRaw = String(formData.get("clienteId") || "");

  await prisma.treinamento.create({
    data: {
      titulo: String(formData.get("titulo") || "").trim(),
      descricao: String(formData.get("descricao") || "").trim(),
      tipo,
      conteudoUrl: tipo === "video" ? String(formData.get("conteudoUrl") || "") : null,
      corpo: tipo === "texto" ? String(formData.get("corpo") || "") : null,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
    },
  });

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin atribui um treinamento a um aluno com prazo. Gera a notificacao de
// liberacao (o "email" simulado).
export async function atribuir(formData: FormData) {
  const treinamentoId = Number(formData.get("treinamentoId"));
  const usuarioId = Number(formData.get("usuarioId"));
  const prazo = new Date(String(formData.get("prazo")));

  const [treinamento, usuario] = await Promise.all([
    prisma.treinamento.findUnique({ where: { id: treinamentoId } }),
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
  ]);

  const atrib = await prisma.atribuicao.upsert({
    where: { treinamentoId_usuarioId: { treinamentoId, usuarioId } },
    update: { prazo, concluidoEm: null, nota: null },
    create: { treinamentoId, usuarioId, prazo },
  });

  await notificar({
    atribuicaoId: atrib.id,
    tipo: "liberacao",
    mensagem: `Treinamento "${treinamento?.titulo}" liberado. Prazo para concluir: ${prazo.toLocaleDateString("pt-BR")}.`,
    emailDestino: usuario?.email,
    assunto: `Capacita — Novo treinamento: ${treinamento?.titulo}`,
  });

  revalidatePath("/admin");
  redirect("/admin");
}
