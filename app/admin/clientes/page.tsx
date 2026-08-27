import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { statusDe } from "@/lib/status";
import { getUsuarioAtual } from "@/lib/auth";
import { ehFullAdmin } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";
import { FormNovoCliente } from "@/components/FormNovoCliente";
import { BotaoExcluirCliente } from "@/components/BotaoExcluirCliente";
import { IdentidadeCliente } from "@/components/IdentidadeCliente";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const usuario = (await getUsuarioAtual())!;
  // Gerenciar empresas-cliente é exclusivo do admin geral.
  if (!ehFullAdmin(usuario)) redirect("/admin");
  const d = await getDict();
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    // logo NÃO entra aqui: são bytes e pesariam a listagem. Só o indicador de
    // existência, resolvido depois com uma contagem barata.
    omit: { logo: true },
    include: {
      usuarios: {
        where: { papel: "aluno" },
        include: { atribuicoes: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  // Quem tem logo, sem trazer os bytes: só os ids.
  const comLogo = new Set(
    (await prisma.cliente.findMany({ where: { logo: { not: null } }, select: { id: true } })).map(
      (c) => c.id
    )
  );

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">{d.admin.clientes.titulo}</h1>
      <div className="mb-4">
        <FormNovoCliente />
      </div>
      {ok === "criado" && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {d.admin.clientes.criadoOk}
        </p>
      )}
      {erro === "nome" && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {d.admin.clientes.erroNome}
        </p>
      )}
      {erro === "existe" && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {d.admin.clientes.erroExiste}
        </p>
      )}
      {erro === "temVinculo" && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {d.admin.clientes.erroTemVinculo}
        </p>
      )}
      {ok === "identidade" && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {d.admin.clientes.identidadeOk}
        </p>
      )}
      {erro?.startsWith("logo") && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {(d.admin.clientes as unknown as Record<string, string>)[`erroLogo${erro.slice(4)}`] ??
            d.admin.clientes.erroLogotipo}
        </p>
      )}
      {ok === "excluido" && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {d.admin.clientes.excluidoOk}
        </p>
      )}
      <div className="grid gap-4">
        {clientes.map((c) => {
          const totalAtrib = c.usuarios.flatMap((u) => u.atribuicoes);
          const concluidos = totalAtrib.filter((a) => statusDe(a) === "concluido").length;
          return (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              {/* No celular empilha: o resumo + botão excluir não cabem ao lado do nome. */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <h2 className="min-w-0 break-words font-medium">{c.nome}</h2>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span className="text-sm text-slate-500">
                    {d.admin.clientes.resumo(c.usuarios.length, concluidos, totalAtrib.length)}
                  </span>
                  <IdentidadeCliente
                    id={c.id}
                    temLogo={comLogo.has(c.id)}
                    corAtual={c.corPrimaria}
                  />
                  <BotaoExcluirCliente
                    id={c.id}
                    rotulo={d.admin.clientes.excluir}
                    confirmacao={d.admin.clientes.confirmarExcluir}
                  />
                </div>
              </div>
              {/* Cadastro da empresa: só mostra o que estiver preenchido. */}
              {[c.cnpj, c.responsavel, c.telefone, c.email, c.endereco].some(Boolean) && (
                <p className="mt-1 text-xs text-slate-400">
                  {[
                    c.cnpj && `${d.admin.clientes.cnpj}: ${c.cnpj}`,
                    c.responsavel && `${d.admin.clientes.responsavel}: ${c.responsavel}`,
                    c.telefone,
                    c.email,
                    c.endereco,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
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
