import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
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

  return (
    <>
      <Header nome={usuario.nome} papel="admin">
        <Link href="/admin" className="hover:text-slate-900">
          Relatório
        </Link>
        <Link href="/admin/atribuir" className="hover:text-slate-900">
          Atribuir
        </Link>
        <Link href="/admin/treinamentos" className="hover:text-slate-900">
          Treinamentos
        </Link>
        <Link href="/admin/clientes" className="hover:text-slate-900">
          Clientes
        </Link>
        <Link href="/admin/usuarios" className="hover:text-slate-900">
          Usuários
        </Link>
      </Header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
