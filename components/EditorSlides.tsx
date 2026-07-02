"use client";

import { useState } from "react";

type Slide = { titulo: string; conteudo: string };

// Editor do deck de slides: adicionar, remover, reordenar e editar cada slide.
// Serializa tudo num input escondido (slidesJson) que a ação lê no submit.
export function EditorSlides({ inicial }: { inicial: Slide[] }) {
  const [slides, setSlides] = useState<Slide[]>(
    inicial.length > 0 ? inicial : [{ titulo: "", conteudo: "" }]
  );

  const atualizar = (i: number, campo: keyof Slide, valor: string) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, [campo]: valor } : sl)));

  const adicionar = () => setSlides((s) => [...s, { titulo: "", conteudo: "" }]);
  const remover = (i: number) => setSlides((s) => s.filter((_, idx) => idx !== i));
  const mover = (i: number, dir: -1 | 1) =>
    setSlides((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-3">
      <input type="hidden" name="slidesJson" value={JSON.stringify(slides)} />
      {slides.map((sl, i) => (
        <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Slide {i + 1}</span>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === slides.length - 1}
                className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remover(i)}
                className="rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
          <input
            value={sl.titulo}
            onChange={(e) => atualizar(i, "titulo", e.target.value)}
            placeholder="Título do slide"
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <textarea
            value={sl.conteudo}
            onChange={(e) => atualizar(i, "conteudo", e.target.value)}
            rows={4}
            placeholder="Tópicos, um por linha."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        + Adicionar slide
      </button>
    </div>
  );
}
