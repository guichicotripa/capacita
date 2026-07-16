import { prisma } from "./db";
import nodemailer from "nodemailer";

// Envio de email com três camadas, nesta ordem de preferência:
// 1. SMTP próprio (ex: Zoho do domínio do cliente) — melhor deliverability e branding.
// 2. Resend (API HTTP) — fallback se não houver SMTP configurado.
// 3. Simulado — sem nenhum dos dois: só registra, não quebra o fluxo.

// --- Camada SMTP ---------------------------------------------------------

// Configurado por env: SMTP_HOST, SMTP_PORT (465 SSL ou 587 STARTTLS),
// SMTP_USER, SMTP_PASS e opcionalmente SMTP_FROM / SMTP_SECURE.
function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let _transporter: nodemailer.Transporter | null = null;
function transporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  // 465 = SSL implícito (secure=true); 587 = STARTTLS (secure=false, upgrade automático).
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _transporter;
}

function remetente(): string {
  return (
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    `Capacita <${process.env.SMTP_USER}>`
  );
}

async function enviarViaSmtp(
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  try {
    await transporter().sendMail({ from: remetente(), to, subject, text });
    return true;
  } catch (e) {
    console.error("Envio SMTP falhou:", e);
    return false;
  }
}

// --- Camada Resend -------------------------------------------------------

async function enviarViaResend(
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.Resend_key;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Capacita <onboarding@resend.dev>",
        to,
        subject,
        text,
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

// --- API pública ---------------------------------------------------------

// Envia um email de verdade se SMTP ou Resend estiverem configurados. Retorna
// true se saiu de verdade, false se caiu no modo simulado (sem transporte/destino).
// Não cria registro de Notificacao — serve para emails sem atribuição
// (boas-vindas, redefinição de senha).
export async function enviarEmail(
  emailDestino: string | null | undefined,
  assunto: string,
  mensagem: string
): Promise<boolean> {
  if (!emailDestino) return false;
  if (smtpConfigurado()) return enviarViaSmtp(emailDestino, assunto, mensagem);
  return enviarViaResend(emailDestino, assunto, mensagem);
}

export type TipoNotif =
  | "liberacao"
  | "lembrete"
  | "vencido"
  | "aprovado"
  | "reprovado";

// Registra a notificacao no banco e, se houver transporte configurado (SMTP ou
// Resend), envia um email de verdade. Sem transporte (ou sem destinatario), cai
// no modo "simulado": so registra, sem quebrar nada.
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

// Indica se o envio real de email esta ativo (SMTP ou Resend configurado).
export function emailRealAtivo(): boolean {
  return smtpConfigurado() || Boolean(process.env.RESEND_API_KEY || process.env.Resend_key);
}
