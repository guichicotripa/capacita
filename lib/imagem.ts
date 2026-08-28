import { sanitizarSvg } from "./svg";

// Validação de imagem enviada por usuário (logo da empresa, imagem de slide).
//
// Imagem enviada por usuário é servida de volta pelo NOSSO domínio, então dois
// cuidados não podem faltar:
//
// 1. SVG é código, não imagem. Um <script> ou onload= dentro de um .svg vira XSS
//    quando o arquivo é servido daqui. Passa pelo sanitizador (lib/svg.ts) e é
//    REESCRITO com o resultado limpo — o original nunca é gravado.
// 2. A extensão e o Content-Type do navegador não são confiáveis. Conferimos a
//    assinatura dos bytes (magic number) e é ela que define o mime salvo.
//
// Este módulo é a única implementação dessas duas regras: logo e imagem de slide
// só mudam o tamanho máximo.

// Teto da imagem de slide. Maior que o do logo (200 KB) porque aqui cabe foto e
// print de tela; menor que o do PDF porque são várias por curso e ficam dentro
// do Postgres (ver a dívida conhecida no README).
export const IMAGEM_SLIDE_MAX_BYTES = 1024 * 1024; // 1 MB

export type ImagemValidada = { dados: Buffer; mime: string };

export type ErroImagem = "tipo" | "tamanho" | "vazio" | "svgInseguro";

// Assinaturas dos formatos aceitos. Ordem importa: WEBP também começa com RIFF.
export function detectarMime(b: Buffer): string | null {
  if (b.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // WEBP: "RIFF" .... "WEBP"
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  // SVG é texto: procura a tag no começo, tolerando BOM, espaços e prólogo XML.
  const inicio = b.toString("utf8", 0, Math.min(b.length, 1024)).trimStart();
  const semProlgo = inicio.replace(/^﻿/, "").replace(/^<\?xml[^>]*\?>\s*/i, "");
  if (/^<svg[\s>]/i.test(semProlgo) || /^<!DOCTYPE svg/i.test(semProlgo)) return "image/svg+xml";
  return null;
}

/**
 * Aceita o id de imagem que veio no JSON do editor só se ele for uma imagem
 * DESTE treinamento. Sem isso, trocar o número no JSON apontaria um slide para
 * a imagem de um treino de outro cliente.
 */
export function imagemDoTreino(
  imagemId: unknown,
  proprias: ReadonlySet<number>
): number | null {
  const n = Number(imagemId);
  if (!Number.isInteger(n) || n <= 0) return null;
  return proprias.has(n) ? n : null;
}

/**
 * Devolve os bytes prontos para salvar, ou um código de erro.
 * Para SVG, os bytes devolvidos são a versão SANITIZADA, não o original.
 */
export function validarImagem(
  bruto: Buffer,
  maxBytes: number
): ImagemValidada | { erro: ErroImagem } {
  if (bruto.length === 0) return { erro: "vazio" };
  if (bruto.length > maxBytes) return { erro: "tamanho" };

  const mime = detectarMime(bruto);
  if (!mime) return { erro: "tipo" };

  if (mime === "image/svg+xml") {
    const limpo = sanitizarSvg(bruto.toString("utf8"));
    if (!limpo) return { erro: "svgInseguro" };
    return { dados: Buffer.from(limpo, "utf8"), mime };
  }

  return { dados: bruto, mime };
}
