"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha, hashSenha } from "./password";
import {
  criarSessao,
  encerrarSessao,
  getUsuarioAtual,
  criarMfaPendente,
  getMfaPendente,
} from "./auth";
import { statusDe } from "./status";
import { notificar, enviarEmail } from "./email";
import { iaDisponivel, gerarCursoIA, type CursoGerado } from "./ai";
import { gerarSegredoMfa, verificarCodigoMfa } from "./mfa";
import { extrairTextoPptx } from "./pptx";

// Cria um treinamento em slides + quiz a partir de um curso gerado (helper interno).
async function persistirCurso(curso: CursoGerado, clienteIdRaw: string) {
  return prisma.treinamento.create({
    data: {
      titulo: curso.titulo,
      descricao: curso.descricao,
      tipo: "slides",
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      geradoPorIa: true,
      slides: {
        create: curso.slides.map((s, i) => ({
          ordem: i,
          titulo: s.titulo,
          conteudo: s.conteudo,
        })),
      },
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

// Admin sobe um PDF ou PPTX para mostrar "como está", página por página.
export async function subirArquivo(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const arquivo = formData.get("arquivo") as File | null;
  const titulo = String(formData.get("titulo") || "").trim();
  const descricao = String(formData.get("descricao") || "").trim();
  const clienteIdRaw = String(formData.get("clienteId") || "");
  if (!arquivo || arquivo.size === 0 || !titulo) {
    redirect("/admin/treinamentos?erro=arquivo");
  }

  const nome = arquivo!.name.toLowerCase();
  const ehPdf = nome.endsWith(".pdf");
  const ehPptx = nome.endsWith(".pptx");
  if (!ehPdf && !ehPptx) redirect("/admin/treinamentos?erro=arquivo");
  const mime = ehPdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const bytes = Buffer.from(await arquivo!.arrayBuffer());

  await prisma.treinamento.create({
    data: {
      titulo,
      descricao: descricao || arquivo!.name,
      tipo: "arquivo",
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      arquivo: {
        create: { mime, nomeOriginal: arquivo!.name, dados: bytes },
      },
    },
  });

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin desatribui um treinamento de um aluno (remove a atribuição).
export async function removerAtribuicao(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const atribuicaoId = Number(formData.get("atribuicaoId"));
  await prisma.atribuicao.delete({ where: { id: atribuicaoId } });

  revalidatePath("/admin");
  redirect("/admin");
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
  // Opção: já registrar como concluído (sem o aluno precisar fazer).
  const jaConcluido = formData.get("jaConcluido") === "on";
  const concluidoEm = jaConcluido ? new Date() : null;

  const [treinamento, usuario] = await Promise.all([
    prisma.treinamento.findUnique({ where: { id: treinamentoId } }),
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
  ]);

  const atrib = await prisma.atribuicao.upsert({
    where: { treinamentoId_usuarioId: { treinamentoId, usuarioId } },
    update: { prazo, concluidoEm, nota: null },
    create: { treinamentoId, usuarioId, prazo, concluidoEm },
  });

  await notificar({
    atribuicaoId: atrib.id,
    tipo: "liberacao",
    mensagem: jaConcluido
      ? `Treinamento "${treinamento?.titulo}" registrado como concluído.`
      : `Treinamento "${treinamento?.titulo}" liberado. Prazo para concluir: ${prazo.toLocaleDateString("pt-BR")}.`,
    emailDestino: jaConcluido ? null : usuario?.email,
    assunto: `Capacita — Novo treinamento: ${treinamento?.titulo}`,
  });

  revalidatePath("/admin");
  redirect("/admin");
}

// O usuário troca a própria senha. Usado tanto no /conta quanto na troca
// obrigatória do primeiro acesso (/trocar-senha). Limpa o flag senhaTemporaria.
export async function trocarSenha(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const atual = String(formData.get("senhaAtual") || "");
  const nova = String(formData.get("novaSenha") || "");
  const confirmar = String(formData.get("confirmar") || "");
  const destino = usuario!.senhaTemporaria ? "/trocar-senha" : "/conta";

  if (!verificarSenha(atual, usuario!.senhaHash)) redirect(`${destino}?erro=atual`);
  if (nova.length < 8) redirect(`${destino}?erro=curta`);
  if (nova !== confirmar) redirect(`${destino}?erro=confirma`);

  await prisma.usuario.update({
    where: { id: usuario!.id },
    data: { senhaHash: hashSenha(nova), senhaTemporaria: false },
  });

  if (usuario!.senhaTemporaria) {
    // Acabou de trocar a senha temporária: manda pra home dele.
    redirect(usuario!.papel === "admin" ? "/admin" : "/aluno");
  }
  revalidatePath("/conta");
  redirect("/conta?ok=senha");
}

// Admin cria um usuário com senha inicial (que ele troca no 1º acesso) e
// dispara o email de boas-vindas com o link de acesso.
export async function criarUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const papel = String(formData.get("papel") || "aluno") === "admin" ? "admin" : "aluno";
  const senhaInicial = String(formData.get("senhaInicial") || "");
  const clienteIdRaw = String(formData.get("clienteId") || "");

  if (!nome || !email || senhaInicial.length < 8) {
    redirect("/admin/usuarios?erro=dados");
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) redirect("/admin/usuarios?erro=email");

  await prisma.usuario.create({
    data: {
      nome,
      email,
      papel,
      senhaHash: hashSenha(senhaInicial),
      senhaTemporaria: true,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
    },
  });

  const base = process.env.APP_URL || "https://capacita-rust.vercel.app";
  await enviarEmail(
    email,
    "Bem-vindo à Capacita",
    `Olá, ${nome}.\n\nVocê foi cadastrado na plataforma de treinamentos Capacita.\n\nAcesse: ${base}/login\nEmail: ${email}\nSenha inicial: ${senhaInicial}\n\nPor segurança, vamos pedir para você trocar a senha no primeiro acesso.`
  );

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=criado");
}

// Admin edita nome, email, papel e cliente de um usuário.
export async function atualizarUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const papel = String(formData.get("papel") || "aluno") === "admin" ? "admin" : "aluno";
  const clienteIdRaw = String(formData.get("clienteId") || "");

  if (!nome || !email) redirect("/admin/usuarios?erro=dados");
  // Não deixa colidir com o email de outro usuário.
  const colide = await prisma.usuario.findFirst({ where: { email, id: { not: id } } });
  if (colide) redirect("/admin/usuarios?erro=email");

  await prisma.usuario.update({
    where: { id },
    data: { nome, email, papel, clienteId: clienteIdRaw ? Number(clienteIdRaw) : null },
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=editado");
}

// Admin redefine a senha de um usuário (define nova + força troca no 1º acesso)
// e avisa por email.
export async function redefinirSenha(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  const novaSenha = String(formData.get("novaSenha") || "");
  if (novaSenha.length < 8) redirect("/admin/usuarios?erro=curta");

  const alvo = await prisma.usuario.update({
    where: { id },
    data: { senhaHash: hashSenha(novaSenha), senhaTemporaria: true },
  });

  const base = process.env.APP_URL || "https://capacita-rust.vercel.app";
  await enviarEmail(
    alvo.email,
    "Capacita — sua senha foi redefinida",
    `Olá, ${alvo.nome}.\n\nUm administrador redefiniu sua senha.\n\nAcesse: ${base}/login\nEmail: ${alvo.email}\nSenha temporária: ${novaSenha}\n\nVamos pedir para você trocar a senha no primeiro acesso.`
  );

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=senha");
}
