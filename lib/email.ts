import { prisma } from "./db";

// Envia um email via Resend, se a chave estiver configurada. Retorna true se
// foi enviado de verdade, false se caiu no modo simulado (sem chave/destino).
// Não cria registro de Notificacao — serve para emails sem atribuição
// (boas-vindas, redefinição de senha).
export async function enviarEmail(
  emailDestino: string | null | undefined,
  assunto: string,
  mensagem: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.Resend_key;
  if (!apiKey || !emailDestino) return false;
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
        subject: assunto,
        text: mensagem,
      }),
    });
    if (res.ok) return true;
    console.error("Resend falhou:", res.status, await res.text());
    return false;
  } catch (e) {
    console.error("Erro ao enviar email via Resend:", e);
    return false;
  }
}

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

  const enviado = await enviarEmail(
    emailDestino,
    assunto || "Capacita — Notificação de treinamento",
    mensagem
  );
  const canal = enviado ? "email" : "simulado";

  await prisma.notificacao.create({
    data: { atribuicaoId, tipo, mensagem, canal },
  });

  return canal;
}

// Indica se o envio real de email esta ativo (chave configurada).
export function emailRealAtivo(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.Resend_key);
}
