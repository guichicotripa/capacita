import { randomBytes } from "crypto";

// Convite de primeiro acesso.
//
// Por que existe: antes, o admin criava o usuário e o sistema gerava uma senha
// que só aparecia naquela tela. Ao salvar, a tela era substituída e a senha
// sumia — ela só existe como hash no banco, que é irreversível. Se o email não
// saísse (SMTP não configurado), o usuário nascia inacessível e ninguém
// conseguia recuperar a senha. Era a causa real do "não consigo acessar o
// usuário que criei".
//
// Agora o admin recebe um LINK de uso único. Ele pode copiar e mandar por
// qualquer canal; não depende de email. A pessoa abre e define a própria senha,
// então a senha nunca trafega por email nem por WhatsApp.

const DIAS_VALIDADE = 7;

export function gerarTokenConvite(): string {
  // 32 bytes = 256 bits de entropia; inviável de adivinhar.
  return randomBytes(32).toString("hex");
}

export function expiracaoConvite(): Date {
  return new Date(Date.now() + DIAS_VALIDADE * 24 * 60 * 60 * 1000);
}

export function linkConvite(token: string): string {
  const base = process.env.APP_URL || "https://capacita-rust.vercel.app";
  return `${base}/convite/${token}`;
}

// Um convite só vale se ainda tem token e não passou da validade.
export function conviteValido(u: {
  conviteToken: string | null;
  conviteExpiraEm: Date | null;
}): boolean {
  return Boolean(u.conviteToken && u.conviteExpiraEm && u.conviteExpiraEm > new Date());
}
