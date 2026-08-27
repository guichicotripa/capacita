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
  if (usuario.senhaTemporaria) redirect("/trocar-senha");
  if (usuario.papel !== "aluno") redirect("/admin");

  return (
    <>
      <Header
        nome={usuario.nome}
        papel="aluno"
        clienteId={usuario.cliente?.logoMime ? usuario.clienteId : null}
        clienteNome={usuario.cliente?.nome}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
