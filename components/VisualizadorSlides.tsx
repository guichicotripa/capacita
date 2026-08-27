"use client";

import { useEffect, useRef, useState } from "react";
import { PaginaQuiz } from "./PaginaQuiz";
import { Slide as SlideView, type DadosSlide, type Marca } from "./Slide";
import { useDict } from "./I18nProvider";
import { salvarProgresso } from "@/lib/actions";

type Slide = DadosSlide;
type Quiz = {
  atribuicaoId: number;
  notaMinima: number;
  emJanela?: boolean;
  perguntas: { id: number; enunciado: string; alternativas: { id: number; texto: string }[] }[];
};

// Deck navegável: um slide por vez. Se houver quiz, ele é a última página,
// e só libera depois que o aluno passou por todos os slides.
export function VisualizadorSlides({
  slides,
  quiz,
  formato = "topicos",
  atribuicaoId,
  progressoInicial = 1,
  grande = false,
  marca,
}: {
  slides: Slide[];
  quiz?: Quiz | null;
  formato?: string;
  atribuicaoId?: number;
  progressoInicial?: number;
  grande?: boolean;
  marca?: Marca;
}) {
  const d = useDict();
  // Retoma de onde parou. Sem isto o progresso morria ao fechar a aba e a
  // pessoa tinha que passar o deck inteiro de novo para destravar a avaliação.
  const inicio = Math.min(Math.max(0, progressoInicial - 1), Math.max(0, slides.length - 1));
  const [idx, setIdx] = useState(inicio);
  // Tudo até onde já chegou conta como visto: foi visto numa sessão anterior.
  const [visitados, setVisitados] = useState<Set<number>>(
    () => new Set(Array.from({ length: inicio + 1 }, (_, i) => i))
  );

  // Persiste a posição. Só avança o marcador: voltar um slide para reler não
  // deve fazer a pessoa perder o ponto mais longe a que já chegou.
  const maisLonge = useRef(inicio + 1);
  useEffect(() => {
    if (!atribuicaoId || idx + 1 <= maisLonge.current) return;
    maisLonge.current = idx + 1;
    salvarProgresso(atribuicaoId, idx + 1).catch(() => {});
  }, [idx, atribuicaoId]);

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
    const alvo = Math.max(0, Math.min(total - 1, i));
    setIdx(alvo);
    // Marca o slide como visto aqui, na navegação, e não num efeito: a
    // avaliação só libera depois de passar por todos.
    if (alvo < slides.length) {
      setVisitados((v) => (v.has(alvo) ? v : new Set(v).add(alvo)));
    }
  };

  const slide = naPaginaQuiz ? null : slides[idx];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="h-1 w-full bg-slate-100">
        <div
          className="h-1 transition-all"
          style={{
            width: `${((idx + 1) / total) * 100}%`,
            backgroundColor: marca?.cor || "#4f46e5",
          }}
        />
      </div>

      {naPaginaQuiz ? (
        <div className="min-h-[280px]">
          <PaginaQuiz
            atribuicaoId={quiz!.atribuicaoId}
            notaMinima={quiz!.notaMinima}
            perguntas={quiz!.perguntas}
            emJanela={quiz!.emJanela}
          />
        </div>
      ) : (
        <div>
          <SlideView
            slide={slide!}
            formato={formato}
            indice={idx + 1}
            total={total}
            rotuloPosicao={d.treino.slideDe(idx + 1, total)}
            grande={grande}
            marca={marca}
          />
          {temQuiz && idx === slides.length - 1 && !quizLiberado && (
            <p className="px-6 pb-4 text-xs text-amber-600 sm:px-9">{d.treino.vejaTodosSlides}</p>
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
