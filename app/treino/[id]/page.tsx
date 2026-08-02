import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { ConsumoTreinamento } from "@/components/ConsumoTreinamento";
import { FecharJanela } from "@/components/FecharJanela";

// Capacitação em tela cheia, sem cabeçalho nem menu. É a rota que a página
// normal abre em outra janela: fica fora de /aluno e /admin de propósito,
// porque são esses layouts que trazem o Header.
export default async function TreinoEmJanelaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nota?: string; aprovado?: string }>;
}) {
  const { id } = await params;
  const { nota, aprovado } = await searchParams;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.senhaTemporaria) redirect("/trocar-senha");

  const lista = usuario.papel === "admin" ? "/admin/meus-treinamentos" : "/aluno";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <ConsumoTreinamento
        atribuicaoId={Number(id)}
        usuarioId={usuario.id}
        voltarHref={lista}
        nota={nota}
        aprovado={aprovado}
        emJanela
        acaoVoltar={<FecharJanela voltarHref={lista} />}
      />
    </main>
  );
}
