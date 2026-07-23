import { prisma } from "@/lib/db";
import { atribuir } from "@/lib/actions";
import { formatarData } from "@/lib/status";
import { SeletorAlunos } from "@/components/SeletorAlunos";
import { getUsuarioAtual } from "@/lib/auth";
import { escopoCliente } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";

export default async function AtribuirPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const usuario = (await getUsuarioAtual())!;
  const escopo = escopoCliente(usuario);
  const d = await getDict();
  const [treinamentos, alunos, clientes, notificacoes] = await Promise.all([
    prisma.treinamento.findMany({
      // Admin de cliente atribui só os próprios treinos + os globais.
      where: escopo === null ? {} : { OR: [{ clienteId: escopo }, { clienteId: null }] },
      orderBy: { titulo: "asc" },
    }),
    // Inclui admins, não só alunos: o admin de cliente também faz os cursos e
    // precisa aparecer aqui (inclusive para se auto atribuir).
    prisma.usuario.findMany({
      where: escopo === null ? {} : { clienteId: escopo },
      include: { cliente: true },
      orderBy: { nome: "asc" },
    }),
    escopo === null
      ? prisma.cliente.findMany({ orderBy: { nome: "asc" } })
      : prisma.cliente.findMany({ where: { id: escopo }, orderBy: { nome: "asc" } }),
    prisma.notificacao.findMany({
      // Notificações também limitadas ao cliente do admin.
      where: escopo === null ? {} : { atribuicao: { usuario: { clienteId: escopo } } },
      orderBy: { enviadoEm: "desc" },
      take: 8,
      include: { atribuicao: { include: { usuario: true } } },
    }),
  ]);

  // Agrupa alunos por cliente para o seletor múltiplo.
  const grupos = [
    ...clientes.map((c) => ({
      cliente: c.nome,
      alunos: alunos.filter((a) => a.clienteId === c.id).map((a) => ({ id: a.id, nome: a.nome })),
    })),
    {
      cliente: d.admin.usuarios.semCliente,
      alunos: alunos.filter((a) => !a.clienteId).map((a) => ({ id: a.id, nome: a.nome })),
    },
  ].filter((g) => g.alunos.length > 0);

  // Prazo padrão sugerido: 7 dias a partir de agora (formato datetime-local).
  const padrao = new Date();
  padrao.setDate(padrao.getDate() + 7);
  const padraoStr = padrao.toISOString().slice(0, 16);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-xl font-semibold">{d.admin.atribuir.titulo}</h1>
        {erro === "dados" && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {d.admin.atribuir.erroDados}
          </p>
        )}
        <form
          action={atribuir}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <Campo label={d.admin.atribuir.treinamento}>
            <select name="treinamentoId" required className={inputCls} defaultValue="">
              <option value="" disabled>
                {d.admin.atribuir.selecione}
              </option>
              {treinamentos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <SeletorAlunos grupos={grupos} />
          <Campo label={d.admin.atribuir.prazoConcluir}>
            <input
              name="prazo"
              type="datetime-local"
              required
              defaultValue={padraoStr}
              className={inputCls}
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="jaConcluido" />
            {d.admin.atribuir.jaConcluido}
          </label>
          <p className="text-xs text-slate-400">{d.admin.atribuir.notaLiberacao}</p>
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.admin.atribuir.atribuir}
          </button>
        </form>
      </div>

      {/* Notificações simuladas */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {d.admin.atribuir.notificacoes}
        </h2>
        <div className="space-y-2">
          {notificacoes.map((n) => (
            <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  {n.atribuicao.usuario.nome}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {n.tipo}
                </span>
              </div>
              <p className="mt-1 text-slate-500">{n.mensagem}</p>
              <p className="mt-1 text-xs text-slate-400">{formatarData(n.enviadoEm)}</p>
            </div>
          ))}
          {notificacoes.length === 0 && (
            <p className="text-sm text-slate-400">{d.admin.atribuir.nenhumaNotif}</p>
          )}
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
