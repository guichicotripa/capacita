// Testes da escolha de perguntas por tentativa. Rodar: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { perguntasDaTentativa } from "./quiz";

const banco = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
const ids = (xs: { id: number }[]) => xs.map((x) => x.id);

test("devolve a quantidade pedida", () => {
  assert.equal(perguntasDaTentativa(banco, 5, 1, 0).length, 5);
});

test("mesma tentativa devolve sempre o mesmo conjunto (recarregar não muda a prova)", () => {
  assert.deepEqual(ids(perguntasDaTentativa(banco, 5, 42, 0)), ids(perguntasDaTentativa(banco, 5, 42, 0)));
});

test("não repete pergunta dentro da mesma tentativa", () => {
  const r = ids(perguntasDaTentativa(banco, 5, 7, 3));
  assert.equal(new Set(r).size, r.length);
});

test("tentativas consecutivas não repetem nenhuma pergunta", () => {
  const a = new Set(ids(perguntasDaTentativa(banco, 5, 42, 0)));
  const b = ids(perguntasDaTentativa(banco, 5, 42, 1));
  assert.deepEqual(b.filter((id) => a.has(id)), []);
});

test("pessoas diferentes no mesmo treinamento não recebem a mesma prova", () => {
  const a = ids(perguntasDaTentativa(banco, 5, 1, 0));
  const b = ids(perguntasDaTentativa(banco, 5, 2, 0));
  assert.notDeepEqual(a, b);
});

test("só usa perguntas do banco informado", () => {
  const r = perguntasDaTentativa(banco, 5, 9, 1);
  assert.ok(r.every((p) => banco.includes(p)));
});

test("banco menor que a prova usa o banco inteiro", () => {
  const pequeno = [{ id: 1 }, { id: 2 }];
  assert.equal(perguntasDaTentativa(pequeno, 5, 1, 0).length, 2);
});

test("banco vazio não quebra", () => {
  assert.deepEqual(perguntasDaTentativa([], 5, 1, 0), []);
});

test("ao longo das tentativas o banco inteiro é exercitado", () => {
  const vistos = new Set<number>();
  for (let t = 0; t < 10; t++) {
    for (const id of ids(perguntasDaTentativa(banco, 5, 3, t))) vistos.add(id);
  }
  assert.equal(vistos.size, banco.length);
});

test("nunca devolve buraco, mesmo dando a volta no banco", () => {
  for (let t = 0; t < 30; t++) {
    const r = perguntasDaTentativa(banco, 5, 11, t);
    assert.equal(r.length, 5);
    assert.ok(r.every(Boolean), `tentativa ${t} devolveu item vazio`);
  }
});
