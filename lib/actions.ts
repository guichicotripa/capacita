"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha, hashSenha } from "./password";
import { validarPolitica, gerarSenhaForte } from "./password-policy";
import {
  gerarTokenConvite,
  expiracaoConvite,
  linkConvite,
  conviteValido,
} from "./convite";
import {
  ehFullAdmin,
  escopoCliente,
  podeEditarTreino,
  podeVerTreino,
  clienteParaCriacao,
} from "./escopo";
import {
  criarSessao,
  encerrarSessao,
  getUsuarioAtual,
  criarMfaPendente,
  getMfaPendente,
} from "./auth";
import { statusDe } from "./status";
import { perguntasDaTentativa } from "./quiz";
import { notificar, enviarEmail } from "./email";
import { enviarLembretes } from "./lembretes";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "./i18n-server";
import {
  iaDisponivel,
  gerarCursoIA,
  gerarQuizIA,
  gerarSlideIA,
  layoutsValidos,
  motivoDoErro,
  type CursoGerado,
  type PerguntaGerada,
} from "./ai";
import { gerarSegredoMfa, verificarCodigoMfa } from "./mfa";
import { extrairTextoPptx } from "./pptx";
import { sanitizarSvg } from "./svg";

// Cria um treinamento em slides + quiz a partir de um curso gerado (helper interno).
async function persistirCurso(
  curso: CursoGerado,
  clienteId: number | null,
  formatoConteudo: string = "topicos"
) {
  return prisma.treinamento.create({
    data: {
      titulo: curso.titulo,
      descricao: curso.descricao,
      tipo: "slides",
      clienteId,
      formatoConteudo,
      geradoPorIa: true,
      slides: {
        create: curso.slides.map((s, i) => ({
          ordem: i,
          titulo: s.titulo,
          conteudo: s.conteudo,
          layout: s.layout ?? "topicos",
          // A ilustração vem da IA e vai parar no DOM: só entra sanitizada.
          svg: sanitizarSvg(s.svg),
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
  // trim: senhas coladas costumam trazer espaço/quebra no fim; não guardamos nem
  // aceitamos senha com espaço nas bordas, então aparar aqui evita "senha errada".
  const senha = String(formData.get("senha") || "").trim();

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

  // Conta desativada pelo admin: credencial correta, mas sem acesso.
  if (!usuario!.ativo) redirect("/login?erro=inativo");

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
// Para onde volta depois de enviar o quiz ou marcar como concluído.
// A origem vem do formulário, então é tratada como não confiável: só o valor
// exato "janela" muda o destino, e o retorno é sempre uma rota nossa fixa.
function destinoConsumo(papel: string, origem: FormDataEntryValue | null): string {
  if (String(origem ?? "") === "janela") return "/treino";
  return papel === "admin" ? "/admin/meus-treinamentos" : "/aluno";
}

// Guarda em que página/slide a pessoa está, para retomar de onde parou.
// Chamado pelo visualizador a cada virada de página. É fire-and-forget: se
// falhar, o pior caso é a pessoa recomeçar do início, então não interrompe
// a navegação nem devolve erro para a tela.
export async function salvarProgresso(atribuicaoId: number, pagina: number) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return;
  const pag = Math.max(1, Math.floor(pagina));
  // updateMany (e não update) para o filtro por usuarioId entrar na query:
  // ninguém mexe no progresso de outra pessoa.
  await prisma.atribuicao.updateMany({
    where: { id: atribuicaoId, usuarioId: usuario.id },
    data: { progresso: pag },
  });
}

export async function concluir(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  // Admin também faz cursos, mas consome pela aba dele; o destino segue o papel.
  const emJanela = String(formData.get("origem") ?? "") === "janela";
  const base = destinoConsumo(usuario!.papel, formData.get("origem"));

  const atribuicaoId = Number(formData.get("atribuicaoId"));
  const atrib = await prisma.atribuicao.findUnique({
    where: { id: atribuicaoId },
    include: { treinamento: { include: { _count: { select: { perguntas: true } } } } },
  });

  if (!atrib || atrib.usuarioId !== usuario!.id) {
    redirect(base);
  }
  if (statusDe(atrib!) === "vencido") {
    // Prazo expirado: acesso cortado, nao deixa concluir.
    redirect(base);
  }
  // Se o treinamento tem quiz, a conclusao tem que vir pela avaliacao.
  if (atrib!.treinamento._count.perguntas > 0) {
    redirect(`${base}/${atribuicaoId}`);
  }

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { concluidoEm: new Date() },
  });

  // Na janela separada não existe lista para voltar: fica na própria
  // capacitação, que agora mostra o estado "concluído" no topo.
  if (emJanela) {
    redirect(`${base}/${atribuicaoId}`);
  }

  revalidatePath(base);
  redirect(base);
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

  // Admin também faz cursos, mas consome pela aba dele; o destino segue o papel.
  // Quem veio da janela separada volta para lá, senão o popup saltaria para
  // dentro do app com menu e cabeçalho no meio da capacitação.
  const base = destinoConsumo(usuario!.papel, formData.get("origem"));

  if (!atrib || atrib.usuarioId !== usuario!.id) redirect(base);
  if (statusDe(atrib!) === "vencido") redirect(base);

  const banco = atrib!.treinamento.perguntas;
  if (banco.length === 0) redirect(`${base}/${atribuicaoId}`);

  // Corrige contra o MESMO sorteio que a pessoa respondeu. O conjunto vem de
  // (atribuição, tentativa atual), então é reproduzível aqui sem depender de
  // nada que tenha chegado pelo formulário.
  const perguntas = perguntasDaTentativa(
    banco,
    atrib!.treinamento.perguntasPorTentativa,
    atribuicaoId,
    atrib!.tentativas
  );

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
    data: {
      nota,
      concluidoEm: aprovado ? new Date() : null,
      ultimasRespostas: respostas,
      // Sobe a tentativa: quem reprovou cai noutro conjunto na próxima.
      tentativas: { increment: 1 },
    },
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

  revalidatePath(base);
  redirect(`${base}/${atribuicaoId}?nota=${nota}&aprovado=${aprovado ? 1 : 0}`);
}

// Admin gera um treinamento + quiz por IA a partir de um tema.
export async function gerarTreinamentoIA(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  if (!iaDisponivel()) {
    redirect("/admin/treinamentos/novo?erro=ia");
  }

  const tema = String(formData.get("tema") || "").trim();
  const instrucoes = String(formData.get("instrucoes") || "").trim();
  const clienteId = clienteParaCriacao(usuario, String(formData.get("clienteId") || ""));
  if (!tema) redirect("/admin/treinamentos/novo");

  // Formato do conteúdo: tópicos (padrão) ou prosa descritiva.
  const formato = String(formData.get("formato") || "") === "prosa" ? "prosa" : "topicos";
  // Layouts que o admin liberou no seletor. Vazio ou inválido = todos.
  const permitidos = layoutsValidos(formData.getAll("layouts").map(String));

  let curso;
  try {
    curso = await gerarCursoIA(tema, undefined, instrucoes || undefined, formato, permitidos);
  } catch (e) {
    // "sem chave" e "a chamada falhou" são coisas diferentes. Juntar as duas num
    // aviso só mandou o admin conferir a chave enquanto o problema real era um
    // schema inválido, e isso custou tempo. O motivo vai junto na URL.
    console.error("Falha na geração por IA:", e);
    redirect(`/admin/treinamentos/novo?erro=iaFalhou&motivo=${encodeURIComponent(motivoDoErro(e).slice(0, 300))}`);
  }

  await persistirCurso(curso!, clienteId, formato);
  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin sobe um .pptx; extraímos o texto e a IA monta o curso + quiz.
export async function gerarCursoDePPT(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");
  if (!iaDisponivel()) redirect("/admin/treinamentos?erro=ia");

  const arquivo = formData.get("arquivo") as File | null;
  const clienteId = clienteParaCriacao(usuario, String(formData.get("clienteId") || ""));
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
    redirect(`/admin/treinamentos?erro=iaFalhou&motivo=${encodeURIComponent(motivoDoErro(e).slice(0, 300))}`);
  }

  await persistirCurso(curso!, clienteId);
  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Refaz um slide com IA a partir do que está NO EDITOR (não do que está salvo)
// e devolve o resultado para o cliente. De propósito não grava nada: o admin
// ainda vê a prévia e decide se salva. Assim "refazer" nunca destrói trabalho.
export type ResultadoSlideIA =
  | { ok: true; slide: { titulo: string; conteudo: string; layout: string; svg: string | null } }
  | { ok: false; erro: "auth" | "semIa" | "dados" | "falha"; motivo?: string };

export async function refazerSlideComIA(
  treinamentoId: number,
  atual: { titulo: string; conteudo: string; layout: string; svg?: string | null },
  instrucao: string
): Promise<ResultadoSlideIA> {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") return { ok: false, erro: "auth" };

  // Mesmo escopo da edição: ninguém refaz slide de treino que não pode editar.
  const treino = await prisma.treinamento.findUnique({ where: { id: treinamentoId } });
  if (!treino || !podeEditarTreino(treino, usuario)) return { ok: false, erro: "auth" };

  if (!iaDisponivel()) return { ok: false, erro: "semIa" };
  const pedido = String(instrucao || "").trim();
  if (!pedido) return { ok: false, erro: "dados" };

  try {
    const gerado = await gerarSlideIA(
      {
        titulo: String(atual.titulo || ""),
        conteudo: String(atual.conteudo || ""),
        layout: String(atual.layout || "topicos"),
        svg: atual.svg ?? null,
      },
      pedido,
      {
        tituloCurso: treino.titulo,
        formato: treino.formatoConteudo === "prosa" ? "prosa" : "topicos",
      }
    );
    return {
      ok: true,
      slide: {
        titulo: gerado.titulo,
        conteudo: gerado.conteudo,
        layout: gerado.layout,
        // Sanitiza aqui, no servidor: o SVG segue direto para o DOM da prévia.
        svg: sanitizarSvg(gerado.svg),
      },
    };
  } catch (e) {
    console.error("Falha ao refazer slide com IA:", e);
    return { ok: false, erro: "falha", motivo: motivoDoErro(e).slice(0, 300) };
  }
}

// Admin substitui o quiz de um treinamento (apaga as perguntas atuais e cria as novas).
export async function salvarQuiz(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const treinamentoId = Number(formData.get("treinamentoId"));
  const treinoQuiz = await prisma.treinamento.findUnique({ where: { id: treinamentoId } });
  if (!treinoQuiz || !podeEditarTreino(treinoQuiz, usuario)) redirect("/admin/treinamentos");
  const notaMinima = Math.min(100, Math.max(0, Number(formData.get("notaMinima") || 70)));
  const porTentativa = Math.min(20, Math.max(1, Number(formData.get("perguntasPorTentativa") || 5)));
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
        perguntasPorTentativa: porTentativa,
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
  const clienteId = clienteParaCriacao(usuario, String(formData.get("clienteId") || ""));
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

  // Avaliação do material subido. Antes o arquivo entrava sem quiz nenhum e não
  // havia como perceber: o aluno via o PDF e só clicava em "concluído".
  // Se a IA falhar (ou não tiver chave), o treinamento é criado mesmo assim e o
  // admin monta o quiz na mão — perder o material por causa disso seria pior.
  let perguntas: PerguntaGerada[] = [];
  if (iaDisponivel()) {
    try {
      perguntas = await gerarQuizIA(
        titulo,
        ehPdf
          ? { tipo: "pdf", dados: bytes }
          : { tipo: "texto", texto: await extrairTextoPptx(bytes) }
      );
    } catch (e) {
      console.error("Falha ao gerar o quiz do arquivo:", e);
    }
  }

  await prisma.treinamento.create({
    data: {
      titulo,
      descricao: descricao || arquivo!.name,
      tipo: "arquivo",
      clienteId,
      arquivo: {
        create: { mime, nomeOriginal: arquivo!.name, dados: bytes },
      },
      perguntas: {
        create: perguntas.map((p, i) => ({
          enunciado: p.enunciado,
          ordem: i,
          alternativas: { create: p.alternativas },
        })),
      },
    },
  });

  revalidatePath("/admin/treinamentos");
  redirect(`/admin/treinamentos?ok=${perguntas.length > 0 ? "criadoComQuiz" : "criadoSemQuiz"}`);
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
  const treino = await prisma.treinamento.findUnique({ where: { id: treinamentoId } });
  if (!treino || !podeEditarTreino(treino, usuario)) redirect("/admin/treinamentos");
  await prisma.treinamento.delete({ where: { id: treinamentoId } });

  revalidatePath("/admin/treinamentos");
  revalidatePath("/admin");
  redirect("/admin/treinamentos");
}

// Admin cria um treinamento.
export async function criarTreinamento(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const tipo = String(formData.get("tipo") || "texto");
  const clienteId = clienteParaCriacao(usuario, String(formData.get("clienteId") || ""));

  await prisma.treinamento.create({
    data: {
      titulo: String(formData.get("titulo") || "").trim(),
      descricao: String(formData.get("descricao") || "").trim(),
      tipo,
      conteudoUrl: tipo === "video" ? String(formData.get("conteudoUrl") || "") : null,
      corpo: tipo === "texto" ? String(formData.get("corpo") || "") : null,
      clienteId,
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
  if (!id || !titulo) redirect(`/admin/treinamentos/${id}/editar?erro=dados`);

  const treino = await prisma.treinamento.findUnique({ where: { id } });
  if (!treino || !podeEditarTreino(treino, usuario)) redirect("/admin/treinamentos");

  await prisma.treinamento.update({
    where: { id },
    data: {
      titulo,
      descricao,
      clienteId: clienteParaCriacao(usuario, String(formData.get("clienteId") || "")),
      conteudoUrl: treino!.tipo === "video" ? String(formData.get("conteudoUrl") || "") : treino!.conteudoUrl,
      corpo: treino!.tipo === "texto" ? String(formData.get("corpo") || "") : treino!.corpo,
    },
  });

  // Slides: substitui o deck inteiro pelo que veio do editor (JSON ordenado).
  if (treino!.tipo === "slides") {
    // layout e svg vêm de volta do editor sem serem editados lá. Se não fossem
    // repassados aqui, editar o texto de um slide apagaria a ilustração e o
    // layout dele, porque o deck é recriado do zero.
    let slides: {
      titulo: string;
      conteudo: string;
      layout?: string | null;
      svg?: string | null;
    }[] = [];
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
          layout: s.layout || "topicos",
          // Re-sanitiza: o JSON veio do navegador, não é fonte confiável.
          svg: sanitizarSvg(s.svg),
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
  // Admin de cliente só atribui treino que enxerga (próprio + global).
  if (!treinamento || !podeVerTreino(treinamento, usuario)) redirect("/admin/atribuir?erro=dados");
  const escopo = escopoCliente(usuario);

  for (const usuarioId of usuarioIds) {
    const alvo = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!alvo) continue;
    // Admin de cliente só atribui a alunos do próprio cliente.
    if (escopo !== null && alvo.clienteId !== escopo) continue;
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

  const atual = String(formData.get("senhaAtual") || "").trim();
  const nova = String(formData.get("novaSenha") || "").trim();
  const confirmar = String(formData.get("confirmar") || "").trim();
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

// Admin GERAL cria um novo cliente (empresa). Onboarding de nova conta.
export async function criarCliente(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !ehFullAdmin(usuario)) redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) redirect("/admin/clientes?erro=nome");

  const existe = await prisma.cliente.findFirst({ where: { nome } });
  if (existe) redirect("/admin/clientes?erro=existe");

  // Campos de cadastro da empresa: opcionais, guardamos null quando em branco.
  const opcional = (campo: string) => {
    const v = String(formData.get(campo) || "").trim();
    return v || null;
  };

  await prisma.cliente.create({
    data: {
      nome,
      cnpj: opcional("cnpj"),
      endereco: opcional("endereco"),
      email: opcional("email"),
      telefone: opcional("telefone"),
      responsavel: opcional("responsavel"),
    },
  });
  revalidatePath("/admin/clientes");
  redirect("/admin/clientes?ok=criado");
}

// Admin cria um usuário com senha inicial (que ele troca no 1º acesso) e
// dispara o email de boas-vindas com o link de acesso.
export async function criarUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const escopo = escopoCliente(usuario);
  // Admin de cliente só cria aluno (não promove a admin) e sempre no próprio cliente.
  const papelPedido = String(formData.get("papel") || "aluno") === "admin" ? "admin" : "aluno";
  const papel = escopo === null ? papelPedido : "aluno";
  const clienteId = clienteParaCriacao(usuario, String(formData.get("clienteId") || ""));

  if (!nome || !email) {
    redirect("/admin/usuarios?erro=dados");
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) redirect("/admin/usuarios?erro=email");

  // Acesso por convite: a pessoa define a própria senha pelo link. A senha
  // gravada aqui é aleatória e ninguém a conhece — serve só para o campo não
  // ficar vazio até o convite ser usado.
  const token = gerarTokenConvite();
  const novo = await prisma.usuario.create({
    data: {
      nome,
      email,
      papel,
      telefone: String(formData.get("telefone") || "").trim() || null,
      cargo: String(formData.get("cargo") || "").trim() || null,
      senhaHash: hashSenha(gerarSenhaForte(32)),
      senhaTemporaria: false,
      conviteToken: token,
      conviteExpiraEm: expiracaoConvite(),
      clienteId,
    },
  });

  const enviado = await enviarEmail(
    email,
    "Seu acesso à Capacita",
    `Olá, ${nome}.\n\nVocê foi cadastrado na plataforma de treinamentos Capacita.\n\nPara criar sua senha e acessar, abra o link abaixo:\n${linkConvite(token)}\n\nO link vale por 7 dias e só pode ser usado uma vez.`
  );

  revalidatePath("/admin/usuarios");
  // Se o email não saiu, leva o admin direto para o link, para ele copiar e
  // mandar pela mão. É o que impede o usuário de nascer inacessível.
  redirect(`/admin/usuarios?ok=${enviado ? "criado" : "criadoSemEmail"}&convite=${novo.id}`);
}

// A pessoa define a própria senha pelo link de convite e já entra.
export async function definirSenhaPorConvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const nova = String(formData.get("novaSenha") || "").trim();
  const confirmar = String(formData.get("confirmar") || "").trim();

  const alvo = token
    ? await prisma.usuario.findUnique({ where: { conviteToken: token } })
    : null;
  if (!alvo || !alvo.ativo || !conviteValido(alvo)) redirect("/convite/invalido");

  const violacao = validarPolitica(nova);
  if (violacao) redirect(`/convite/${token}?erro=${violacao}`);
  if (nova !== confirmar) redirect(`/convite/${token}?erro=confirma`);

  await prisma.usuario.update({
    where: { id: alvo!.id },
    data: {
      senhaHash: hashSenha(nova),
      senhaTemporaria: false,
      // Consome o convite (uso único) e limpa qualquer bloqueio de tentativas.
      conviteToken: null,
      conviteExpiraEm: null,
      falhasLogin: 0,
      bloqueadoAte: null,
    },
  });

  await criarSessao(alvo!.id);
  redirect(alvo!.papel === "admin" ? "/admin" : "/aluno");
}

// Admin gera um novo link de acesso (primeiro acesso ou senha esquecida).
// Substitui a antiga "redefinir senha", que dependia de repassar senha.
export async function gerarNovoConvite(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  const escopo = escopoCliente(usuario);
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) redirect("/admin/usuarios");
  // Admin de cliente só mexe em usuário do próprio cliente.
  if (escopo !== null && alvo!.clienteId !== escopo) redirect("/admin/usuarios");

  const token = gerarTokenConvite();
  await prisma.usuario.update({
    where: { id },
    data: {
      conviteToken: token,
      conviteExpiraEm: expiracaoConvite(),
      // Um link novo também destrava quem ficou bloqueado por tentativas.
      falhasLogin: 0,
      bloqueadoAte: null,
    },
  });

  const enviado = await enviarEmail(
    alvo!.email,
    "Seu novo acesso à Capacita",
    `Olá, ${alvo!.nome}.\n\nPara criar uma nova senha e acessar, abra o link abaixo:\n${linkConvite(token)}\n\nO link vale por 7 dias e só pode ser usado uma vez.`
  );

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?ok=${enviado ? "convite" : "conviteSemEmail"}&convite=${id}`);
}

// Ativa/desativa um usuário. Desativado não loga e some das listas de
// atribuição, mas o histórico dele continua no relatório (prova de compliance).
export async function alternarAtivoUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  if (id === usuario!.id) redirect("/admin/usuarios?erro=proprioUsuario");

  const escopo = escopoCliente(usuario);
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) redirect("/admin/usuarios");
  if (escopo !== null && alvo!.clienteId !== escopo) redirect("/admin/usuarios");

  await prisma.usuario.update({
    where: { id },
    data: { ativo: !alvo!.ativo, conviteToken: null, conviteExpiraEm: null },
  });

  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?ok=${alvo!.ativo ? "desativado" : "reativado"}`);
}

// Exclui de vez um usuário — só se ele não tiver histórico de treinamento.
// Com histórico, o certo é desativar: apagar destruiria a prova de conclusão,
// que é justamente o que o comprador exige numa auditoria.
export async function excluirUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  if (id === usuario!.id) redirect("/admin/usuarios?erro=proprioUsuario");

  const escopo = escopoCliente(usuario);
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) redirect("/admin/usuarios");
  if (escopo !== null && alvo!.clienteId !== escopo) redirect("/admin/usuarios");

  const historico = await prisma.atribuicao.count({ where: { usuarioId: id } });
  if (historico > 0) redirect("/admin/usuarios?erro=temHistorico");

  await prisma.usuario.delete({ where: { id } });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=excluido");
}

// Admin geral exclui uma empresa-cliente, desde que nada esteja preso a ela.
export async function excluirCliente(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !ehFullAdmin(usuario)) redirect("/admin");

  const id = Number(formData.get("id"));
  const [usuarios, treinamentos] = await Promise.all([
    prisma.usuario.count({ where: { clienteId: id } }),
    prisma.treinamento.count({ where: { clienteId: id } }),
  ]);
  if (usuarios > 0 || treinamentos > 0) redirect("/admin/clientes?erro=temVinculo");

  await prisma.cliente.delete({ where: { id } });

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes?ok=excluido");
}

// Admin edita nome, email, papel e cliente de um usuário.
export async function atualizarUsuario(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") redirect("/login");

  const id = Number(formData.get("id"));
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const escopo = escopoCliente(usuario);

  const alvoAtual = await prisma.usuario.findUnique({ where: { id } });
  if (!alvoAtual) redirect("/admin/usuarios");
  // Admin de cliente só edita usuários do próprio cliente.
  if (escopo !== null && alvoAtual!.clienteId !== escopo) redirect("/admin/usuarios");

  // Admin de cliente não promove a admin nem move o usuário para outro cliente.
  const papel = escopo === null
    ? (String(formData.get("papel") || "aluno") === "admin" ? "admin" : "aluno")
    : "aluno";
  const clienteId = escopo === null
    ? clienteParaCriacao(usuario, String(formData.get("clienteId") || ""))
    : escopo;

  if (!nome || !email) redirect("/admin/usuarios?erro=dados");
  // Não deixa colidir com o email de outro usuário.
  const colide = await prisma.usuario.findFirst({ where: { email, id: { not: id } } });
  if (colide) redirect("/admin/usuarios?erro=email");

  await prisma.usuario.update({
    where: { id },
    data: {
      nome,
      email,
      papel,
      clienteId,
      telefone: String(formData.get("telefone") || "").trim() || null,
      cargo: String(formData.get("cargo") || "").trim() || null,
    },
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=editado");
}

// A antiga redefinirSenha foi substituída por gerarNovoConvite: o admin não
// repassa mais senha nenhuma, ele manda um link e a pessoa define a própria.
