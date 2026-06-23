import { prisma } from "@/lib/db";
import { criarTreinamento } from "@/lib/actions";

export default async function TreinamentosPage() {
  const [treinamentos, clientes] = await Promise.all([
    prisma.treinamento.findMany({
      include: { cliente: true, _count: { select: { atribuicoes: true } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Lista */}
      <div>
        <h1 className="mb-4 text-xl font-semibold">Treinamentos</h1>
        <div className="grid gap-3">
          {treinamentos.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{t.titulo}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {t.tipo === "video" ? "Vídeo" : "Texto"}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{t.descricao}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t.cliente ? `Cliente: ${t.cliente.nome}` : "Global (todos os clientes)"} ·{" "}
                {t._count.atribuicoes} atribuição(ões)
              </p>
            </div>
          ))}
          {treinamentos.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum treinamento ainda.</p>
          )}
        </div>
      </div>

      {/* Form criar */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Novo treinamento
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
