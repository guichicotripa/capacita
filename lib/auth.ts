import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";

// Sessão assinada: o cookie carrega "uid.exp.assinatura". A assinatura HMAC
// impede forjar o id de outro usuário; exp dá expiração server-side.
const COOKIE = "capacita_sess";
const PENDING_COOKIE = "capacita_mfa_pend"; // entre senha e código MFA
const MAX_AGE = 60 * 60 * 8; // 8 horas

function secret(): string {
  // Em produção, SESSION_SECRET é obrigatório. O fallback só evita quebrar em dev.
  return process.env.SESSION_SECRET || "capacita-dev-secret-trocar-em-producao";
}

function assina(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function criarToken(uid: number): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${uid}.${exp}`;
  return `${payload}.${assina(payload)}`;
}

function lerToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const esperado = assina(`${uid}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(exp)) return null;
  return Number(uid);
}

export async function getUsuarioAtual() {
  const store = await cookies();
  const uid = lerToken(store.get(COOKIE)?.value);
  if (!uid) return null;
  return prisma.usuario.findUnique({
    where: { id: uid },
    include: { cliente: true },
  });
}

export async function criarSessao(uid: number) {
  const store = await cookies();
  store.set(COOKIE, criarToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  store.delete(PENDING_COOKIE);
}

export async function encerrarSessao() {
  const store = await cookies();
  store.delete(COOKIE);
  store.delete(PENDING_COOKIE);
}

// Estado intermediário: senha OK, aguardando o código TOTP.
export async function criarMfaPendente(uid: number) {
  const store = await cookies();
  store.set(PENDING_COOKIE, criarToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 min para digitar o código
  });
}

export async function getMfaPendente(): Promise<number | null> {
  const store = await cookies();
  return lerToken(store.get(PENDING_COOKIE)?.value);
}
