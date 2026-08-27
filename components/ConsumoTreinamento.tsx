import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { VisualizadorSlides } from "@/components/VisualizadorSlides";
import { VisualizadorArquivo } from "@/components/VisualizadorArquivo";
import { AbrirEmJanela } from "@/components/AbrirEmJanela";
import { concluir, submeterQuiz } from "@/lib/actions";
import { perguntasDaTentativa } from "@/lib/quiz";
import { getDict } from "@/lib/i18n-server";

// Consumo de um treinamento atribuído (slides/arquivo/vídeo/texto + quiz + revisão).
// Compartilhado entre a visão do aluno (/aluno/[id]), a do admin que também faz
// cursos (/admin/meus-treinamentos/[id]) e a janela separada (/treino/[id]).
// `emJanela` faz os envios voltarem para /treino em vez de para a lista, senão
// a janela sem cabeçalho saltava de volta para dentro do app depois do quiz.
export async function ConsumoTreinamento({
  atribuicaoId,
  usuarioId,
  voltarHref,
  nota,
  aprovado,
  emJanela = false,
  acaoVoltar,
}: {
  atribuicaoId: number;
  usuarioId: number;
  voltarHref: string;
  nota?: string;
  aprovado?: string;
  emJanela?: boolean;
  acaoVoltar?: React.ReactNode;
}) {
  const d = await getDict();

  const atrib = await prisma.atribuicao.findUnique({
    where: { id: atribuicaoId },
    include: {
      // Identidade visual vem da empresa do ALUNO, não do dono do treinamento:
      // um treino global atribuído à Acme deve sair com a marca da Acme.
      usuario: { select: { clienteId: true, cliente: { select: { corPrimaria: true } } } },
      treinamento: {
        include: {
          slides: { orderBy: { ordem: "asc" } },
          arquivo: { select: { mime: true } },
          perguntas: { orderBy: { ordem: "asc" }, include: { alternativas: true } },
        },
      },
    },
  });

  // Só o dono da atribuição consome (vale para aluno e para admin).
  if (!atrib || atrib.usuarioId !== usuarioId) notFound();
  const status = statusDe(atrib);
  // Acesso cortado apos o prazo.
  if (status === "vencido") redirect(voltarHref);

  const t = atrib.treinamento;
  const temQuiz = t.perguntas.length > 0;

  const marca = atrib.usuario.clienteId
    ? {
        logoUrl: `/api/cliente/${atrib.usuario.clienteId}/logo`,
        cor: atrib.usuario.cliente?.corPrimaria ?? null,
      }
    : undefined;

  // Perguntas desta tentativa: um sorteio do banco. Reprovou, sobe a tentativa
  // e cai outro conjunto — em vez de repetir as mesmas perguntas de sempre.
  const perguntasDaVez = temQuiz
    ? perguntasDaTentativa(t.perguntas, t.perguntasPorTentativa, atrib.id, atrib.tentativas)
    : [];

  // Revisão da última tentativa. O gabarito só aparece para quem JÁ passou:
  // mostrar a resposta certa a quem reprovou entrega a prova de graça e a
  // próxima tentativa vira decoreba, não aprendizado.
  const respondidas = (atrib.ultimasRespostas as Record<string, number> | null) ?? null;
  const perguntasRevisao = respondidas
    ? t.perguntas.filter((p) => respondidas[p.id] !== undefined)
    : [];
  const revelarGabarito = status === "concluido";

  // O quiz vira a última página do deck quando o conteúdo é deck (slides ou PDF).
  const ehPdf = t.tipo === "arquivo" && t.arquivo?.mime === "application/pdf";
  const quizNoDeck = temQuiz && status !== "concluido" && (t.tipo === "slides" || ehPdf);
  const quizData = quizNoDeck
    ? {
        atribuicaoId: atrib.id,
        notaMinima: t.notaMinima,
        emJanela,
        perguntas: perguntasDaVez.map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          alternativas: p.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
        })),
      }
    : null;

  return (
    // Em janela separada o conteúdo usa a largura toda: o ponto de abrir noutra
    // janela é ver a capacitação maior, não o mesmo bloco estreito de antes.
    <div className={`mx-auto ${emJanela ? "max-w-6xl" : "max-w-3xl"}`}>
      {acaoVoltar ?? (
        <Link href={voltarHref} className="text-sm text-slate-500 hover:underline">
          {d.treino.voltar}
        </Link>
      )}

      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">{t.titulo}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">{t.descricao}</p>
      <p className="mt-1 text-xs text-slate-400">{d.treino.prazo}: {formatarData(atrib.prazo)}</p>

      {/* Resultado e status ficam ANTES do conteúdo. Embaixo do visualizador eles
          caíam fora da tela no celular: a página recarrega no topo depois do envio
          e a pessoa via o deck de novo, achando que a nota não tinha saído. */}
      {nota !== undefined && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${
            aprovado === "1"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {aprovado === "1"
            ? d.treino.aprovadoCom(Number(nota))
            : d.treino.vocefez(Number(nota), t.notaMinima)}
        </div>
      )}

      {status === "concluido" ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-green-700">
          {d.treino.concluidoEm(formatarData(atrib.concluidoEm!))}
          {atrib.nota !== null && d.treino.nota(atrib.nota)}
        </div>
      ) : (
        /* Diz de saída o que a pessoa precisa fazer no fim do conteúdo. */
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {temQuiz ? d.treino.passoAvaliacao(perguntasDaVez.length) : d.treino.passoConcluir}
          {!quizNoDeck && (
            <a href="#fim" className="ml-2 font-medium text-slate-700 hover:underline">
              {d.treino.irParaFinal}
            </a>
          )}
        </p>
      )}

      {/* Modo apresentação: mesma capacitação em janela própria, sem menu.
          Enquanto está aberta, esta página mostra o aviso no lugar do botão. */}
      {!emJanela && status !== "concluido" && <AbrirEmJanela href={`/treino/${atrib.id}`} />}

      <div className="mt-6">
        {t.tipo === "arquivo" && t.arquivo ? (
          <VisualizadorArquivo
            treinamentoId={t.id}
            mime={t.arquivo.mime}
            quiz={quizData}
            atribuicaoId={atrib.id}
            progressoInicial={atrib.progresso}
          />
        ) : t.tipo === "slides" ? (
          <VisualizadorSlides
            slides={t.slides}
            quiz={quizData}
            formato={t.formatoConteudo}
            atribuicaoId={atrib.id}
            progressoInicial={atrib.progresso}
            grande={emJanela}
            marca={marca}
          />
        ) : t.tipo === "video" && t.conteudoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-black">
            <iframe
              src={t.conteudoUrl}
              className="h-full w-full"
              allowFullScreen
              title={t.titulo}
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700">
            {(t.corpo || "").split("\n\n").map((par, i) => (
              <p key={i}>{par}</p>
            ))}
          </div>
        )}
      </div>

      <span id="fim" />

      {/* Revisão da última tentativa. Aprovado vê o gabarito; reprovado vê só
          quais errou, sem a resposta certa (senão a próxima tentativa é de graça). */}
      {perguntasRevisao.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">{d.treino.revisao}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {revelarGabarito ? d.treino.revisaoLegenda : d.treino.revisaoSemGabarito}
          </p>
          {perguntasRevisao.map((p, i) => {
            const escolhida = respondidas![p.id];
            const acertou = p.alternativas.some((a) => a.correta && a.id === escolhida);

            if (!revelarGabarito) {
              return (
                <div key={p.id} className="mt-3 flex gap-2 text-sm">
                  <span className={`w-3 shrink-0 ${acertou ? "text-green-600" : "text-red-600"}`}>
                    {acertou ? "✓" : "✗"}
                  </span>
                  <span className="text-slate-800">
                    {i + 1}. {p.enunciado}
                  </span>
                </div>
              );
            }

            return (
              <div key={p.id} className="mt-4">
                <p className="text-sm font-medium text-slate-800">
                  {i + 1}. {p.enunciado}
                </p>
                <ul className="mt-2 space-y-1">
                  {p.alternativas.map((a) => {
                    const marcada = a.id === escolhida;
                    const cor = a.correta
                      ? "text-green-700"
                      : marcada
                        ? "text-red-600"
                        : "text-slate-600";
                    const icone = a.correta ? "✓" : marcada ? "✗" : "•";
                    return (
                      <li key={a.id} className={`flex gap-2 text-sm ${cor}`}>
                        <span className="w-3 shrink-0">{icone}</span>
                        <span>
                          {a.texto}
                          {marcada && <span className="text-xs text-slate-400"> {d.treino.suaResposta}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Conclusão. Em deck (slides/PDF) o quiz já está na última página; o estado
          "concluído" agora é mostrado lá em cima, junto do título. */}
      {status === "concluido" ? null : quizNoDeck ? null : temQuiz ? (
        <form
          action={submeterQuiz}
          className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-6"
        >
          <input type="hidden" name="atribuicaoId" value={atrib.id} />
          {emJanela && <input type="hidden" name="origem" value="janela" />}
          <h2 className="font-semibold">{d.treino.avaliacaoMin(t.notaMinima)}</h2>
          {perguntasDaVez.map((p, i) => (
            <fieldset key={p.id} className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">
                {i + 1}. {p.enunciado}
              </legend>
              {p.alternativas.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name={`p_${p.id}`} value={a.id} required />
                  {a.texto}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.treino.enviarRespostas}
          </button>
        </form>
      ) : (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{d.treino.aoTerminar}</p>
          <form action={concluir}>
            <input type="hidden" name="atribuicaoId" value={atrib.id} />
            {emJanela && <input type="hidden" name="origem" value="janela" />}
            <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              {d.treino.marcarConcluido}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
