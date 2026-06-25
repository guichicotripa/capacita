"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha } from "./password";
import { criarSessao, encerrarSessao, getUsuarioAtual } from "./auth";
import { statusDe } from "./status";
import { notificar } from "./email";
import { iaDisponivel, gerarCursoIA } from "./ai";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
    redirect("/login?erro=1");
  }

  await criarSessao(usuario.id);
  redirect(usuario.papel === "admin" ? "/admin" : "/aluno");
}

export async function logout() {
  await encerrarSessao();
  redirect("/login");
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

  await prisma.treinamento.create({
    data: {
      titulo: curso!.titulo,
      descricao: curso!.descricao,
      tipo: "texto",
      corpo: curso!.corpo,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      geradoPorIa: true,
      perguntas: {
        create: curso!.perguntas.map((p, i) => ({
          enunciado: p.enunciado,
          ordem: i,
          alternativas: {
            create: p.alternativas.map((a) => ({ texto: a.texto, correta: a.correta })),
          },
        })),
      },
    },
  });

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
