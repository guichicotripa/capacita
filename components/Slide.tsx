"use client";

import { useDict } from "./I18nProvider";

// Desenho de um slide. Antes todo slide era a mesma lista de bullets pretos no
// branco; o layout diz como o conteúdo deve ser apresentado, o que muda bastante
// a leitura num treinamento (um alerta não é uma lista, um passo a passo não é
// um parágrafo).
//
// O conteúdo continua sendo uma linha por item. A convenção por layout:
//   comparacao -> linha começando com "+" é o certo, com "-" é o errado
//   destaque   -> a primeira linha é a frase grande, o resto é apoio
//   demais     -> uma linha por bullet/parágrafo/passo

export type LayoutSlide =
  | "capa"
  | "topicos"
  | "prosa"
  | "destaque"
  | "comparacao"
  | "passos"
  | "fechamento";

export type DadosSlide = {
  titulo: string;
  conteudo: string;
  layout?: string | null;
  svg?: string | null;
};

const LAYOUTS = new Set<LayoutSlide>([
  "capa",
  "topicos",
  "prosa",
  "destaque",
  "comparacao",
  "passos",
  "fechamento",
]);

// Conteúdo antigo (gerado antes dos layouts) não tem layout salvo: cai no
// formato do treinamento, que é o comportamento que já existia.
function resolverLayout(slide: DadosSlide, formato: string): LayoutSlide {
  const l = (slide.layout ?? "") as LayoutSlide;
  if (LAYOUTS.has(l)) return l;
  return formato === "prosa" ? "prosa" : "topicos";
}

function linhas(conteudo: string): string[] {
  return conteudo
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function Slide({
  slide,
  formato,
  indice,
  total,
  rotuloPosicao,
}: {
  slide: DadosSlide;
  formato: string;
  indice: number;
  total: number;
  rotuloPosicao: string;
}) {
  const layout = resolverLayout(slide, formato);
  const itens = linhas(slide.conteudo);
  const ehCapa = layout === "capa";

  return (
    <div
      className={`flex min-h-[320px] flex-col px-6 py-7 sm:px-9 ${
        ehCapa ? "justify-center bg-slate-900 text-white" : ""
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-widest ${
          ehCapa ? "text-slate-400" : "text-indigo-500"
        }`}
      >
        {rotuloPosicao}
      </p>

      <h2
        className={`mt-2 font-semibold tracking-tight ${
          ehCapa ? "text-3xl sm:text-4xl" : "text-2xl text-slate-900"
        }`}
      >
        {slide.titulo}
      </h2>

      {/* Barra de destaque sob o título: dá ritmo visual entre os slides. */}
      {!ehCapa && <div className="mt-3 h-1 w-12 rounded-full bg-indigo-500" />}

      <Ilustracao svg={slide.svg} escuro={ehCapa} />

      <div className={ehCapa ? "mt-5" : "mt-5"}>
        <Corpo layout={layout} itens={itens} escuro={ehCapa} />
      </div>

      <span className="sr-only">
        {indice} / {total}
      </span>
    </div>
  );
}

// O SVG já vem sanitizado do servidor (lib/svg.ts). Este componente não
// sanitiza nada: se chegar sujo aqui, o problema é lá atrás.
function Ilustracao({ svg, escuro }: { svg?: string | null; escuro: boolean }) {
  if (!svg) return null;
  return (
    <div
      className={`mt-5 flex justify-center rounded-lg p-3 ${escuro ? "bg-white/5" : "bg-slate-50"}`}
    >
      <div
        className="[&>svg]:h-auto [&>svg]:max-h-44 [&>svg]:w-full [&>svg]:max-w-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function Corpo({
  layout,
  itens,
  escuro,
}: {
  layout: LayoutSlide;
  itens: string[];
  escuro: boolean;
}) {
  const corTexto = escuro ? "text-slate-200" : "text-slate-700";

  if (layout === "prosa") {
    return (
      <div className={`space-y-4 leading-relaxed ${corTexto}`}>
        {itens.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
    );
  }

  if (layout === "destaque") {
    const [frase, ...apoio] = itens;
    return (
      <div>
        <p
          className={`border-l-4 border-amber-400 pl-4 text-xl font-medium leading-snug ${
            escuro ? "text-white" : "text-slate-900"
          }`}
        >
          {frase}
        </p>
        {apoio.length > 0 && (
          <div className={`mt-4 space-y-2 text-sm ${corTexto}`}>
            {apoio.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (layout === "comparacao") {
    const bons = itens.filter((t) => t.startsWith("+")).map((t) => t.slice(1).trim());
    const ruins = itens.filter((t) => t.startsWith("-")).map((t) => t.slice(1).trim());
    // Sem os marcadores + e -, não há o que comparar: cai para bullets.
    if (bons.length === 0 && ruins.length === 0) {
      return <Bullets itens={itens} corTexto={corTexto} />;
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Coluna tom="ruim" itens={ruins} />
        <Coluna tom="bom" itens={bons} />
      </div>
    );
  }

  if (layout === "passos") {
    return (
      <ol className="space-y-3">
        {itens.map((t, i) => (
          <li key={i} className={`flex gap-3 ${corTexto}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {i + 1}
            </span>
            <span className="pt-0.5">{t}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (layout === "fechamento") {
    return (
      <ul className="space-y-2.5">
        {itens.map((t, i) => (
          <li key={i} className={`flex gap-3 ${corTexto}`}>
            <span className="mt-0.5 shrink-0 text-green-600">✓</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    );
  }

  // capa e topicos
  return <Bullets itens={itens} corTexto={corTexto} />;
}

function Bullets({ itens, corTexto }: { itens: string[]; corTexto: string }) {
  return (
    <ul className="space-y-3">
      {itens.map((t, i) => (
        <li key={i} className={`flex gap-3 ${corTexto}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Coluna({ tom, itens }: { tom: "bom" | "ruim"; itens: string[] }) {
  const d = useDict();
  const bom = tom === "bom";
  if (itens.length === 0) return null;
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        bom ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          bom ? "text-green-700" : "text-red-700"
        }`}
      >
        {bom ? d.treino.colunaFaca : d.treino.colunaCuidado}
      </p>
      <ul className="mt-2 space-y-2">
        {itens.map((t, i) => (
          <li
            key={i}
            className={`flex gap-2 text-sm ${bom ? "text-green-900" : "text-red-900"}`}
          >
            <span className="shrink-0">{bom ? "✓" : "✕"}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
