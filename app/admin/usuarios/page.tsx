import { prisma } from "@/lib/db";
import { FormNovoUsuario } from "@/components/FormNovoUsuario";
import { UsuarioItem } from "@/components/UsuarioItem";
import { getDict } from "@/lib/i18n-server";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const d = await getDict();

  const MSG_OK: Record<string, string> = {
    criado: d.admin.usuarios.okCriado,
    editado: d.admin.usuarios.okEditado,
    senha: d.admin.usuarios.okSenha,
  };
  const MSG_ERRO: Record<string, string> = {
    email: d.admin.usuarios.erroEmail,
    dados: d.admin.usuarios.erroDados,
    curta: d.admin.usuarios.erroCurta,
  };

  const [usuarios, clientes] = await Promise.all([
    prisma.usuario.findMany({
      include: { cliente: true },
      orderBy: [{ papel: "asc" }, { nome: "asc" }],
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
  ]);

  const clientesLite = clientes.map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{d.admin.usuarios.titulo}</h1>
          <p className="text-sm text-slate-500">{d.admin.usuarios.subtitulo}</p>
        </div>
        <FormNovoUsuario clientes={clientesLite} />
      </div>

      {ok && MSG_OK[ok] && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{MSG_OK[ok]}</p>
      )}
      {erro && MSG_ERRO[erro] && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{MSG_ERRO[erro]}</p>
      )}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {usuarios.map((u) => (
          <UsuarioItem
            key={u.id}
            usuario={{
              id: u.id,
              nome: u.nome,
              email: u.email,
              papel: u.papel,
              clienteId: u.clienteId,
              clienteNome: u.cliente?.nome ?? null,
            }}
            clientes={clientesLite}
          />
        ))}
        {usuarios.length === 0 && (
          <p className="px-4 py-8 text-center text-slate-400">{d.admin.usuarios.nenhum}</p>
        )}
      </div>
    </div>
  );
}
