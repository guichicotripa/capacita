// Teste único da geração por IA. Roda com:
//   node --import tsx --env-file=.env.local scripts/test-ia.ts
import { gerarCursoIA, iaDisponivel } from "../lib/ai";

async function main() {
  if (!iaDisponivel()) {
    console.error("Sem chave da Anthropic no ambiente.");
    process.exit(1);
  }
  const inicio = Date.now();
  const curso = await gerarCursoIA("Reconhecendo golpes de phishing por email");
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`\nGerado em ${seg}s`);
  console.log("Título:", curso.titulo);
  console.log("Descrição:", curso.descricao);
  console.log("Corpo (início):", curso.corpo.slice(0, 160), "...");
  console.log("Perguntas:", curso.perguntas.length);
  curso.perguntas.forEach((p, i) => {
    const corretas = p.alternativas.filter((a) => a.correta).length;
    console.log(`  ${i + 1}. ${p.enunciado}  [${p.alternativas.length} alt, ${corretas} correta]`);
  });
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
