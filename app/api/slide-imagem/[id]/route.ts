import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { podeVerTreino } from "@/lib/escopo";

// Serve a imagem que o admin subiu para um slide.
//
// Autenticação não basta aqui: material de treinamento de um cliente não pode
// ser lido por gente de outro cliente só chutando o id. Vê quem tem o
// treinamento atribuído, ou o admin dentro do escopo dele.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const { id } = await params;
  const imagem = await prisma.imagemSlide.findUnique({
    where: { id: Number(id) },
    select: {
      mime: true,
      dados: true,
      treinamentoId: true,
      treinamento: { select: { clienteId: true } },
    },
  });
  if (!imagem) {
    // Sem no-store, um 404 em cache manteria a imagem "ausente" na prévia mesmo
    // depois de o admin subir uma.
    return new Response("Não encontrado", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const ehAdminDoEscopo =
    usuario.papel === "admin" && podeVerTreino(imagem.treinamento, usuario);
  const podeVer =
    ehAdminDoEscopo ||
    (await prisma.atribuicao.count({
      where: { treinamentoId: imagem.treinamentoId, usuarioId: usuario.id },
    })) > 0;
  if (!podeVer) return new Response("Sem acesso", { status: 403 });

  const bytes = new Uint8Array(imagem.dados);
  const etag = `"${createHash("sha1").update(bytes).digest("hex").slice(0, 16)}"`;

  // Mesmo raciocínio da rota do logo: no-cache (não no-store) guarda no
  // navegador mas revalida, e o ETag faz a revalidação voltar 304 sem corpo.
  const headers = {
    "Content-Type": imagem.mime,
    "Cache-Control": "private, no-cache",
    ETag: etag,
    // O SVG já entra sanitizado no banco; isto é a segunda barreira.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(bytes, { headers });
}
