// Testes do sanitizador de SVG. Rodar: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { sanitizarSvg } from "./svg";

const limpo = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#334155"/></svg>`;

test("deixa passar um SVG simples e válido", () => {
  const r = sanitizarSvg(limpo);
  assert.ok(r);
  assert.match(r!, /<circle/);
  assert.match(r!, /viewBox="0 0 100 100"/);
});

test("remove <script> junto com o conteúdo", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10"><script>alert(document.cookie)</script><rect x="0" y="0" width="5" height="5"/></svg>`
  );
  assert.ok(r);
  assert.doesNotMatch(r!, /script/i);
  assert.doesNotMatch(r!, /alert/);
  assert.match(r!, /<rect/);
});

test("remove handlers de evento (onload, onclick, onbegin)", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10" onload="fetch('//mau.com')"><circle cx="1" cy="1" r="1" onclick="roubar()"/></svg>`
  );
  assert.ok(r);
  assert.doesNotMatch(r!, /onload/i);
  assert.doesNotMatch(r!, /onclick/i);
  assert.doesNotMatch(r!, /mau\.com/);
});

test("remove <foreignObject> (rota de HTML arbitrário dentro do SVG)", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject><rect x="0" y="0" width="1" height="1"/></svg>`
  );
  assert.ok(r);
  assert.doesNotMatch(r!, /foreignObject/i);
  assert.doesNotMatch(r!, /onerror/i);
});

test("remove <image> (carrega recurso externo)", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10"><image href="https://rastreador.com/p.png" x="0" y="0"/><rect x="0" y="0" width="1" height="1"/></svg>`
  );
  assert.ok(r);
  assert.doesNotMatch(r!, /rastreador\.com/);
  assert.doesNotMatch(r!, /<image/i);
});

test("derruba javascript: e data: em atributo permitido", () => {
  const r = sanitizarSvg(`<svg viewBox="0 0 10 10"><rect fill="url(javascript:alert(1))" x="0" y="0" width="1" height="1"/></svg>`);
  assert.ok(r);
  assert.doesNotMatch(r!, /javascript:/i);
});

test("mantém url(#id) interno, que é referência legítima a gradiente", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect fill="url(#g)" x="0" y="0" width="1" height="1"/></svg>`
  );
  assert.ok(r);
  assert.match(r!, /url\(#g\)/);
  assert.match(r!, /linearGradient/);
});

test("preserva a grafia de tags case-sensitive", () => {
  const r = sanitizarSvg(
    `<svg viewBox="0 0 10 10"><defs><clipPath id="c"><rect x="0" y="0" width="1" height="1"/></clipPath></defs></svg>`
  );
  assert.ok(r);
  assert.match(r!, /clipPath/);
});

test("remove tag desconhecida mas mantém o resto", () => {
  const r = sanitizarSvg(`<svg viewBox="0 0 10 10"><blink></blink><circle cx="1" cy="1" r="1"/></svg>`);
  assert.ok(r);
  assert.doesNotMatch(r!, /blink/);
  assert.match(r!, /<circle/);
});

test("aceita SVG com declaração XML e DOCTYPE antes da raiz", () => {
  // É como Illustrator e Figma exportam. Rejeitar isso derrubava todo logo real.
  const r = sanitizarSvg(
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`
  );
  assert.ok(r);
  assert.match(r!, /<circle/);
  assert.doesNotMatch(r!, /DOCTYPE/i);
  assert.doesNotMatch(r!, /<\?xml/i);
});

test("prólogo XML não vira brecha: HTML com prólogo continua recusado", () => {
  assert.equal(sanitizarSvg(`<?xml version="1.0"?><html><script>alert(1)</script></html>`), null);
});

test("recusa conteúdo que não começa com <svg>", () => {
  assert.equal(sanitizarSvg(`<div onclick="x()">oi</div>`), null);
  assert.equal(sanitizarSvg(`alert(1)`), null);
});

test("recusa vazio e nulo", () => {
  assert.equal(sanitizarSvg(""), null);
  assert.equal(sanitizarSvg(null), null);
  assert.equal(sanitizarSvg(undefined), null);
});

test("recusa SVG absurdamente grande", () => {
  assert.equal(sanitizarSvg(`<svg viewBox="0 0 1 1">${"<rect/>".repeat(5000)}</svg>`), null);
});

test("não sobra nenhum '<' solto no resultado", () => {
  const r = sanitizarSvg(limpo);
  assert.ok(r);
  assert.doesNotMatch(r!, /<(?!\/?[A-Za-z])/);
});
