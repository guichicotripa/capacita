import { NextRequest, NextResponse } from "next/server";
import { enviarLembretes } from "@/lib/lembretes";

// Endpoint do cron diário (configurado em vercel.json). A Vercel envia o header
// Authorization: Bearer <CRON_SECRET> quando CRON_SECRET está setado no projeto.
// Sem o secret (dev local), permite rodar para facilitar teste.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  const r = await enviarLembretes();
  return NextResponse.json({ ok: true, ...r });
}
