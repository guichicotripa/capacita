import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";

// Serve os bytes do PDF/PPTX original. Só para usuários autenticados.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const { id } = await params;
  const arq = await prisma.arquivo.findUnique({
    where: { treinamentoId: Number(id) },
  });
  if (!arq) return new Response("Não encontrado", { status: 404 });

  return new Response(new Uint8Array(arq.dados), {
    headers: {
      "Content-Type": arq.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(arq.nomeOriginal)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
