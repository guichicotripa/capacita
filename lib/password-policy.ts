import { randomBytes } from "crypto";

// Política de senha (pedido do Danilo: 14+ caracteres com maiúscula, minúscula,
// dígito e caractere especial). Nota técnica: rotação/complexidade forçada é o
// padrão ISO 27001 antigo; o NIST 800-63B moderno prefere comprimento + checagem
// de vazamento. Implementado assim porque é o que o mercado de compliance espera.

export const SENHA_MIN = 14;

// Retorna a chave i18n do erro, ou null se a senha passa na política.
export function validarPolitica(senha: string): string | null {
  if (senha.length < SENHA_MIN) return "curta";
  if (!/[a-z]/.test(senha)) return "semMinuscula";
  if (!/[A-Z]/.test(senha)) return "semMaiuscula";
  if (!/[0-9]/.test(senha)) return "semDigito";
  if (!/[^A-Za-z0-9]/.test(senha)) return "semEspecial";
  return null;
}

// Gera uma senha forte que satisfaz a política, usando CSPRNG.
export function gerarSenhaForte(tamanho = 16): string {
  const minus = "abcdefghijkmnpqrstuvwxyz"; // sem l/o para evitar confusão
  const maius = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I/O
  const nums = "23456789"; // sem 0/1
  const esp = "!@#$%&*?-_+=";
  const todos = minus + maius + nums + esp;

  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  // Garante ao menos um de cada classe.
  const obrigatorios = [pick(minus), pick(maius), pick(nums), pick(esp)];
  const resto = Array.from({ length: Math.max(tamanho, SENHA_MIN) - obrigatorios.length }, () =>
    pick(todos)
  );
  const chars = [...obrigatorios, ...resto];
  // Embaralha (Fisher-Yates com CSPRNG) para não fixar as classes nas primeiras posições.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
