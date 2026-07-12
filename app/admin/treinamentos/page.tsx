import Link from "next/link";
import { prisma } from "@/lib/db";
import { BotaoRemover } from "@/components/BotaoRemover";
import { IconChartBar, IconChecklist, IconEye, IconPencil, IconPlus } from "@/components/Icones";
import { getUsuarioAtual } from "@/lib/auth";
import { escopoCliente, podeEditarTreino } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";

export default async function TreinamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const usuario = (await getUsuarioAtual())!;
  const escopo = escopoCliente(usuario);
  const d = await getDict();
  const treinamentos = await prisma.treinamento.findMany({
    // Admin de cliente vê os treinos do próprio cliente + os globais.
    where: escopo === null ? {} : { OR: [{ clienteId: escopo }, { clienteId: null }] },
    include: {
      cliente: true,
      _count: { select: { atribuicoes: true, perguntas: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{d.admin.treinos.titulo}</h1>
        <Link
          href="/admin/treinamentos/novo"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <IconPlus />
          {d.admin.treinos.novaCapacitacao}
        </Link>
      </div>

      {ok === "editado" && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {d.admin.treinos.atualizadoOk}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-2.5">{d.admin.treinos.colNome}</th>
              <th className="px-4 py-2.5">{d.admin.treinos.colCliente}</th>
              <th className="px-4 py-2.5">{d.admin.treinos.colAtribuicoes}</th>
              <th className="px-4 py-2.5 text-right">{d.admin.treinos.colAcoes}</th>
            </tr>
          </thead>
          <tbody>
            {treinamentos.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{t.titulo}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {t.tipo === "video"
                        ? d.admin.treinos.tipoVideo
                        : t.tipo === "slides"
                          ? d.admin.treinos.tipoSlides
                          : t.tipo === "arquivo"
                            ? d.admin.treinos.tipoApresentacao
                            : d.admin.treinos.tipoTexto}
                    </span>
                    {t.geradoPorIa && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">IA</span>
                    )}
                    {t._count.perguntas > 0 && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                        {d.admin.treinos.quiz(t._count.perguntas)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{t.descricao}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {t.cliente ? t.cliente.nome : d.admin.treinos.global}
                </td>
                <td className="px-4 py-3 text-slate-500">{t._count.atribuicoes}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <IconLink
                      href={`/admin/treinamentos/${t.id}/preview`}
                      titulo={d.admin.treinos.previsualizar}
                    >
                      <IconEye />
                    </IconLink>
                    {/* Editar/quiz/remover só para treinos que este admin pode editar. */}
                    {podeEditarTreino(t, usuario) && (
                      <>
                        <IconLink href={`/admin/treinamentos/${t.id}/editar`} titulo={d.admin.treinos.editar}>
                          <IconPencil />
                        </IconLink>
                        <IconLink
                          href={`/admin/treinamentos/${t.id}/quiz`}
                          titulo={t._count.perguntas > 0 ? d.admin.treinos.editarQuiz : d.admin.treinos.addQuiz}
                        >
                          <IconChecklist />
                        </IconLink>
                      </>
                    )}
                    <IconLink
                      href={`/admin/treinamentos/${t.id}/resultados`}
                      titulo={d.admin.treinos.resultados}
                      destaque={t._count.perguntas > 0}
                    >
                      <IconChartBar />
                    </IconLink>
                    {podeEditarTreino(t, usuario) && (
                      <BotaoRemover treinamentoId={t.id} titulo={t.titulo} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {treinamentos.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400">{d.admin.treinos.nenhum}</p>
        )}
      </div>
    </div>
  );
}

function IconLink({
  href,
  titulo,
  destaque,
  children,
}: {
  href: string;
  titulo: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={titulo}
      aria-label={titulo}
      className={`rounded p-1 ${
        destaque ? "text-blue-600 hover:bg-blue-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      }`}
    >
      {children}
    </Link>
  );
}
