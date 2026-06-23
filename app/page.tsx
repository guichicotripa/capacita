import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";

export default async function Home() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  redirect(usuario.papel === "admin" ? "/admin" : "/aluno");
}
