import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { Header } from "@/components/Header";

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.papel !== "aluno") redirect("/admin");

  return (
    <>
      <Header nome={usuario.nome} papel="aluno" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
