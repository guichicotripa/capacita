import Anthropic from "@anthropic-ai/sdk";

// Geração de conteúdo por IA. Só funciona com a chave da Anthropic configurada;
// aceita o nome padrão ANTHROPIC_API_KEY ou ANTHROPIC_KEY. Sem chave,
// iaDisponivel() retorna false e a UI mostra o aviso.

const MODELO = "claude-opus-5";

function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
}

export function iaDisponivel(): boolean {
  return Boolean(anthropicKey());
}

export type PerguntaGerada = {
  enunciado: string;
  alternativas: { texto: string; correta: boolean }[];
};

export type SlideGerado = {
  titulo: string;
  conteudo: string;
  layout: string;
  svg?: string | null;
};

export type CursoGerado = {
  titulo: string;
  descricao: string;
  slides: SlideGerado[];
  perguntas: PerguntaGerada[];
};

export const LAYOUTS_SLIDE = [
  "capa",
  "topicos",
  "prosa",
  "destaque",
  "comparacao",
  "passos",
  "fechamento",
] as const;

// "topicos" = bullets curtos (padrão). "prosa" = parágrafos descritivos, para
// quando o admin quer conteúdo explicado e não lista.
export type FormatoConteudo = "topicos" | "prosa";

// Quantas perguntas a IA gera. É um BANCO: cada tentativa do aluno sorteia só
// uma parte, então precisa de folga para o rodízio funcionar.
export const PERGUNTAS_NO_BANCO = 12;

// --- Schemas de saída ------------------------------------------------------
// Usamos structured outputs (output_config.format). Com isso a resposta é JSON
// válido por construção, em vez de texto que a gente tenta limpar na unha.

const SCHEMA_PERGUNTAS = {
  type: "array",
  minItems: PERGUNTAS_NO_BANCO,
  maxItems: PERGUNTAS_NO_BANCO,
  items: {
    type: "object",
    properties: {
      enunciado: { type: "string" },
      alternativas: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            texto: { type: "string" },
            correta: { type: "boolean" },
          },
          required: ["texto", "correta"],
          additionalProperties: false,
        },
      },
    },
    required: ["enunciado", "alternativas"],
    additionalProperties: false,
  },
} as const;

const SCHEMA_CURSO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    descricao: { type: "string" },
    slides: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          conteudo: { type: "string" },
          layout: { type: "string", enum: [...LAYOUTS_SLIDE] },
          // String vazia = slide sem ilustração. Não usamos null aqui porque
          // structured outputs lida melhor com um tipo só.
          svg: { type: "string" },
        },
        required: ["titulo", "conteudo", "layout", "svg"],
        additionalProperties: false,
      },
    },
    perguntas: SCHEMA_PERGUNTAS,
  },
  required: ["titulo", "descricao", "slides", "perguntas"],
  additionalProperties: false,
} as const;

const SCHEMA_SLIDE = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    conteudo: { type: "string" },
    layout: { type: "string", enum: [...LAYOUTS_SLIDE] },
    svg: { type: "string" },
  },
  required: ["titulo", "conteudo", "layout", "svg"],
  additionalProperties: false,
} as const;

const SCHEMA_SO_QUIZ = {
  type: "object",
  properties: { perguntas: SCHEMA_PERGUNTAS },
  required: ["perguntas"],
  additionalProperties: false,
} as const;

// Blocos de instrução compartilhados entre o prompt do curso inteiro e o de um
// slide só (o "refazer com IA" do editor). Precisam ser os mesmos: se o editor
// descrever os layouts de outro jeito, o slide refeito destoa do resto do curso.
const REGRAS_LAYOUT = `CADA SLIDE TEM UM LAYOUT. Escolha o que melhor serve ao conteúdo daquele slide —
uma apresentação inteira de bullets é monótona e o aluno para de ler:
- "capa": abertura do curso. Título forte + 2 a 3 linhas dizendo o que a pessoa
  vai aprender e por que isso importa para ela.
- "topicos": lista de 3 a 5 pontos curtos, um por linha.
- "prosa": 2 a 3 parágrafos explicando com contexto e exemplo, um por linha.
- "destaque": um aviso ou regra que precisa grudar. A PRIMEIRA linha é a frase
  em destaque (curta, direta, no imperativo); as linhas seguintes são o apoio.
- "comparacao": o certo contra o errado. Linhas começando com "+" são o que fazer
  e linhas começando com "-" são o que evitar. Use de 2 a 4 de cada lado.
- "passos": procedimento numerado, uma ação por linha, na ordem de execução.
- "fechamento": encerramento. Checklist do que fazer na prática.`;

const REGRAS_SVG = `Regras do SVG, obrigatórias:
- Comece com <svg viewBox="0 0 240 140"> e não use width nem height.
- Use apenas: path, rect, circle, ellipse, line, polyline, polygon, g, text, tspan.
- Nada de script, style, foreignObject, image, animação ou evento (onload etc).
- Nada de imagem externa, fonte externa ou url() apontando para fora.
- Cores como hex literal. Paleta: #4f46e5 (destaque), #1e293b (escuro),
  #94a3b8 (neutro), #ef4444 (perigo), #22c55e (seguro).
- Traço simples, formas grandes, sem texto miúdo. É ícone, não infográfico.
Se não conseguir fazer uma ilustração boa e simples, devolva "".`;

// Instrução comum sobre o banco de perguntas, usada nos dois fluxos.
const REGRAS_QUIZ =`Gere exatamente ${PERGUNTAS_NO_BANCO} perguntas, cada uma com 4 alternativas e EXATAMENTE uma correta.
São um BANCO: cada tentativa do aluno sorteia só algumas delas. Por isso não repita
a mesma ideia em duas perguntas e cubra todo o material, para que qualquer sorteio
avalie o conteúdo inteiro. As alternativas erradas devem ser plausíveis, não absurdas.`;

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
O treinamento é uma apresentação que o aluno passa slide a slide. Gere de 5 a 7 slides.

${REGRAS_LAYOUT}
${
  formato === "prosa"
    ? `O admin pediu conteúdo DESCRITIVO: prefira "prosa" nos slides de explicação e
escreva texto corrido, com contexto e exemplo concreto do dia a dia, 2 a 4 frases
por parágrafo. Continue usando "destaque", "comparacao" e "passos" onde couberem.`
    : `O admin pediu conteúdo em TÓPICOS: prefira "topicos" nos slides de explicação,
com frases curtas. Continue usando "destaque", "comparacao" e "passos" onde couberem.`
}
Use pelo menos três layouts diferentes ao longo do curso, e no mínimo um
"comparacao" ou um "destaque" — é o que fixa o comportamento certo.

ILUSTRAÇÃO (campo "svg"): para 2 ou 3 slides, desenhe uma ilustração simples que
ajude a entender o ponto. Nos demais slides, devolva "".
${REGRAS_SVG}

O primeiro slide é a capa; o último, o fechamento.
${REGRAS_QUIZ}
Tudo em português do Brasil.`;

// Prompt do quiz avulso: o conteúdo do treinamento é o arquivo original que o
// admin subiu, então aqui só produzimos a avaliação sobre ele.
const PROMPT_QUIZ = (titulo: string) =>
  `Você é um especialista em treinamento de conscientização de segurança da informação.
O material acima é o conteúdo de um treinamento chamado "${titulo}", que os funcionários
vão estudar exatamente como está.
Monte a avaliação desse treinamento.
${REGRAS_QUIZ}
Pergunte apenas sobre o que está no material. Não invente informação que não esteja lá.
Tudo em português do Brasil.`;

function cliente(): Anthropic {
  return new Anthropic({ apiKey: anthropicKey() });
}

// Structured outputs garante JSON válido, mas o parse ainda pode falhar se a
// geração for cortada por max_tokens. Mantemos a mensagem de erro explícita.
function lerJson<T>(texto: string, contexto: string): T {
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error(`Resposta da IA não é JSON válido (${contexto}).`);
  }
}

function textoDaResposta(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function gerarCursoIA(
  tema: string,
  fonte?: string,
  instrucoes?: string,
  formato: FormatoConteudo = "topicos"
): Promise<CursoGerado> {
  // Streaming: 7 slides + 12 perguntas passa longe de ser resposta curta, e sem
  // stream a requisição corre risco de estourar o timeout HTTP.
  const stream = cliente().messages.stream({
    model: MODELO,
    max_tokens: 24000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA_CURSO },
    },
    messages: [{ role: "user", content: PROMPT(tema, fonte, instrucoes, formato) }],
  });
  const response = await stream.finalMessage();

  console.log(
    `[IA] curso "${tema}" — input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens`
  );

  const curso = lerJson<CursoGerado>(textoDaResposta(response.content), `curso "${tema}"`);
  if (!curso.titulo || !Array.isArray(curso.slides) || !Array.isArray(curso.perguntas)) {
    throw new Error("Resposta da IA em formato inesperado.");
  }
  return curso;
}

// Refaz UM slide, do jeito que o admin pediu, sem mexer no resto do curso.
// É o "refazer com IA" do editor: mais barato e mais previsível do que
// regenerar o curso inteiro só porque um slide ficou ruim.
export async function gerarSlideIA(
  atual: { titulo: string; conteudo: string; layout: string; svg?: string | null },
  instrucao: string,
  contexto: { tituloCurso: string; formato: FormatoConteudo }
): Promise<SlideGerado> {
  const prompt = `Você é um especialista em treinamento de conscientização de segurança da informação.
Está editando UM slide de um treinamento chamado "${contexto.tituloCurso}".

Slide atual:
- layout: ${atual.layout}
- título: ${atual.titulo}
- conteúdo (uma linha por item):
"""
${atual.conteudo.slice(0, 4000)}
"""
- ilustração: ${atual.svg ? "tem" : "não tem"}

O que o administrador pediu:
"""
${instrucao.slice(0, 1000)}
"""

Reescreva o slide atendendo ao pedido. Mude o layout se o pedido pedir ou se
outro layout servir melhor ao novo conteúdo; se não, mantenha o atual.
${REGRAS_LAYOUT}

O curso usa o estilo "${contexto.formato}", então mantenha o tom coerente com isso.

ILUSTRAÇÃO (campo "svg"): devolva um SVG só se ele ajudar a entender ESTE slide.
Se o slide já tem ilustração e o pedido não fala dela, desenhe uma equivalente.
Se não fizer sentido ter imagem aqui, devolva "".
${REGRAS_SVG}

Tudo em português do Brasil.`;

  const stream = cliente().messages.stream({
    model: MODELO,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA_SLIDE },
    },
    messages: [{ role: "user", content: prompt }],
  });
  const response = await stream.finalMessage();

  console.log(
    `[IA] slide "${atual.titulo}" — input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens`
  );

  const slide = lerJson<SlideGerado>(textoDaResposta(response.content), `slide "${atual.titulo}"`);
  if (!slide.titulo || typeof slide.conteudo !== "string") {
    throw new Error("Resposta da IA em formato inesperado.");
  }
  return slide;
}

// Gera só o banco de perguntas para um arquivo que o admin subiu "como está".
// PDF vai direto como documento: a API lê a página inteira, com layout e
// imagens, em vez de a gente extrair texto e perder tudo que não é texto.
// PPTX não é aceito como documento, então mandamos o texto que extraímos dele.
export async function gerarQuizIA(
  titulo: string,
  fonte: { tipo: "pdf"; dados: Buffer } | { tipo: "texto"; texto: string }
): Promise<PerguntaGerada[]> {
  const material: Anthropic.ContentBlockParam[] =
    fonte.tipo === "pdf"
      ? [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: fonte.dados.toString("base64"),
            },
          },
        ]
      : [{ type: "text", text: `Material do treinamento:\n"""\n${fonte.texto.slice(0, 60000)}\n"""` }];

  const stream = cliente().messages.stream({
    model: MODELO,
    max_tokens: 24000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA_SO_QUIZ },
    },
    messages: [
      { role: "user", content: [...material, { type: "text", text: PROMPT_QUIZ(titulo) }] },
    ],
  });
  const response = await stream.finalMessage();

  console.log(
    `[IA] quiz "${titulo}" (${fonte.tipo}) — input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens`
  );

  const { perguntas } = lerJson<{ perguntas: PerguntaGerada[] }>(
    textoDaResposta(response.content),
    `quiz "${titulo}"`
  );
  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    throw new Error("Resposta da IA em formato inesperado.");
  }
  return perguntas;
}
