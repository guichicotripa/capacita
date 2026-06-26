import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { VisualizadorSlides } from "@/components/VisualizadorSlides";
import { VisualizadorArquivo } from "@/components/VisualizadorArquivo";
import { concluir, submeterQuiz } from "@/lib/actions";

export default async function TreinamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nota?: string; aprovado?: string }>;
}) {
  const { id } = await params;
  const { nota, aprovado } = await searchParams;
  const usuario = (await getUsuarioAtual())!;

  const atrib = await prisma.atribuicao.findUnique({
    where: { id: Number(id) },
    include: {
      treinamento: {
        include: {
          slides: { orderBy: { ordem: "asc" } },
          arquivo: { select: { mime: true } },
          perguntas: { orderBy: { ordem: "asc" }, include: { alternativas: true } },
        },
      },
    },
  });

  if (!atrib || atrib.usuarioId !== usuario.id) notFound();
  const status = statusDe(atrib);
  // Acesso cortado apos o prazo.
  if (status === "vencido") redirect("/aluno");

  const t = atrib.treinamento;
  const temQuiz = t.perguntas.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/aluno" className="text-sm text-slate-500 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">{t.titulo}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">{t.descricao}</p>
      <p className="mt-1 text-xs text-slate-400">Prazo: {formatarData(atrib.prazo)}</p>

      <div className="mt-6">
        {t.tipo === "arquivo" && t.arquivo ? (
          <VisualizadorArquivo treinamentoId={t.id} mime={t.arquivo.mime} />
        ) : t.tipo === "slides" ? (
          <VisualizadorSlides slides={t.slides} />
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

      {/* Resultado da última tentativa, se acabou de enviar */}
      {nota !== undefined && (
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
            aprovado === "1"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {aprovado === "1"
            ? `✓ Aprovado com ${nota}%. Treinamento concluído.`
            : `Você fez ${nota}% (mínimo ${t.notaMinima}%). Revise o conteúdo e tente de novo.`}
        </div>
      )}

      {/* Conclusão: por quiz (se houver) ou sistema de honra */}
      {status === "concluido" ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-green-700">
          ✓ Concluído em {formatarData(atrib.concluidoEm!)}
          {atrib.nota !== null && ` · nota ${atrib.nota}%`}
        </div>
      ) : temQuiz ? (
        <form
          action={submeterQuiz}
          className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-6"
        >
          <input type="hidden" name="atribuicaoId" value={atrib.id} />
          <h2 className="font-semibold">Avaliação (mínimo {t.notaMinima}% para concluir)</h2>
          {t.perguntas.map((p, i) => (
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
            Enviar respostas
          </button>
        </form>
      ) : (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Ao terminar o conteúdo, marque como concluído.
          </p>
          <form action={concluir}>
            <input type="hidden" name="atribuicaoId" value={atrib.id} />
            <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Marcar como concluído
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
