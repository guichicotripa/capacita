import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { ehFullAdmin } from "@/lib/escopo";
import { Header } from "@/components/Header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.senhaTemporaria) redirect("/trocar-senha");
  if (usuario.papel !== "admin") redirect("/aluno");
  const d = await getDict();
  const full = ehFullAdmin(usuario);

  return (
    <>
      <Header
        nome={usuario.nome}
        papel="admin"
        clienteId={usuario.cliente?.logoMime ? usuario.clienteId : null}
        clienteNome={usuario.cliente?.nome}
      >
        <Link href="/admin" className="hover:text-slate-900">
          {d.nav.relatorio}
        </Link>
        <Link href="/admin/atribuir" className="hover:text-slate-900">
          {d.nav.atribuir}
        </Link>
        <Link href="/admin/treinamentos" className="hover:text-slate-900">
          {d.nav.treinamentos}
        </Link>
        {/* Só o admin geral cria/gerencia empresas-cliente. */}
        {full && (
          <Link href="/admin/clientes" className="hover:text-slate-900">
            {d.nav.clientes}
          </Link>
        )}
        <Link href="/admin/usuarios" className="hover:text-slate-900">
          {d.nav.usuarios}
        </Link>
        <Link href="/admin/meus-treinamentos" className="hover:text-slate-900">
          {d.nav.meusTreinamentos}
        </Link>
      </Header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
