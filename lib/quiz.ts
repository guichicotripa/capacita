// Escolha das perguntas de uma tentativa.
//
// O treinamento guarda um banco (ex: 12 perguntas) e cada tentativa mostra só
// um subconjunto (ex: 5). Quem reprova pega perguntas diferentes na próxima,
// em vez de repetir a mesma prova depois de já ter errado.
//
// Como funciona: o banco é embaralhado UMA vez por atribuição (ordem estável,
// diferente para cada pessoa) e cada tentativa lê uma janela seguinte dessa
// ordem, dando a volta no fim. Sorteio puramente aleatório a cada tentativa
// repetia perguntas demais: com banco de 12 e prova de 5, deu 4 repetidas na
// segunda tentativa. Com a janela deslizante, tentativas consecutivas não se
// sobrepõem enquanto o banco tiver pelo menos o dobro do tamanho da prova.
//
// É DETERMINÍSTICO a partir de (atribuição, tentativa): recarregar a página no
// meio da prova devolve as mesmas perguntas, e não dá para ficar atualizando
// até cair um conjunto mais fácil.

// PRNG pequeno e estável (mulberry32). Não é criptográfico e não precisa ser:
// só queremos um embaralhamento reproduzível.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordem fixa do banco para uma atribuição. Duas pessoas no mesmo treinamento
// recebem ordens diferentes, então não dá para colar em quem já fez.
function ordemDaAtribuicao<T>(banco: T[], atribuicaoId: number): T[] {
  const rand = prng((atribuicaoId * 73856093) >>> 0);
  const copia = [...banco];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function perguntasDaTentativa<T>(
  banco: T[],
  quantas: number,
  atribuicaoId: number,
  tentativa: number
): T[] {
  if (banco.length === 0) return [];
  const n = Math.min(Math.max(1, Math.floor(quantas)), banco.length);
  const ordem = ordemDaAtribuicao(banco, atribuicaoId);
  const inicio = ((tentativa % banco.length) * n) % banco.length;
  // Janela circular: no fim do banco, volta para o começo da mesma ordem.
  return Array.from({ length: n }, (_, k) => ordem[(inicio + k) % banco.length]);
}
