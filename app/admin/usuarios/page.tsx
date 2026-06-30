import { prisma } from "@/lib/db";
import { FormNovoUsuario } from "@/components/FormNovoUsuario";
import { UsuarioItem } from "@/components/UsuarioItem";

const MSG_OK: Record<string, string> = {
  criado: "Usuário criado. Email de acesso enviado (ou simulado, se o email não estiver configurado).",
  editado: "Usuário atualizado.",
  senha: "Senha redefinida. Avisamos o usuário por email.",
};
const MSG_ERRO: Record<string, string> = {
  email: "Já existe um usuário com esse email.",
  dados: "Preencha nome, email e uma senha de ao menos 8 caracteres.",
  curta: "A senha precisa ter ao menos 8 caracteres.",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;

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
          <h1 className="text-xl font-semibold">Usuários</h1>
          <p className="text-sm text-slate-500">Crie, edite e redefina o acesso dos usuários.</p>
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
          <p className="px-4 py-8 text-center text-slate-400">Nenhum usuário.</p>
        )}
      </div>
    </div>
  );
}
