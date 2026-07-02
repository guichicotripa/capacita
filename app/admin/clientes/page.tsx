import { prisma } from "@/lib/db";
import { statusDe } from "@/lib/status";
import { getDict } from "@/lib/i18n-server";

export default async function ClientesPage() {
  const d = await getDict();
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    include: {
      usuarios: {
        where: { papel: "aluno" },
        include: { atribuicoes: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{d.admin.clientes.titulo}</h1>
      <div className="grid gap-4">
        {clientes.map((c) => {
          const totalAtrib = c.usuarios.flatMap((u) => u.atribuicoes);
          const concluidos = totalAtrib.filter((a) => statusDe(a) === "concluido").length;
          return (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{c.nome}</h2>
                <span className="text-sm text-slate-500">
                  {d.admin.clientes.resumo(c.usuarios.length, concluidos, totalAtrib.length)}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {c.usuarios.map((u) => {
                  const feitos = u.atribuicoes.filter((a) => statusDe(a) === "concluido").length;
                  return (
                    <li key={u.id} className="flex items-center justify-between py-2">
                      <span className="text-slate-700">{u.nome}</span>
                      <span className="text-slate-400">{u.email}</span>
                      <span className="text-slate-500">
                        {d.admin.clientes.treinos(feitos, u.atribuicoes.length)}
                      </span>
                    </li>
                  );
                })}
                {c.usuarios.length === 0 && (
                  <li className="py-2 text-slate-400">{d.admin.clientes.nenhumAluno}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
