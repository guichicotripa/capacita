import { getUsuarioAtual } from "@/lib/auth";
import { ConsumoTreinamento } from "@/components/ConsumoTreinamento";

// Admin consumindo um treinamento atribuído a ele (mesma tela do aluno,
// dentro do painel admin).
export default async function MeuTreinamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nota?: string; aprovado?: string }>;
}) {
  const { id } = await params;
  const { nota, aprovado } = await searchParams;
  const usuario = (await getUsuarioAtual())!;

  return (
    <ConsumoTreinamento
      atribuicaoId={Number(id)}
      usuarioId={usuario.id}
      voltarHref="/admin/meus-treinamentos"
      nota={nota}
      aprovado={aprovado}
    />
  );
}
