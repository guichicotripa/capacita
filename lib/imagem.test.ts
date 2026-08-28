// Testes da validação de imagem de slide. Rodar: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { validarImagem, imagemDoTreino, IMAGEM_SLIDE_MAX_BYTES } from "./imagem";
import { LOGO_MAX_BYTES } from "./logo";

const png = (bytes = 64) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(bytes)]);

const ok = (r: ReturnType<typeof validarImagem>) => {
  assert.ok(!("erro" in r), `esperava sucesso, veio ${"erro" in r ? r.erro : ""}`);
  return r as { dados: Buffer; mime: string };
};

test("a imagem de slide aceita arquivo maior que o teto do logo", () => {
  const grande = png(LOGO_MAX_BYTES + 1000);
  assert.equal(ok(validarImagem(grande, IMAGEM_SLIDE_MAX_BYTES)).mime, "image/png");
  // O mesmo arquivo seria recusado como logo.
  const comoLogo = validarImagem(grande, LOGO_MAX_BYTES);
  assert.equal("erro" in comoLogo && comoLogo.erro, "tamanho");
});

test("recusa acima do teto de 1 MB", () => {
  const r = validarImagem(png(IMAGEM_SLIDE_MAX_BYTES + 1), IMAGEM_SLIDE_MAX_BYTES);
  assert.equal("erro" in r && r.erro, "tamanho");
});

test("SVG de slide também é sanitizado, não só o do logo", () => {
  const bruto = Buffer.from(
    `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>roubar()</script><rect width="4" height="4"/></svg>`,
    "utf8"
  );
  const r = ok(validarImagem(bruto, IMAGEM_SLIDE_MAX_BYTES));
  const texto = r.dados.toString("utf8");
  assert.doesNotMatch(texto, /script/i);
  assert.doesNotMatch(texto, /onload/i);
  assert.match(texto, /<rect/);
});

test("recusa arquivo que não é imagem, mesmo com nome de imagem", () => {
  const r = validarImagem(Buffer.from("%PDF-1.7\n%teste padding para passar dos 12 bytes"), IMAGEM_SLIDE_MAX_BYTES);
  assert.equal("erro" in r && r.erro, "tipo");
});

// A checagem que impede um slide de apontar para a imagem de outro treinamento.
test("só aceita id de imagem que pertence ao próprio treinamento", () => {
  const proprias = new Set([7, 9]);
  assert.equal(imagemDoTreino(7, proprias), 7);
  assert.equal(imagemDoTreino(8, proprias), null, "id de outro treino tem que virar null");
  assert.equal(imagemDoTreino(null, proprias), null);
  assert.equal(imagemDoTreino(undefined, proprias), null);
  assert.equal(imagemDoTreino("7", proprias), 7, "número em texto é id válido");
  assert.equal(imagemDoTreino("../../etc", proprias), null);
  assert.equal(imagemDoTreino(0, proprias), null);
  assert.equal(imagemDoTreino(-7, proprias), null);
  assert.equal(imagemDoTreino(7.5, proprias), null);
});
