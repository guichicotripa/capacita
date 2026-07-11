import { createHmac } from "crypto";

// Código de verificação do certificado: curto, determinístico e assinado (HMAC),
// para que uma futura página de verificação possa recomputar e confirmar que o
// certificado não foi adulterado. Não é sigilo, é integridade.
function secret(): string {
  return process.env.SESSION_SECRET || "capacita-dev-secret-trocar-em-producao";
}

export function codigoCertificado(atribuicaoId: number, concluidoEm: Date): string {
  const payload = `${atribuicaoId}.${concluidoEm.getTime()}`;
  const h = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 8).toUpperCase();
  return `CAP-${atribuicaoId}-${h}`;
}
