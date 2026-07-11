"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha, hashSenha } from "./password";
import { validarPolitica, gerarSenhaForte } from "./password-policy";
import {
  criarSessao,
  encerrarSessao,
  getUsuarioAtual,
  criarMfaPendente,
  getMfaPendente,
} from "./auth";
import { statusDe } from "./status";
import { notificar, enviarEmail } from "./email";
import { enviarLembretes } from "./lembretes";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "./i18n-server";
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

// Bloqueio de força-bruta por conta: após MAX_FALHAS tentativas erradas
// seguidas, a conta fica bloqueada por LOCK_MIN minutos. Tradeoff conhecido:
// um atacante pode travar a conta de um usuário real (DoS leve); por isso o
// bloqueio é curto e some sozinho. Proteção por conta, não por IP.
const MAX_FALHAS = 5;
const LOCK_MIN = 15;

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Conta bloqueada por tentativas recentes?
  if (usuario?.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    redirect("/login?erro=bloqueado");
  }

  if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
    // Só conseguimos contabilizar quando a conta existe.
    if (usuario) {
      const falhas = usuario.falhasLogin + 1;
      const bloqueou = falhas >= MAX_FALHAS;
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          falhasLogin: bloqueou ? 0 : falhas,
          bloqueadoAte: bloqueou ? new Date(Date.now() + LOCK_MIN * 60 * 1000) : usuario.bloqueadoAte,
        },
      });
      if (bloqueou) redirect("/login?erro=bloqueado");
    }
    redirect("/login?erro=1");
  }

  // Sucesso: zera o contador de falhas e qualquer bloqueio.
  if (usuario!.falhasLogin !== 0 || usuario!.bloqueadoAte) {
    await prisma.usuario.update({
      where: { id: usuario!.id },
      data: { falhasLogin: 0, bloqueadoAte: null },
    });
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
  const respostas: Record<number, number> = {};
  for (const p of perguntas) {
    const escolhidaId = Number(formData.get(`p_${p.id}`));
    respostas[p.id] = escolhidaId;
    const correta = p.alternativas.find((a) => a.correta);
    if (correta && correta.id === escolhidaId) acertos++;
  }
  const nota = Math.round((acertos / perguntas.length) * 100);
  const aprovado = nota >= atrib!.treinamento.notaMinima;

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { nota, concluidoEm: aprovado ? new Date() : null, ultimasRespostas: respostas },
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
    redirect("/admin/treinamentos/novo?erro=ia");
  }

  const tema = String(formData.get("tema") || "").trim();
  const clienteIdRaw = String(formData.get("clienteId") || "");
  if (!tema) redirect("/admin/treinamentos/novo");

  let curso;
  try {
    curso = await gerarCursoIA(tema);
  } catch (e) {
    console.error("Falha na geração por IA:", e);
    redirect("/admin/treinamentos/novo?erro=ia");
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
    redirect("/admin/treinamentos/novo?erro=arquivo");
  }

  const nome = arquivo!.name.toLowerCase();
  const ehPdf = nome.endsWith(".pdf");
  const ehPptx = nome.endsWith(".pptx");
  if (!ehPdf && !ehPptx) redirect("/admin/treinamentos/novo?erro=arquivo");
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

// Admin edita um treinamento existente. Título/descrição/cliente para todos os
// tipos; conteúdo conforme o tipo (URL de vídeo, corpo de texto, ou slides).
export async function atualizarTreinamento(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  const titulo = String(formData.get("titulo") || "").trim();
  const descricao = String(formData.get("descricao") || "").trim();
  const clienteIdRaw = String(formData.get("clienteId") || "");
  if (!id || !titulo) redirect(`/admin/treinamentos/${id}/editar?erro=dados`);

  const treino = await prisma.treinamento.findUnique({ where: { id } });
  if (!treino) redirect("/admin/treinamentos");

  await prisma.treinamento.update({
    where: { id },
    data: {
      titulo,
      descricao,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      conteudoUrl: treino!.tipo === "video" ? String(formData.get("conteudoUrl") || "") : treino!.conteudoUrl,
      corpo: treino!.tipo === "texto" ? String(formData.get("corpo") || "") : treino!.corpo,
    },
  });

  // Slides: substitui o deck inteiro pelo que veio do editor (JSON ordenado).
  if (treino!.tipo === "slides") {
    let slides: { titulo: string; conteudo: string }[] = [];
    try {
      slides = JSON.parse(String(formData.get("slidesJson") || "[]"));
    } catch {
      slides = [];
    }
    slides = slides.filter((s) => (s.titulo || "").trim() || (s.conteudo || "").trim());
    await prisma.slide.deleteMany({ where: { treinamentoId: id } });
    if (slides.length > 0) {
      await prisma.slide.createMany({
        data: slides.map((s, i) => ({
          treinamentoId: id,
          ordem: i,
          titulo: (s.titulo || "").trim(),
          conteudo: (s.conteudo || "").trim(),
        })),
      });
    }
  }

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos?ok=editado");
}

// Admin atribui um treinamento a um ou vários alunos, com prazo. Gera uma
// notificacao de liberacao (o "email") para cada um.
export async function atribuir(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const treinamentoId = Number(formData.get("treinamentoId"));
  const prazo = new Date(String(formData.get("prazo")));
  // Opção: já registrar como concluído (sem o aluno precisar fazer).
  const jaConcluido = formData.get("jaConcluido") === "on";
  const concluidoEm = jaConcluido ? new Date() : null;

  // Aceita seleção múltipla (vários "usuarioIds") ou o campo único legado.
  const ids = formData.getAll("usuarioIds").map((v) => Number(v)).filter(Boolean);
  const unico = Number(formData.get("usuarioId"));
  const usuarioIds = ids.length > 0 ? ids : unico ? [unico] : [];

  if (!treinamentoId || usuarioIds.length === 0 || isNaN(prazo.getTime())) {
    redirect("/admin/atribuir?erro=dados");
  }

  const treinamento = await prisma.treinamento.findUnique({ where: { id: treinamentoId } });

  for (const usuarioId of usuarioIds) {
    const alvo = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!alvo) continue;
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
      emailDestino: jaConcluido ? null : alvo.email,
      assunto: `Capacita — Novo treinamento: ${treinamento?.titulo}`,
    });
  }

  revalidatePath("/admin");
  redirect(`/admin?ok=atribuido&n=${usuarioIds.length}`);
}

// Troca o idioma da interface (guardado em cookie). Vale para toda a plataforma.
export async function definirIdioma(formData: FormData) {
  const lang = formData.get("lang") === "es" ? "es" : "pt";
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

// Admin dispara os lembretes de prazo manualmente (o mesmo que o cron faz).
export async function enviarLembretesAction() {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const r = await enviarLembretes();

  revalidatePath("/admin");
  redirect(`/admin?ok=lembretes&t=${r.total}&v=${r.vencidos}&a=${r.aVencer}`);
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
  const violacao = validarPolitica(nova);
  if (violacao) redirect(`${destino}?erro=${violacao}`);
  if (nova !== confirmar) redirect(`${destino}?erro=confirma`);

  // Bloqueia reutilização: senha atual + últimas 6 do histórico.
  const historico = await prisma.senhaHistorico.findMany({
    where: { usuarioId: usuario!.id },
    orderBy: { criadoEm: "desc" },
    take: 6,
  });
  const anteriores = [usuario!.senhaHash, ...historico.map((h) => h.senhaHash)];
  if (anteriores.some((h) => verificarSenha(nova, h))) {
    redirect(`${destino}?erro=reutilizada`);
  }

  await prisma.$transaction([
    // Guarda a senha que está saindo no histórico.
    prisma.senhaHistorico.create({
      data: { usuarioId: usuario!.id, senhaHash: usuario!.senhaHash },
    }),
    prisma.usuario.update({
      where: { id: usuario!.id },
      data: { senhaHash: hashSenha(nova), senhaTemporaria: false },
    }),
  ]);

  // Mantém só as 6 últimas entradas do histórico.
  const antigas = await prisma.senhaHistorico.findMany({
    where: { usuarioId: usuario!.id },
    orderBy: { criadoEm: "desc" },
    skip: 6,
    select: { id: true },
  });
  if (antigas.length > 0) {
    await prisma.senhaHistorico.deleteMany({
      where: { id: { in: antigas.map((a) => a.id) } },
    });
  }

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

  // A senha vem gerada pelo cliente; validamos a política no servidor por segurança.
  if (!nome || !email || validarPolitica(senhaInicial)) {
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
  if (validarPolitica(novaSenha)) redirect("/admin/usuarios?erro=curta");

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
