import { validarImagem, type ErroImagem, type ImagemValidada } from "./imagem";

// Logo da empresa. As regras de segurança (sanitizar SVG, confiar no magic
// number e não na extensão) vivem em lib/imagem.ts, compartilhadas com a imagem
// de slide; aqui fica só o que é específico do logo: o teto de tamanho e a cor.

export const LOGO_MAX_BYTES = 200 * 1024; // 200 KB

export type LogoValidado = ImagemValidada;

export type ErroLogo = ErroImagem;

/**
 * Devolve os bytes prontos para salvar, ou um código de erro.
 * Para SVG, os bytes devolvidos são a versão SANITIZADA, não o original.
 */
export function validarLogo(bruto: Buffer): LogoValidado | { erro: ErroLogo } {
  return validarImagem(bruto, LOGO_MAX_BYTES);
}

// Aceita "#abc" e "#aabbcc", devolve sempre a forma longa em minúsculas.
// Qualquer outra coisa vira null: a cor entra num style, então não pode ser
// texto livre vindo do formulário.
export function normalizarCor(bruto: string | null | undefined): string | null {
  const v = String(bruto ?? "").trim().toLowerCase();
  if (!v) return null;
  const curto = /^#([0-9a-f]{3})$/.exec(v);
  if (curto) {
    const [r, g, b] = curto[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}
