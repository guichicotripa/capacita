import Link from "next/link";
import { prisma } from "@/lib/db";
import { criarTreinamento } from "@/lib/actions";
import { BotaoRemover } from "@/components/BotaoRemover";
import { GerarComIA } from "@/components/GerarComIA";

export default async function TreinamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const [treinamentos, clientes] = await Promise.all([
    prisma.treinamento.findMany({
      include: {
        cliente: true,
        _count: { select: { atribuicoes: true, perguntas: true } },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Lista */}
      <div>
        <h1 className="mb-4 text-xl font-semibold">Treinamentos</h1>
        {ok === "editado" && (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Treinamento atualizado.
          </p>
        )}
        <div className="grid gap-3">
          {treinamentos.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{t.titulo}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {t.tipo === "video"
                    ? "Vídeo"
                    : t.tipo === "slides"
                      ? "Slides"
                      : t.tipo === "arquivo"
                        ? "Apresentação"
                        : "Texto"}
                </span>
                {t.geradoPorIa && (
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                    IA
                  </span>
                )}
                {t._count.perguntas > 0 && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    Quiz · {t._count.perguntas}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{t.descricao}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t.cliente ? `Cliente: ${t.cliente.nome}` : "Global (todos os clientes)"} ·{" "}
                {t._count.atribuicoes} atribuição(ões)
              </p>
              <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                <Link
                  href={`/admin/treinamentos/${t.id}/preview`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  Pré-visualizar
                </Link>
                <Link
                  href={`/admin/treinamentos/${t.id}/editar`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  Editar
                </Link>
                <Link
                  href={`/admin/treinamentos/${t.id}/quiz`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  {t._count.perguntas > 0 ? "Editar quiz" : "+ Adicionar quiz"}
                </Link>
                <BotaoRemover treinamentoId={t.id} titulo={t.titulo} />
              </div>
            </div>
          ))}
          {treinamentos.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum treinamento ainda.</p>
          )}
        </div>
      </div>

      {/* Sidebar: gerar por IA + criar manual */}
      <div className="space-y-6">
        {erro === "ia" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            A geração por IA precisa da chave da Anthropic configurada no projeto. Configure e
            tente de novo.
          </p>
        )}
        {erro === "ppt" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Não consegui ler texto desse arquivo. Envie um <code>.pptx</code> com conteúdo em
            texto nos slides.
          </p>
        )}
        {erro === "arquivo" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Informe um título e um arquivo <code>.pdf</code> ou <code>.pptx</code>.
          </p>
        )}

        <GerarComIA clientes={clientes} />

        <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Novo treinamento (manual)
        </h2>
        <form
          action={criarTreinamento}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <Campo label="Título">
            <input name="titulo" required className={inputCls} placeholder="Ex: Reconhecendo Phishing" />
          </Campo>
          <Campo label="Descrição">
            <input name="descricao" required className={inputCls} placeholder="Resumo curto" />
          </Campo>
          <Campo label="Tipo">
            <select name="tipo" className={inputCls} defaultValue="texto">
              <option value="texto">Texto</option>
              <option value="video">Vídeo (embed)</option>
            </select>
          </Campo>
          <Campo label="URL do vídeo (se tipo = vídeo)">
            <input
              name="conteudoUrl"
              className={inputCls}
              placeholder="https://www.youtube.com/embed/..."
            />
          </Campo>
          <Campo label="Conteúdo em texto (se tipo = texto)">
            <textarea
              name="corpo"
              rows={4}
              className={inputCls}
              placeholder="Parágrafos separados por linha em branco."
            />
          </Campo>
          <Campo label="Cliente">
            <select name="clienteId" className={inputCls} defaultValue="">
              <option value="">Global (todos)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Criar treinamento
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
