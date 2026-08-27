"use client";

import { useState } from "react";
import { useDict } from "./I18nProvider";

// Escolha dos layouts que a IA pode usar no curso. Antes ela decidia sozinha e
// o admin só descobria depois de gerar. Cada opção vem com uma miniatura do
// desenho real, porque "comparação" ou "destaque" não dizem nada sem ver.
//
// As miniaturas são feitas com divs de propósito: são esquemas, não o slide de
// verdade. Renderizar o componente Slide em miniatura ficaria ilegível e
// custaria conteúdo de exemplo que teria que ser mantido em dois idiomas.

const TODOS = ["capa", "topicos", "prosa", "destaque", "comparacao", "passos", "fechamento"] as const;
type Layout = (typeof TODOS)[number];

export function SeletorLayouts() {
  const d = useDict();
  const [sel, setSel] = useState<Set<Layout>>(() => new Set(TODOS));

  const alternar = (l: Layout) =>
    setSel((s) => {
      const n = new Set(s);
      // Nunca deixa zerar: sem layout nenhum a IA não teria como montar o curso.
      if (n.has(l)) {
        if (n.size === 1) return s;
        n.delete(l);
      } else {
        n.add(l);
      }
      return n;
    });

  // O estilo do texto das explicações segue o que estiver marcado. Isso substitui
  // o antigo seletor "Formato do conteúdo", que dizia a mesma coisa duas vezes.
  const formato = sel.has("topicos") ? "topicos" : sel.has("prosa") ? "prosa" : "topicos";

  return (
    <div>
      <input type="hidden" name="formato" value={formato} />
      {[...sel].map((l) => (
        <input key={l} type="hidden" name="layouts" value={l} />
      ))}

      <p className="text-xs font-medium text-slate-600">{d.admin.gerarIA.layoutsTitulo}</p>
      <p className="mb-3 text-xs text-slate-400">{d.admin.gerarIA.layoutsAjuda}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {TODOS.map((l) => {
          const ativo = sel.has(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => alternar(l)}
              aria-pressed={ativo}
              className={`rounded-lg border p-2 text-left transition ${
                ativo
                  ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500"
                  : "border-slate-200 bg-white opacity-60 hover:opacity-100"
              }`}
            >
              <div className="grid h-16 place-items-center rounded bg-white">
                <Miniatura layout={l} />
              </div>
              <span className="mt-1.5 block text-[11px] font-medium text-slate-700">
                {d.admin.gerarIA.layoutsNomes[l]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Miniaturas ------------------------------------------------------------

const barra = "rounded-full bg-slate-300";
const barraEscura = "rounded-full bg-slate-500";

function Miniatura({ layout }: { layout: Layout }) {
  if (layout === "capa") {
    return (
      <div className="flex h-12 w-20 flex-col justify-center gap-1 rounded bg-slate-900 px-2">
        <div className="h-1.5 w-12 rounded-full bg-white" />
        <div className={`h-1 w-14 ${barra}`} />
        <div className={`h-1 w-10 ${barra}`} />
      </div>
    );
  }

  if (layout === "prosa") {
    return (
      <div className="flex w-20 flex-col gap-1">
        <div className={`h-1.5 w-10 ${barraEscura}`} />
        <div className={`mt-1 h-1 w-20 ${barra}`} />
        <div className={`h-1 w-20 ${barra}`} />
        <div className={`h-1 w-14 ${barra}`} />
        <div className={`mt-1 h-1 w-20 ${barra}`} />
        <div className={`h-1 w-16 ${barra}`} />
      </div>
    );
  }

  if (layout === "destaque") {
    return (
      <div className="w-20">
        <div className={`mb-1.5 h-1.5 w-10 ${barraEscura}`} />
        <div className="flex gap-1.5 border-l-2 border-amber-400 pl-1.5">
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-1.5 w-full rounded-full bg-slate-700" />
            <div className="h-1.5 w-3/4 rounded-full bg-slate-700" />
          </div>
        </div>
        <div className={`mt-1.5 h-1 w-16 ${barra}`} />
      </div>
    );
  }

  if (layout === "comparacao") {
    return (
      <div className="w-20">
        <div className={`mb-1.5 h-1.5 w-10 ${barraEscura}`} />
        <div className="flex gap-1">
          <div className="flex-1 space-y-1 rounded border border-red-200 bg-red-50 p-1">
            <div className="h-1 w-full rounded-full bg-red-300" />
            <div className="h-1 w-3/4 rounded-full bg-red-300" />
          </div>
          <div className="flex-1 space-y-1 rounded border border-green-200 bg-green-50 p-1">
            <div className="h-1 w-full rounded-full bg-green-400" />
            <div className="h-1 w-3/4 rounded-full bg-green-400" />
          </div>
        </div>
      </div>
    );
  }

  if (layout === "passos") {
    return (
      <div className="w-20 space-y-1.5">
        <div className={`mb-1.5 h-1.5 w-10 ${barraEscura}`} />
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-1.5">
            <span className="grid h-3 w-3 shrink-0 place-items-center rounded-full bg-indigo-100 text-[6px] font-bold text-indigo-700">
              {n}
            </span>
            <div className={`h-1 flex-1 ${barra}`} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "fechamento") {
    return (
      <div className="w-20 space-y-1.5">
        <div className={`mb-1.5 h-1.5 w-10 ${barraEscura}`} />
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-1.5">
            <span className="text-[7px] leading-none text-green-600">✓</span>
            <div className={`h-1 flex-1 ${barra}`} />
          </div>
        ))}
      </div>
    );
  }

  // topicos
  return (
    <div className="w-20 space-y-1.5">
      <div className={`mb-1.5 h-1.5 w-10 ${barraEscura}`} />
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex items-center gap-1.5">
          <span className="h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
          <div className={`h-1 flex-1 ${barra}`} />
        </div>
      ))}
    </div>
  );
}
