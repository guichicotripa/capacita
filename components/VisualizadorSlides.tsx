"use client";

import { useEffect, useState } from "react";
import { PaginaQuiz } from "./PaginaQuiz";
import { useDict } from "./I18nProvider";

type Slide = { titulo: string; conteudo: string };
type Quiz = {
  atribuicaoId: number;
  notaMinima: number;
  perguntas: { id: number; enunciado: string; alternativas: { id: number; texto: string }[] }[];
};

// Deck navegável: um slide por vez. Se houver quiz, ele é a última página,
// e só libera depois que o aluno passou por todos os slides.
export function VisualizadorSlides({
  slides,
  quiz,
  formato = "topicos",
}: {
  slides: Slide[];
  quiz?: Quiz | null;
  formato?: string;
}) {
  const d = useDict();
  const [idx, setIdx] = useState(0);
  const [visitados, setVisitados] = useState<Set<number>>(() => new Set([0]));

  // Marca os slides já vistos (para liberar a avaliação só depois de ver tudo).
  useEffect(() => {
    if (idx < slides.length) {
      setVisitados((v) => (v.has(idx) ? v : new Set(v).add(idx)));
    }
  }, [idx, slides.length]);

  if (slides.length === 0) return null;

  const temQuiz = Boolean(quiz);
  const total = slides.length + (temQuiz ? 1 : 0);
  const quizLiberado = !temQuiz || visitados.size >= slides.length;
  const naPaginaQuiz = temQuiz && idx === slides.length;
  const primeiro = idx === 0;
  const ultimo = idx === total - 1;
  // Não deixa avançar para o quiz antes de ver todos os slides.
  const bloqueadoProximo = ultimo || (temQuiz && idx === slides.length - 1 && !quizLiberado);

  const irPara = (i: number) => {
    if (temQuiz && i === slides.length && !quizLiberado) return; // quiz travado
    setIdx(Math.max(0, Math.min(total - 1, i)));
  };

  const slide = naPaginaQuiz ? null : slides[idx];
  const topicos =
    slide?.conteudo
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="h-1 w-full bg-slate-100">
        <div
          className="h-1 bg-slate-900 transition-all"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

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
            {d.treino.slideDe(idx + 1, total)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{slide!.titulo}</h2>
          {/* Prosa vira parágrafo corrido; tópicos seguem com bullet. */}
          {formato === "prosa" ? (
            <div className="mt-5 space-y-4 leading-relaxed text-slate-700">
              {topicos.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {topicos.map((t, i) => (
                <li key={i} className="flex gap-3 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {temQuiz && idx === slides.length - 1 && !quizLiberado && (
            <p className="mt-auto pt-4 text-xs text-amber-600">{d.treino.vejaTodosSlides}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
        <button
          onClick={() => irPara(idx - 1)}
          disabled={primeiro}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {d.treino.anterior}
        </button>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: total }).map((_, i) => {
            const ehQuizDot = temQuiz && i === total - 1;
            const travado = ehQuizDot && !quizLiberado;
            return (
              <button
                key={i}
                onClick={() => irPara(i)}
                disabled={travado}
                aria-label={`Ir para página ${i + 1}`}
                className={`h-2 w-2 rounded-full ${
                  i === idx
                    ? "bg-slate-900"
                    : travado
                      ? "bg-slate-200"
                      : ehQuizDot
                        ? "bg-amber-300"
                        : "bg-slate-300"
                }`}
              />
            );
          })}
        </div>
        <button
          onClick={() => irPara(idx + 1)}
          disabled={bloqueadoProximo}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {temQuiz && idx === slides.length - 1 ? d.treino.irAvaliacao : d.treino.proximo}
        </button>
      </div>
    </div>
  );
}
