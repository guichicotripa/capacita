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
  // Imagem que o admin subiu para este slide. Só o id: os bytes vêm pela rota
  // /api/slide-imagem/[id], que confere quem pode ver.
  imagemId?: number | null;
};

// Identidade visual da empresa dona da capacitação. Sem isso, o slide usa o
// indigo padrão da plataforma e não mostra logo nenhum.
export type Marca = { logoUrl: string | null; cor: string | null };

const COR_PADRAO = "#4f46e5";

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
  grande = false,
  marca,
}: {
  slide: DadosSlide;
  formato: string;
  indice: number;
  total: number;
  rotuloPosicao: string;
  // Modo apresentação (janela separada): slide ocupa a tela, texto maior.
  grande?: boolean;
  marca?: Marca;
}) {
  const layout = resolverLayout(slide, formato);
  const itens = linhas(slide.conteudo);
  const ehCapa = layout === "capa";
  const cor = marca?.cor || COR_PADRAO;

  return (
    <div
      className={`flex flex-col ${
        grande ? "min-h-[62vh] px-8 py-10 sm:px-14 sm:py-14" : "min-h-[320px] px-6 py-7 sm:px-9"
      } ${ehCapa ? "justify-center bg-slate-900 text-white" : ""}`}
    >
      {/* Logo da empresa no topo do slide, quando houver. */}
      {marca?.logoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={marca.logoUrl}
          alt=""
          className={`mb-4 max-w-[9rem] object-contain ${grande ? "max-h-12" : "max-h-8"} ${
            ehCapa ? "opacity-95" : ""
          }`}
        />
      )}

      <p
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: ehCapa ? "#94a3b8" : cor }}
      >
        {rotuloPosicao}
      </p>

      <h2
        className={`mt-2 font-semibold tracking-tight ${
          ehCapa
            ? grande ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"
            : `${grande ? "text-3xl sm:text-4xl" : "text-2xl"} text-slate-900`
        }`}
      >
        {slide.titulo}
      </h2>

      {/* Barra de destaque sob o título: dá ritmo visual entre os slides. */}
      {!ehCapa && (
        <div className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: cor }} />
      )}

      <Ilustracao svg={slide.svg} imagemId={slide.imagemId} escuro={ehCapa} grande={grande} />

      <div className={grande ? "mt-8 text-lg sm:text-xl" : "mt-5"}>
        <Corpo layout={layout} itens={itens} escuro={ehCapa} cor={cor} />
      </div>

      <span className="sr-only">
        {indice} / {total}
      </span>
    </div>
  );
}

// Imagem do slide. A que o admin subiu ganha da ilustração da IA: escolha
// explícita de humano vale mais que o que foi gerado.
//
// O SVG já vem sanitizado do servidor (lib/svg.ts). Este componente não
// sanitiza nada: se chegar sujo aqui, o problema é lá atrás.
function Ilustracao({
  svg,
  imagemId,
  escuro,
  grande,
}: {
  svg?: string | null;
  imagemId?: number | null;
  escuro: boolean;
  grande: boolean;
}) {
  const fundo = escuro ? "bg-white/5" : "bg-slate-50";

  if (imagemId) {
    return (
      <div className={`mt-5 flex justify-center rounded-lg p-3 ${fundo}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/slide-imagem/${imagemId}`}
          alt=""
          className={`w-auto rounded object-contain ${grande ? "max-h-72" : "max-h-52"}`}
        />
      </div>
    );
  }

  if (!svg) return null;
  return (
    <div className={`mt-5 flex justify-center rounded-lg p-3 ${fundo}`}>
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
  cor,
}: {
  layout: LayoutSlide;
  itens: string[];
  escuro: boolean;
  cor: string;
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
      return <Bullets itens={itens} corTexto={corTexto} cor={cor} />;
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
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: cor }}
            >
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
  return <Bullets itens={itens} corTexto={corTexto} cor={cor} />;
}

function Bullets({ itens, corTexto, cor }: { itens: string[]; corTexto: string; cor: string }) {
  return (
    <ul className="space-y-3">
      {itens.map((t, i) => (
        <li key={i} className={`flex gap-3 ${corTexto}`}>
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: cor }}
          />
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
