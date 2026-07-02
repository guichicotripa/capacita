import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { BotaoDesatribuir } from "@/components/BotaoDesatribuir";
import { enviarLembretesAction } from "@/lib/actions";

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; ok?: string; n?: string; t?: string; v?: string; a?: string }>;
}) {
  const { cliente, ok, n, t: totalLembretes, v: vencLembretes, a: aVencLembretes } = await searchParams;
  const clienteId = cliente ? Number(cliente) : null;

  const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });

  const atribuicoes = await prisma.atribuicao.findMany({
    where: clienteId ? { usuario: { clienteId } } : {},
    include: { treinamento: true, usuario: { include: { cliente: true } } },
    orderBy: { prazo: "asc" },
  });

  const comStatus = atribuicoes.map((a) => ({ ...a, status: statusDe(a) }));
  const total = comStatus.length;
  const concluidos = comStatus.filter((a) => a.status === "concluido").length;
  const pendentes = comStatus.filter((a) => a.status === "pendente").length;
  const vencidos = comStatus.filter((a) => a.status === "vencido").length;
  const taxa = total ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Relatório de conclusão</h1>
          <p className="text-sm text-slate-500">Quem fez e quem não fez os treinamentos.</p>
        </div>
        <div className="flex gap-2">
          <form action={enviarLembretesAction}>
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Enviar lembretes
            </button>
          </form>
          <a
            href={`/admin/relatorio/export${clienteId ? `?cliente=${clienteId}` : ""}`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar CSV
          </a>
          <Link
            href="/admin/atribuir"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Atribuir treinamento
          </Link>
        </div>
      </div>

      {ok === "atribuido" && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Treinamento atribuído a {n ?? ""} aluno(s).
        </p>
      )}

      {ok === "lembretes" && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {Number(totalLembretes) > 0
            ? `${totalLembretes} lembrete(s) enviado(s): ${vencLembretes} vencido(s), ${aVencLembretes} a vencer.`
            : "Nenhum lembrete a enviar agora (ninguém vencido ou vencendo em breve, ou já avisados hoje)."}
        </p>
      )}

      {/* Cards resumo */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card titulo="Taxa de conclusão" valor={`${taxa}%`} />
        <Card titulo="Concluídos" valor={concluidos} cor="text-green-700" />
        <Card titulo="Pendentes" valor={pendentes} cor="text-amber-700" />
        <Card titulo="Vencidos" valor={vencidos} cor="text-red-700" />
      </div>

      {/* Filtro por cliente */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FiltroLink ativo={!clienteId} href="/admin" rotulo="Todos os clientes" />
        {clientes.map((c) => (
          <FiltroLink
            key={c.id}
            ativo={clienteId === c.id}
            href={`/admin?cliente=${c.id}`}
            rotulo={c.nome}
          />
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Treinamento</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comStatus.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{a.usuario.nome}</td>
                <td className="px-4 py-3 text-slate-500">{a.usuario.cliente?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{a.treinamento.titulo}</td>
                <td className="px-4 py-3 text-slate-500">{formatarData(a.prazo)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <BotaoDesatribuir
                    atribuicaoId={a.id}
                    aluno={a.usuario.nome}
                    treinamento={a.treinamento.titulo}
                  />
                </td>
              </tr>
            ))}
            {comStatus.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma atribuição.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: string | number; cor?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${cor ?? "text-slate-900"}`}>{valor}</p>
    </div>
  );
}

function FiltroLink({ ativo, href, rotulo }: { ativo: boolean; href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        ativo
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {rotulo}
    </Link>
  );
}
