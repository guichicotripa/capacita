import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";

// Serve o logo da empresa. Só para usuários autenticados: o logo aparece em
// tela de aluno e no certificado, e não há motivo para ser público.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autenticado", { status: 401 });

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id: Number(id) },
    select: { logo: true, logoMime: true },
  });
  if (!cliente?.logo || !cliente.logoMime) {
    // Sem no-store aqui, um 404 em cache manteria o logo "ausente" mesmo depois
    // de o admin subir um.
    return new Response("Não encontrado", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const bytes = new Uint8Array(cliente.logo);
  const etag = `"${createHash("sha1").update(bytes).digest("hex").slice(0, 16)}"`;

  // no-cache (não é no-store): o navegador guarda, mas confirma antes de usar.
  // Com ETag a confirmação volta 304 sem corpo. Cache cego com max-age fazia o
  // logo antigo continuar aparecendo por minutos depois de trocado ou removido.
  const headers = {
    "Content-Type": cliente.logoMime,
    "Cache-Control": "private, no-cache",
    ETag: etag,
    // O SVG já foi sanitizado antes de entrar no banco; isto é a segunda
    // barreira, caso algum dia entre por outro caminho.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(bytes, { headers });
}
