import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { VisualizadorSlides } from "@/components/VisualizadorSlides";
import { VisualizadorArquivo } from "@/components/VisualizadorArquivo";

// Pré-visualização do treinamento pelo admin, sem precisar atribuir a um aluno.
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await prisma.treinamento.findUnique({
    where: { id: Number(id) },
    include: {
      slides: { orderBy: { ordem: "asc" } },
      arquivo: { select: { mime: true } },
      perguntas: { orderBy: { ordem: "asc" }, include: { alternativas: true } },
    },
  });
  if (!t) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/treinamentos" className="text-sm text-slate-500 hover:underline">
        ← Treinamentos
      </Link>
      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">{t.titulo}</h1>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Pré-visualização
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t.descricao}</p>

      {/* Conteúdo, como o aluno vê */}
      <div className="mt-6">
        {t.tipo === "arquivo" && t.arquivo ? (
          <VisualizadorArquivo treinamentoId={t.id} mime={t.arquivo.mime} />
        ) : t.tipo === "slides" ? (
          <VisualizadorSlides slides={t.slides} />
        ) : t.tipo === "video" && t.conteudoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-black">
            <iframe src={t.conteudoUrl} className="h-full w-full" allowFullScreen title={t.titulo} />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700">
            {(t.corpo || "").split("\n\n").map((par, i) => (
              <p key={i}>{par}</p>
            ))}
          </div>
        )}
      </div>

      {/* Quiz (gabarito visível só na pré-visualização) */}
      {t.perguntas.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">
            Avaliação · {t.perguntas.length} perguntas · mínimo {t.notaMinima}%
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            A alternativa correta está destacada (visível só aqui na pré-visualização).
          </p>
          <ol className="space-y-4">
            {t.perguntas.map((p, i) => (
              <li key={p.id}>
                <p className="text-sm font-medium text-slate-800">
                  {i + 1}. {p.enunciado}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {p.alternativas.map((a) => (
                    <li
                      key={a.id}
                      className={`text-sm ${
                        a.correta ? "font-medium text-green-700" : "text-slate-600"
                      }`}
                    >
                      {a.correta ? "✓ " : "• "}
                      {a.texto}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
