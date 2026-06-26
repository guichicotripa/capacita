import { generateSecret, generateURI, verifySync } from "otplib";

// TOTP com otplib v13 (API funcional). epochTolerance:1 aceita o código atual
// e o vizinho, tolerando pequenas diferenças de relógio.

export function gerarSegredoMfa(): string {
  return generateSecret({ length: 20 });
}

// URL otpauth:// para virar QR code (Google Authenticator, Authy, etc.).
export function otpauthUrl(email: string, segredo: string): string {
  return generateURI({
    strategy: "totp",
    issuer: "Capacita",
    label: email,
    secret: segredo,
  });
}

export function verificarCodigoMfa(codigo: string, segredo: string): boolean {
  try {
    const res = verifySync({
      strategy: "totp",
      secret: segredo,
      token: codigo.trim(),
      epochTolerance: 1,
    });
    return Boolean(res?.valid);
  } catch {
    return false;
  }
}
