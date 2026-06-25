import { prisma } from "./db";

export type TipoNotif =
  | "liberacao"
  | "lembrete"
  | "vencido"
  | "aprovado"
  | "reprovado";

// Registra a notificacao no banco e, se RESEND_API_KEY estiver configurada,
// envia um email de verdade via Resend. Sem a chave (ou sem destinatario),
// cai no modo "simulado": so registra, sem quebrar nada.
export async function notificar(opts: {
  atribuicaoId: number;
  tipo: TipoNotif;
  mensagem: string;
  emailDestino?: string | null;
  assunto?: string;
}) {
  const { atribuicaoId, tipo, mensagem, emailDestino, assunto } = opts;
  const apiKey = process.env.RESEND_API_KEY;
  let canal = "simulado";

  if (apiKey && emailDestino) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Capacita <onboarding@resend.dev>",
          to: emailDestino,
          subject: assunto || "Capacita — Notificação de treinamento",
          text: mensagem,
        }),
      });
      if (res.ok) {
        canal = "email";
      } else {
        // Nao interrompe o fluxo: registra como simulado e loga o motivo.
        console.error("Resend falhou:", res.status, await res.text());
      }
    } catch (e) {
      console.error("Erro ao enviar email via Resend:", e);
    }
  }

  await prisma.notificacao.create({
    data: { atribuicaoId, tipo, mensagem, canal },
  });

  return canal;
}

// Indica se o envio real de email esta ativo (chave configurada).
export function emailRealAtivo(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
