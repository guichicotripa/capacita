"use client";

import { useState } from "react";

type Slide = { titulo: string; conteudo: string };

// Deck navegável: mostra um slide por vez, com Anterior/Próximo e progresso.
export function VisualizadorSlides({ slides }: { slides: Slide[] }) {
  const [idx, setIdx] = useState(0);
  if (slides.length === 0) return null;

  const slide = slides[idx];
  const topicos = slide.conteudo
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const primeiro = idx === 0;
  const ultimo = idx === slides.length - 1;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Barra de progresso */}
      <div className="h-1 w-full bg-slate-100">
        <div
          className="h-1 bg-slate-900 transition-all"
          style={{ width: `${((idx + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Slide */}
      <div className="flex min-h-[280px] flex-col px-8 py-7">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Slide {idx + 1} de {slides.length}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{slide.titulo}</h2>
        <ul className="mt-5 space-y-3">
          {topicos.map((t, i) => (
            <li key={i} className="flex gap-3 text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={primeiro}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Anterior
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`h-2 w-2 rounded-full ${i === idx ? "bg-slate-900" : "bg-slate-300"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={ultimo}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
