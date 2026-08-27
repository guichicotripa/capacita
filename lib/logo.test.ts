// Testes da validação do logo. Rodar: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { validarLogo, normalizarCor, LOGO_MAX_BYTES } from "./logo";

const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(64)]);
const svg = (corpo: string) => Buffer.from(`<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">${corpo}</svg>`, "utf8");

const ok = (r: ReturnType<typeof validarLogo>) => {
  assert.ok(!("erro" in r), `esperava sucesso, veio ${"erro" in r ? r.erro : ""}`);
  return r as { dados: Buffer; mime: string };
};

test("aceita PNG, JPEG e WEBP pela assinatura dos bytes", () => {
  assert.equal(ok(validarLogo(png())).mime, "image/png");
  assert.equal(ok(validarLogo(jpeg())).mime, "image/jpeg");
  assert.equal(ok(validarLogo(webp())).mime, "image/webp");
});

test("aceita SVG e devolve a versão sanitizada, não o original", () => {
  const r = ok(validarLogo(svg(`<script>roubar()</script><circle cx="5" cy="5" r="4"/>`)));
  assert.equal(r.mime, "image/svg+xml");
  const texto = r.dados.toString("utf8");
  assert.doesNotMatch(texto, /script/i);
  assert.doesNotMatch(texto, /roubar/);
  assert.match(texto, /<circle/);
});

test("derruba SVG com handler de evento", () => {
  const r = ok(validarLogo(svg(`<circle cx="5" cy="5" r="4" onclick="x()"/>`)));
  assert.doesNotMatch(r.dados.toString("utf8"), /onclick/i);
});

test("aceita SVG com prólogo XML antes da tag", () => {
  const b = Buffer.from(`<?xml version="1.0"?>\n<svg viewBox="0 0 10 10"><rect x="0" y="0" width="1" height="1"/></svg>`, "utf8");
  assert.equal(ok(validarLogo(b)).mime, "image/svg+xml");
});

test("recusa arquivo que não é imagem, mesmo com extensão mentindo", () => {
  const r = validarLogo(Buffer.from("MZ\x90\x00\x03\x00\x00\x00executavel", "binary"));
  assert.deepEqual(r, { erro: "tipo" });
});

test("recusa HTML disfarçado de imagem", () => {
  const r = validarLogo(Buffer.from(`<html><body><script>alert(1)</script></body></html>`, "utf8"));
  assert.deepEqual(r, { erro: "tipo" });
});

test("recusa arquivo vazio", () => {
  assert.deepEqual(validarLogo(Buffer.alloc(0)), { erro: "vazio" });
});

test("recusa arquivo acima do limite", () => {
  const grande = Buffer.concat([png(), Buffer.alloc(LOGO_MAX_BYTES)]);
  assert.deepEqual(validarLogo(grande), { erro: "tamanho" });
});

test("normalizarCor aceita as duas formas de hex e devolve a longa", () => {
  assert.equal(normalizarCor("#4F46E5"), "#4f46e5");
  assert.equal(normalizarCor("#abc"), "#aabbcc");
  assert.equal(normalizarCor("  #FFF  "), "#ffffff");
});

test("normalizarCor rejeita qualquer coisa que não seja hex", () => {
  // A cor entra num atributo style, então texto livre aqui seria injeção de CSS.
  assert.equal(normalizarCor("red"), null);
  assert.equal(normalizarCor("#12345"), null);
  assert.equal(normalizarCor("javascript:alert(1)"), null);
  assert.equal(normalizarCor("#fff;background:url(http://mau.com)"), null);
  assert.equal(normalizarCor(""), null);
  assert.equal(normalizarCor(null), null);
});
