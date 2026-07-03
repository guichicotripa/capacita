import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { BotaoDesatribuir } from "@/components/BotaoDesatribuir";
import { enviarLembretesAction } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; ok?: string; n?: string; t?: string; v?: string; a?: string }>;
}) {
  const { cliente, ok, n, t: totalLembretes, v: vencLembretes, a: aVencLembretes } = await searchParams;
  const clienteId = cliente ? Number(cliente) : null;
  const d = await getDict();

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
  const pct = (x: number) => (total ? (x / total) * 100 : 0);

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{d.report.titulo}</h1>
          <p className="text-sm text-slate-500">{d.report.subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={enviarLembretesAction}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
              <IconBell />
              {d.report.enviarLembretes}
            </button>
          </form>
          <a
            href={`/admin/relatorio/export${clienteId ? `?cliente=${clienteId}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <IconDownload />
            {d.report.exportarCsv}
          </a>
          <Link
            href="/admin/atribuir"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            {d.report.atribuirTreino}
          </Link>
        </div>
      </div>

      {ok === "atribuido" && (
        <Banner tipo="ok">{d.report.atribuidoA(n ?? "")}</Banner>
      )}
      {ok === "lembretes" && (
        <Banner tipo="ok">
          {Number(totalLembretes) > 0
            ? d.report.lembretesEnviados(totalLembretes ?? "0", vencLembretes ?? "0", aVencLembretes ?? "0")
            : d.report.nenhumLembrete}
        </Banner>
      )}

      {/* Resumo: anel de conclusão + KPIs */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {d.report.visaoGeral}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <Donut pct={taxa} />
            <div>
              <p className="text-sm font-medium text-slate-700">{d.report.taxa}</p>
              <p className="mt-0.5 text-xs text-slate-400">{d.report.deConcluidos(concluidos, total)}</p>
            </div>
          </div>
          {/* Barra de distribuição */}
          <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="bg-green-500" style={{ width: `${pct(concluidos)}%` }} />
            <div className="bg-amber-400" style={{ width: `${pct(pendentes)}%` }} />
            <div className="bg-red-500" style={{ width: `${pct(vencidos)}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label={d.report.concluidos} valor={concluidos} tom="green" icone={<IconCheck />} />
          <Kpi label={d.report.pendentes} valor={pendentes} tom="amber" icone={<IconClock />} />
          <Kpi label={d.report.vencidos} valor={vencidos} tom="red" icone={<IconAlert />} />
          <Kpi label={d.report.total} valor={total} tom="slate" icone={<IconUsers />} />
        </div>
      </div>

      {/* Filtro por cliente */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FiltroLink ativo={!clienteId} href="/admin" rotulo={d.report.todosClientes} />
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{d.report.thAluno}</th>
                <th className="px-4 py-3 font-medium">{d.report.thCliente}</th>
                <th className="px-4 py-3 font-medium">{d.report.thTreino}</th>
                <th className="px-4 py-3 font-medium">{d.report.thPrazo}</th>
                <th className="px-4 py-3 font-medium">{d.report.thStatus}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comStatus.map((a) => (
                <tr key={a.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={a.usuario.nome} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{a.usuario.nome}</p>
                        <p className="truncate text-xs text-slate-400">{a.usuario.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.usuario.cliente?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{a.treinamento.titulo}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatarData(a.prazo)}</td>
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
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {d.report.nenhumaAtrib}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Anel de conclusão (SVG puro) ---
function Donut({ pct }: { pct: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const preenchido = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-slate-100" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-green-500"
          strokeDasharray={`${preenchido} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{pct}%</span>
      </div>
    </div>
  );
}

const TONS = {
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
} as const;

function Kpi({
  label,
  valor,
  tom,
  icone,
}: {
  label: string;
  valor: number;
  tom: keyof typeof TONS;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${TONS[tom]}`}>{icone}</div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

const CORES_AVATAR = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function Avatar({ nome }: { nome: string }) {
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cor = CORES_AVATAR[h % CORES_AVATAR.length];
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${cor}`}>
      {iniciais}
    </span>
  );
}

function Banner({ tipo, children }: { tipo: "ok"; children: React.ReactNode }) {
  return (
    <p
      className={`mb-4 rounded-lg px-3.5 py-2.5 text-sm ${
        tipo === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {children}
    </p>
  );
}

function FiltroLink({ ativo, href, rotulo }: { ativo: boolean; href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 transition ${
        ativo
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {rotulo}
    </Link>
  );
}

// --- Ícones (inline, stroke currentColor) ---
function IconCheck() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a1.9 1.9 0 0 0 1.7 2.9h15.8a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
