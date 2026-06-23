import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AlunoHome() {
  const usuario = (await getUsuarioAtual())!;

  const atribuicoes = await prisma.atribuicao.findMany({
    where: { usuarioId: usuario.id },
    include: { treinamento: true },
    orderBy: { prazo: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Meus treinamentos</h1>
      <p className="mb-6 text-sm text-slate-500">
        {usuario.cliente ? `${usuario.cliente.nome} · ` : ""}
        {usuario.nome}
      </p>

      {atribuicoes.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum treinamento atribuído a você.</p>
      )}

      <div className="grid gap-3">
        {atribuicoes.map((a) => {
          const status = statusDe(a);
          const bloqueado = status === "vencido";
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{a.treinamento.titulo}</h2>
                  <StatusBadge status={status} />
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{a.treinamento.descricao}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Prazo: {formatarData(a.prazo)}
                  {a.concluidoEm && ` · Concluído em ${formatarData(a.concluidoEm)}`}
                </p>
              </div>
              {bloqueado ? (
                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-400">
                  Acesso encerrado
                </span>
              ) : (
                <Link
                  href={`/aluno/${a.id}`}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {status === "concluido" ? "Revisar" : "Abrir"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
