import { sanitizarSvg } from "./svg";

// Validação do logo enviado pelo admin.
//
// Logo é conteúdo enviado por usuário que depois é servido de volta e exibido
// em quase toda tela daquele cliente. Dois cuidados que não podem faltar:
//
// 1. SVG é código, não imagem. Um <script> ou onload= dentro de um .svg vira XSS
//    quando o arquivo é servido do nosso domínio. Passa pelo mesmo sanitizador
//    das ilustrações da IA (lib/svg.ts) e é REESCRITO com o resultado limpo.
// 2. A extensão e o Content-Type do navegador não são confiáveis. Conferimos a
//    assinatura dos bytes (magic number) e é ela que define o mime salvo.

export const LOGO_MAX_BYTES = 200 * 1024; // 200 KB

export type LogoValidado = { dados: Buffer; mime: string };

export type ErroLogo = "tipo" | "tamanho" | "vazio" | "svgInseguro";

// Assinaturas dos formatos aceitos. Ordem importa: WEBP também começa com RIFF.
function detectarMime(b: Buffer): string | null {
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
 * Devolve os bytes prontos para salvar, ou um código de erro.
 * Para SVG, os bytes devolvidos são a versão SANITIZADA, não o original.
 */
export function validarLogo(bruto: Buffer): LogoValidado | { erro: ErroLogo } {
  if (bruto.length === 0) return { erro: "vazio" };
  if (bruto.length > LOGO_MAX_BYTES) return { erro: "tamanho" };

  const mime = detectarMime(bruto);
  if (!mime) return { erro: "tipo" };

  if (mime === "image/svg+xml") {
    const limpo = sanitizarSvg(bruto.toString("utf8"));
    if (!limpo) return { erro: "svgInseguro" };
    return { dados: Buffer.from(limpo, "utf8"), mime };
  }

  return { dados: bruto, mime };
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
