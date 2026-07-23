import Anthropic from "@anthropic-ai/sdk";

// Geração de curso por IA. Só funciona com a chave da Anthropic configurada;
// aceita o nome padrão ANTHROPIC_API_KEY ou ANTHROPIC_KEY. Sem chave,
// iaDisponivel() retorna false e a UI mostra o aviso.

function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
}

export function iaDisponivel(): boolean {
  return Boolean(anthropicKey());
}

export type CursoGerado = {
  titulo: string;
  descricao: string;
  slides: { titulo: string; conteudo: string }[];
  perguntas: {
    enunciado: string;
    alternativas: { texto: string; correta: boolean }[];
  }[];
};

// "topicos" = bullets curtos (padrão). "prosa" = parágrafos descritivos, para
// quando o admin quer conteúdo explicado e não lista.
export type FormatoConteudo = "topicos" | "prosa";

// Exportado para ser testável sem chamar a API.
export const PROMPT = (
  tema: string,
  fonte?: string,
  instrucoes?: string,
  formato: FormatoConteudo = "topicos"
) =>
  `Você é um especialista em treinamento de conscientização de segurança da informação.
Crie um treinamento curto sobre o tema: "${tema}".
${
  fonte
    ? `\nBaseie o conteúdo NESTE material (extraído de uma apresentação); resuma e organize de forma didática:\n"""\n${fonte.slice(0, 12000)}\n"""\n`
    : ""
}${
  instrucoes
    ? `\nInstruções adicionais do administrador (siga-as ao montar o conteúdo — tom, foco, exemplos, público):\n"""\n${instrucoes.slice(0, 2000)}\n"""\n`
    : ""
}
Responda APENAS com um objeto JSON válido (sem markdown, sem comentários) neste formato:
{
  "titulo": "string curta",
  "descricao": "uma frase resumindo o treinamento",
  "slides": [
    {
      "titulo": "título curto do slide",
      "conteudo": ${
        formato === "prosa"
          ? `"2 a 3 parágrafos descritivos, um por linha (separados por \\\\n), explicando o ponto com contexto e exemplo, em linguagem clara para funcionários não técnicos"`
          : `"3 a 5 tópicos curtos, um por linha (separados por \\\\n), em linguagem clara para funcionários não técnicos"`
      }
    }
  ],
  "perguntas": [
    {
      "enunciado": "string",
      "alternativas": [
        { "texto": "string", "correta": true },
        { "texto": "string", "correta": false },
        { "texto": "string", "correta": false },
        { "texto": "string", "correta": false }
      ]
    }
  ]
}

O treinamento é uma apresentação que o aluno passa slide a slide.
${
  formato === "prosa"
    ? `Gere de 5 a 7 slides, cada um com um título e 2 a 3 PARÁGRAFOS descritivos, um por linha.
NÃO use bullets, listas nem frases soltas: escreva texto corrido que explica o ponto,
com contexto e um exemplo concreto do dia a dia. Cada parágrafo com 2 a 4 frases.`
    : `Gere de 5 a 7 slides, cada um com um título e 3 a 5 tópicos curtos (bullets), um por linha.`
}
O primeiro slide é uma introdução ao tema; o último, um resumo do que fazer na prática.
Gere exatamente 4 perguntas, cada uma com 4 alternativas e EXATAMENTE uma correta.
Tudo em português do Brasil.`;

// Remove cercas de markdown (```json ... ```) que o modelo às vezes inclui.
function extrairJson(texto: string): string {
  const semCerca = texto.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const inicio = semCerca.indexOf("{");
  const fim = semCerca.lastIndexOf("}");
  if (inicio === -1 || fim === -1) return semCerca;
  return semCerca.slice(inicio, fim + 1);
}

export async function gerarCursoIA(
  tema: string,
  fonte?: string,
  instrucoes?: string,
  formato: FormatoConteudo = "topicos"
): Promise<CursoGerado> {
  const client = new Anthropic({ apiKey: anthropicKey() });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    messages: [{ role: "user", content: PROMPT(tema, fonte, instrucoes, formato) }],
  });

  // Log de uso de tokens (entra/sai) — útil para acompanhar custo por geração.
  console.log(
    `[IA] curso "${tema}" — input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens`
  );

  const bloco = response.content.find((b) => b.type === "text");
  const texto = bloco && bloco.type === "text" ? bloco.text : "{}";
  const curso = JSON.parse(extrairJson(texto)) as CursoGerado;

  // Validação mínima do que a IA devolveu.
  if (!curso.titulo || !Array.isArray(curso.slides) || !Array.isArray(curso.perguntas)) {
    throw new Error("Resposta da IA em formato inesperado.");
  }
  return curso;
}
