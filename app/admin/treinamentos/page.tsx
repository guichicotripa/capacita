import Link from "next/link";
import { prisma } from "@/lib/db";
import { criarTreinamento } from "@/lib/actions";
import { BotaoRemover } from "@/components/BotaoRemover";
import { GerarComIA } from "@/components/GerarComIA";
import { getDict } from "@/lib/i18n-server";

export default async function TreinamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const d = await getDict();
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
        <h1 className="mb-4 text-xl font-semibold">{d.admin.treinos.titulo}</h1>
        {ok === "editado" && (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {d.admin.treinos.atualizadoOk}
          </p>
        )}
        <div className="grid gap-3">
          {treinamentos.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{t.titulo}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {t.tipo === "video"
                    ? d.admin.treinos.tipoVideo
                    : t.tipo === "slides"
                      ? d.admin.treinos.tipoSlides
                      : t.tipo === "arquivo"
                        ? d.admin.treinos.tipoApresentacao
                        : d.admin.treinos.tipoTexto}
                </span>
                {t.geradoPorIa && (
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                    IA
                  </span>
                )}
                {t._count.perguntas > 0 && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {d.admin.treinos.quiz(t._count.perguntas)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{t.descricao}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t.cliente ? d.admin.treinos.clientePrefixo(t.cliente.nome) : d.admin.treinos.global} ·{" "}
                {d.admin.treinos.atribuicoes(t._count.atribuicoes)}
              </p>
              <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                <Link
                  href={`/admin/treinamentos/${t.id}/preview`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  {d.admin.treinos.previsualizar}
                </Link>
                <Link
                  href={`/admin/treinamentos/${t.id}/editar`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  {d.admin.treinos.editar}
                </Link>
                <Link
                  href={`/admin/treinamentos/${t.id}/quiz`}
                  className="text-xs font-medium text-slate-700 hover:underline"
                >
                  {t._count.perguntas > 0 ? d.admin.treinos.editarQuiz : d.admin.treinos.addQuiz}
                </Link>
                {t._count.perguntas > 0 && (
                  <Link
                    href={`/admin/treinamentos/${t.id}/resultados`}
                    className="text-xs font-medium text-slate-700 hover:underline"
                  >
                    {d.admin.treinos.resultados}
                  </Link>
                )}
                <BotaoRemover treinamentoId={t.id} titulo={t.titulo} />
              </div>
            </div>
          ))}
          {treinamentos.length === 0 && (
            <p className="text-sm text-slate-400">{d.admin.treinos.nenhum}</p>
          )}
        </div>
      </div>

      {/* Sidebar: gerar por IA + criar manual */}
      <div className="space-y-6">
        {erro === "ia" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {d.admin.treinos.erroIa}
          </p>
        )}
        {erro === "ppt" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {d.admin.treinos.erroPpt}
          </p>
        )}
        {erro === "arquivo" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {d.admin.treinos.erroArquivo}
          </p>
        )}

        <GerarComIA clientes={clientes} />

        <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {d.admin.treinos.novoManual}
        </h2>
        <form
          action={criarTreinamento}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <Campo label={d.admin.treinos.tituloLabel}>
            <input name="titulo" required className={inputCls} placeholder="Ex: Reconhecendo Phishing" />
          </Campo>
          <Campo label={d.admin.treinos.descricao}>
            <input name="descricao" required className={inputCls} />
          </Campo>
          <Campo label={d.admin.treinos.tipo}>
            <select name="tipo" className={inputCls} defaultValue="texto">
              <option value="texto">{d.admin.treinos.tipoTextoOpt}</option>
              <option value="video">{d.admin.treinos.tipoVideoOpt}</option>
            </select>
          </Campo>
          <Campo label={d.admin.treinos.urlVideo}>
            <input
              name="conteudoUrl"
              className={inputCls}
              placeholder="https://www.youtube.com/embed/..."
            />
          </Campo>
          <Campo label={d.admin.treinos.conteudoTexto}>
            <textarea
              name="corpo"
              rows={4}
              className={inputCls}
            />
          </Campo>
          <Campo label={d.admin.gerarIA.cliente}>
            <select name="clienteId" className={inputCls} defaultValue="">
              <option value="">{d.admin.gerarIA.global}</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.admin.treinos.criar}
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
