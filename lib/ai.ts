import Anthropic from "@anthropic-ai/sdk";

// Geração de curso por IA. Só funciona com ANTHROPIC_API_KEY configurada;
// sem a chave, iaDisponivel() retorna false e a UI mostra o aviso.

export function iaDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type CursoGerado = {
  titulo: string;
  descricao: string;
  corpo: string;
  perguntas: {
    enunciado: string;
    alternativas: { texto: string; correta: boolean }[];
  }[];
};

const PROMPT = (tema: string) =>
  `Você é um especialista em treinamento de conscientização de segurança da informação.
Crie um treinamento curto sobre o tema: "${tema}".

Responda APENAS com um objeto JSON válido (sem markdown, sem comentários) neste formato:
{
  "titulo": "string curta",
  "descricao": "uma frase resumindo o treinamento",
  "corpo": "conteúdo didático em português, 3 a 6 parágrafos separados por uma linha em branco, linguagem clara para funcionários não técnicos",
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

export async function gerarCursoIA(tema: string): Promise<CursoGerado> {
  const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    messages: [{ role: "user", content: PROMPT(tema) }],
  });

  const bloco = response.content.find((b) => b.type === "text");
  const texto = bloco && bloco.type === "text" ? bloco.text : "{}";
  const curso = JSON.parse(extrairJson(texto)) as CursoGerado;

  // Validação mínima do que a IA devolveu.
  if (!curso.titulo || !Array.isArray(curso.perguntas)) {
    throw new Error("Resposta da IA em formato inesperado.");
  }
  return curso;
}
