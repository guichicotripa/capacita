import { prisma } from "@/lib/db";
import { FormNovoUsuario } from "@/components/FormNovoUsuario";
import { UsuarioItem } from "@/components/UsuarioItem";
import { getUsuarioAtual } from "@/lib/auth";
import { ehFullAdmin, escopoCliente } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";
import { conviteValido, linkConvite } from "@/lib/convite";
import { emailRealAtivo } from "@/lib/email";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; convite?: string }>;
}) {
  const { ok, erro, convite } = await searchParams;
  const usuario = (await getUsuarioAtual())!;
  const escopo = escopoCliente(usuario);
  const full = ehFullAdmin(usuario);
  const d = await getDict();

  const MSG_OK: Record<string, string> = {
    criado: d.admin.usuarios.okCriado,
    criadoSemEmail: d.admin.usuarios.okCriadoSemEmail,
    editado: d.admin.usuarios.okEditado,
    convite: d.admin.usuarios.okConvite,
    conviteSemEmail: d.admin.usuarios.okConviteSemEmail,
    desativado: d.admin.usuarios.okDesativado,
    reativado: d.admin.usuarios.okReativado,
    excluido: d.admin.usuarios.okExcluido,
  };
  const MSG_ERRO: Record<string, string> = {
    email: d.admin.usuarios.erroEmail,
    dados: d.admin.usuarios.erroDados,
    curta: d.admin.usuarios.erroCurta,
    temHistorico: d.admin.usuarios.erroTemHistorico,
    proprioUsuario: d.admin.usuarios.erroProprioUsuario,
  };
  // Um "ok" que avisa que o email não saiu é alerta, não sucesso.
  const okEhAlerta = ok === "criadoSemEmail" || ok === "conviteSemEmail";

  const [usuarios, clientes] = await Promise.all([
    prisma.usuario.findMany({
      // Admin de cliente só vê usuários do próprio cliente.
      where: escopo === null ? {} : { clienteId: escopo },
      include: { cliente: { omit: { logo: true } } },
      orderBy: [{ ativo: "desc" }, { papel: "asc" }, { nome: "asc" }],
    }),
    // Só o full admin escolhe cliente ao criar/editar usuário.
    full ? prisma.cliente.findMany({ orderBy: { nome: "asc" } }) : Promise.resolve([]),
  ]);

  const clientesLite = clientes.map((c) => ({ id: c.id, nome: c.nome }));
  const emailAtivo = emailRealAtivo();

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{d.admin.usuarios.titulo}</h1>
          <p className="text-sm text-slate-500">{d.admin.usuarios.subtitulo}</p>
        </div>
        <FormNovoUsuario clientes={clientesLite} full={full} />
      </div>

      {/* Diagnóstico honesto: sem email configurado, o link tem que ir na mão. */}
      {!emailAtivo && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {d.admin.usuarios.emailNaoConfigurado}
        </p>
      )}

      {ok && MSG_OK[ok] && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            okEhAlerta ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"
          }`}
        >
          {MSG_OK[ok]}
        </p>
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
              telefone: u.telefone,
              cargo: u.cargo,
              ativo: u.ativo,
              clienteId: u.clienteId,
              clienteNome: u.cliente?.nome ?? null,
              // Só mostra o link enquanto o convite estiver de pé.
              linkConvite: conviteValido(u) ? linkConvite(u.conviteToken!) : null,
            }}
            clientes={clientesLite}
            full={full}
            destacarLink={String(u.id) === convite}
          />
        ))}
        {usuarios.length === 0 && (
          <p className="px-4 py-8 text-center text-slate-400">{d.admin.usuarios.nenhum}</p>
        )}
      </div>
    </div>
  );
}
