// Sanitização de SVG vindo da IA.
//
// As ilustrações dos slides são SVG que o modelo escreve. Esse SVG é injetado
// na página com dangerouslySetInnerHTML, então é conteúdo não confiável entrando
// no DOM: sem filtro, um <script>, um onload= ou um <foreignObject> viram XSS
// dentro de uma plataforma de treinamento de segurança. Ironia cara demais.
//
// A regra é allowlist, não blocklist: só passa o que está explicitamente na
// lista. Qualquer tag ou atributo desconhecido some. É mais restritivo do que o
// necessário de propósito — ilustração de slide não precisa de mais do que isso.

const TAGS_PERMITIDAS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "use",
  "symbol",
]);

const ATRIBUTOS_PERMITIDOS = new Set([
  "viewBox",
  "xmlns",
  "width",
  "height",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "opacity",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "transform",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "clip-path",
  "mask",
  "id",
  "class",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "dx",
  "dy",
]);

// Valores que não podem aparecer em atributo nenhum, mesmo nos permitidos:
// url() externo, javascript:, data: e entidades que escondem esquema.
const VALOR_PERIGOSO = /javascript:|data:|<|&#|expression\(|url\(\s*['"]?\s*(?!#)/i;

/**
 * Devolve o SVG limpo, ou null se não sobrar nada confiável.
 * Só aceita um documento que comece por <svg>.
 */
export function sanitizarSvg(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  // Tira BOM, declaração XML e DOCTYPE ANTES de exigir a raiz <svg>: arquivo de
  // logo exportado por Illustrator/Figma começa com <?xml version="1.0"?>, e
  // checar antes disso rejeitava todo SVG de verdade. Não afrouxa a regra —
  // continua exigindo que a raiz do documento seja <svg>.
  const texto = bruto
    .replace(/^﻿/, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (!texto.toLowerCase().startsWith("<svg")) return null;
  // Limite de tamanho: ilustração de slide não passa disso, e evita que uma
  // geração descontrolada vire um payload gigante no banco e na página.
  if (texto.length > 20000) return null;

  // Remove blocos que carregam código ou conteúdo HTML aninhado, com o conteúdo.
  let s = texto.replace(
    /<\s*(script|style|foreignObject|animate\w*|set|handler|iframe|image)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  // E as versões auto-fechadas dessas mesmas tags.
  s = s.replace(/<\s*(script|style|foreignObject|animate\w*|set|handler|iframe|image)\b[^>]*\/?>/gi, "");
  // Comentários e blocos CDATA/DOCTYPE.
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");
  s = s.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");

  // Varre as tags restantes: derruba as que não estão na allowlist e filtra os
  // atributos das que ficam.
  s = s.replace(/<\s*(\/?)\s*([A-Za-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_m, fecha, tag, attrs) => {
    const nome = normalizarTag(tag);
    if (!nome) return "";
    if (fecha) return `</${nome}>`;
    const autoFecha = /\/\s*$/.test(attrs);
    return `<${nome}${filtrarAtributos(attrs)}${autoFecha ? " /" : ""}>`;
  });

  // Se sobrou algum "<" solto (tag malformada que o regex não casou), desiste:
  // melhor não renderizar do que renderizar algo que não conseguimos analisar.
  if (/<(?!\/?[A-Za-z])/.test(s)) return null;
  if (!s.trim().toLowerCase().startsWith("<svg")) return null;
  return s.trim();
}

// Compara ignorando maiúsculas, mas devolve o nome com a grafia canônica —
// SVG é case-sensitive em nomes como linearGradient e clipPath.
function normalizarTag(tag: string): string | null {
  const alvo = tag.toLowerCase();
  for (const permitida of TAGS_PERMITIDAS) {
    if (permitida.toLowerCase() === alvo) return permitida;
  }
  return null;
}

function filtrarAtributos(attrs: string): string {
  const saida: string[] = [];
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrs)) !== null) {
    const nome = m[1];
    const valor = m[3] ?? m[4] ?? m[5] ?? "";
    if (!atributoPermitido(nome)) continue;
    if (VALOR_PERIGOSO.test(valor)) continue;
    saida.push(` ${canonicoAtributo(nome)}="${escaparValor(valor)}"`);
  }
  return saida.join("");
}

function atributoPermitido(nome: string): boolean {
  // Qualquer on* (onclick, onload, onbegin…) morre aqui, antes da allowlist.
  if (/^on/i.test(nome)) return false;
  if (/^xlink:|^xmlns:/i.test(nome)) return false;
  const alvo = nome.toLowerCase();
  for (const permitido of ATRIBUTOS_PERMITIDOS) {
    if (permitido.toLowerCase() === alvo) return true;
  }
  return false;
}

function canonicoAtributo(nome: string): string {
  const alvo = nome.toLowerCase();
  for (const permitido of ATRIBUTOS_PERMITIDOS) {
    if (permitido.toLowerCase() === alvo) return permitido;
  }
  return nome;
}

function escaparValor(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
