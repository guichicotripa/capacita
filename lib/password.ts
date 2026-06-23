import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Hash de senha com scrypt (nativo do Node, sem dependencia externa).
// Formato armazenado: "salt:hash", ambos em hex.

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, armazenado: string): boolean {
  const [salt, hash] = armazenado.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(senha, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}
