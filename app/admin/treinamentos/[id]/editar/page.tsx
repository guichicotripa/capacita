import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { atualizarTreinamento } from "@/lib/actions";
import { EditorSlides } from "@/components/EditorSlides";
import { getDict } from "@/lib/i18n-server";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

export default async function EditarTreinamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const d = await getDict();

  const [treino, clientes] = await Promise.all([
    prisma.treinamento.findUnique({
      where: { id: Number(id) },
      include: { slides: { orderBy: { ordem: "asc" } } },
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
  ]);

  if (!treino) notFound();

  const rotuloTipo =
    treino.tipo === "video"
      ? d.admin.treinos.tipoVideo
      : treino.tipo === "slides"
        ? d.admin.treinos.tipoSlides
        : treino.tipo === "arquivo"
          ? d.admin.treinos.tipoApresentacao
          : d.admin.treinos.tipoTexto;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/treinamentos" className="text-sm text-slate-500 hover:underline">
        {d.admin.quiz.voltar}
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{d.admin.editar.titulo}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {d.admin.editar.tipo(rotuloTipo)}
        {treino.tipo === "arquivo" && d.admin.editar.arquivoNaoEditavel}
      </p>

      {erro === "dados" && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {d.admin.editar.erroDados}
        </p>
      )}

      <form action={atualizarTreinamento} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="id" value={treino.id} />

        <Campo label={d.admin.editar.tituloLabel}>
          <input name="titulo" required defaultValue={treino.titulo} className={inputCls} />
        </Campo>
        <Campo label={d.admin.editar.descricao}>
          <input name="descricao" defaultValue={treino.descricao} className={inputCls} />
        </Campo>
        <Campo label={d.admin.editar.cliente}>
          <select name="clienteId" defaultValue={treino.clienteId ?? ""} className={inputCls}>
            <option value="">{d.admin.editar.global}</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        {treino.tipo === "video" && (
          <Campo label={d.admin.editar.urlVideo}>
            <input name="conteudoUrl" defaultValue={treino.conteudoUrl ?? ""} className={inputCls} />
          </Campo>
        )}

        {treino.tipo === "texto" && (
          <Campo label={d.admin.editar.conteudoTexto}>
            <textarea
              name="corpo"
              rows={6}
              defaultValue={treino.corpo ?? ""}
              className={inputCls}
            />
          </Campo>
        )}

        {treino.tipo === "slides" && (
          <div>
            <span className="mb-2 block text-xs font-medium text-slate-600">{d.admin.editar.slides}</span>
            <EditorSlides
              inicial={treino.slides.map((s) => ({ titulo: s.titulo, conteudo: s.conteudo }))}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.admin.editar.salvar}
          </button>
          <Link
            href="/admin/treinamentos"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {d.admin.editar.cancelar}
          </Link>
        </div>
      </form>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
