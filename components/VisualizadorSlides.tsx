"use client";

import { useState } from "react";
import { PaginaQuiz } from "./PaginaQuiz";

type Slide = { titulo: string; conteudo: string };
type Quiz = {
  atribuicaoId: number;
  notaMinima: number;
  perguntas: { id: number; enunciado: string; alternativas: { id: number; texto: string }[] }[];
};

// Deck navegável: um slide por vez, com Anterior/Próximo e progresso.
// Se houver quiz, ele é a última página do deck.
export function VisualizadorSlides({ slides, quiz }: { slides: Slide[]; quiz?: Quiz | null }) {
  const [idx, setIdx] = useState(0);
  if (slides.length === 0) return null;

  const temQuiz = Boolean(quiz);
  const total = slides.length + (temQuiz ? 1 : 0);
  const naPaginaQuiz = temQuiz && idx === slides.length;
  const primeiro = idx === 0;
  const ultimo = idx === total - 1;

  const slide = naPaginaQuiz ? null : slides[idx];
  const topicos =
    slide?.conteudo
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Barra de progresso */}
      <div className="h-1 w-full bg-slate-100">
        <div
          className="h-1 bg-slate-900 transition-all"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Conteúdo: slide ou a página de quiz */}
      {naPaginaQuiz ? (
        <div className="min-h-[280px]">
          <PaginaQuiz
            atribuicaoId={quiz!.atribuicaoId}
            notaMinima={quiz!.notaMinima}
            perguntas={quiz!.perguntas}
          />
        </div>
      ) : (
        <div className="flex min-h-[280px] flex-col px-8 py-7">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Slide {idx + 1} de {total}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{slide!.titulo}</h2>
          <ul className="mt-5 space-y-3">
            {topicos.map((t, i) => (
              <li key={i} className="flex gap-3 text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={primeiro}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Anterior
        </button>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Ir para página ${i + 1}`}
              className={`h-2 w-2 rounded-full ${
                i === idx ? "bg-slate-900" : temQuiz && i === total - 1 ? "bg-amber-300" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
          disabled={ultimo}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {temQuiz && idx === slides.length - 1 ? "Ir para avaliação →" : "Próximo →"}
        </button>
      </div>
    </div>
  );
}
