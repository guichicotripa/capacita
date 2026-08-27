import Link from "next/link";
import { prisma } from "@/lib/db";
import { criarTreinamento } from "@/lib/actions";
import { SubirApresentacao, GerarPorTema } from "@/components/GerarComIA";
import { AbasCriacao } from "@/components/AbasCriacao";
import { IconArrowLeft } from "@/components/Icones";
import { getUsuarioAtual } from "@/lib/auth";
import { ehFullAdmin } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";

export default async function NovoTreinamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; motivo?: string }>;
}) {
  const { erro, motivo } = await searchParams;
  const usuario = (await getUsuarioAtual())!;
  const full = ehFullAdmin(usuario);
  const d = await getDict();
  // Só o admin geral escolhe o cliente; admin de cliente cria sempre no seu.
  const clientes = full ? await prisma.cliente.findMany({ orderBy: { nome: "asc" } }) : [];

  return (
    <div>
      <Link
        href="/admin/treinamentos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
      >
        <IconArrowLeft />
        {d.admin.treinos.titulo}
      </Link>
      <h1 className="mb-4 text-xl font-semibold">{d.admin.treinos.novoTitulo}</h1>

      {erro === "ia" && (
        <p className="mb-4 max-w-md rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {d.admin.treinos.erroIa}
        </p>
      )}
      {/* Falha de chamada é diferente de falta de chave: o motivo da API vem
          junto para não mandar ninguém procurar no lugar errado. */}
      {erro === "iaFalhou" && (
        <p className="mb-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          {motivo ? d.admin.treinos.erroIaFalhou(motivo) : d.admin.treinos.erroIaFalhouSemMotivo}
        </p>
      )}
      {erro === "ppt" && (
        <p className="mb-4 max-w-md rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {d.admin.treinos.erroPpt}
        </p>
      )}
      {erro === "arquivo" && (
        <p className="mb-4 max-w-md rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {d.admin.treinos.erroArquivo}
        </p>
      )}

      <AbasCriacao
        abas={[
          { titulo: d.admin.gerarIA.subirTitulo, conteudo: <SubirApresentacao clientes={clientes} /> },
          { titulo: d.admin.gerarIA.gerarTemaTitulo, conteudo: <GerarPorTema clientes={clientes} /> },
          { titulo: d.admin.treinos.novoManual, conteudo: <FormManual clientes={clientes} /> },
        ]}
      />
    </div>
  );
}

async function FormManual({ clientes }: { clientes: { id: number; nome: string }[] }) {
  const d = await getDict();
  return (
    <form action={criarTreinamento} className="max-w-md space-y-3">
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
        <input name="conteudoUrl" className={inputCls} placeholder="https://www.youtube.com/embed/..." />
      </Campo>
      <Campo label={d.admin.treinos.conteudoTexto}>
        <textarea name="corpo" rows={4} className={inputCls} />
      </Campo>
      {clientes.length > 0 && (
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
      )}
      <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
        {d.admin.treinos.criar}
      </button>
    </form>
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
