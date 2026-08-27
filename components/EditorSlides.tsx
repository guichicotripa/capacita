"use client";

import { useState, useTransition } from "react";
import { useDict } from "./I18nProvider";
import { Slide as SlideView, type DadosSlide } from "./Slide";
import { refazerSlideComIA } from "@/lib/actions";

// layout e svg não são digitados aqui, mas viajam junto: a ação de salvar apaga
// e recria os slides a partir deste JSON, então o que não vier aqui é perdido.
type Slide = { titulo: string; conteudo: string; layout?: string | null; svg?: string | null };

const LAYOUTS = ["capa", "topicos", "prosa", "destaque", "comparacao", "passos", "fechamento"] as const;
type Layout = (typeof LAYOUTS)[number];

const VAZIO: Slide = { titulo: "", conteudo: "", layout: "topicos", svg: null };

// Editor do deck: cada slide tem os campos de um lado e a prévia real do outro.
// A prévia usa o MESMO componente que o aluno vê, então não existe divergência
// entre o que o admin edita e o que sai na capacitação.
export function EditorSlides({
  inicial,
  treinamentoId,
  formato,
}: {
  inicial: Slide[];
  treinamentoId: number;
  formato: string;
}) {
  const d = useDict();
  const [slides, setSlides] = useState<Slide[]>(inicial.length > 0 ? inicial : [{ ...VAZIO }]);

  const trocar = (i: number, patch: Partial<Slide>) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));

  const adicionar = () => setSlides((s) => [...s, { ...VAZIO }]);
  const remover = (i: number) => setSlides((s) => (s.length === 1 ? s : s.filter((_, idx) => idx !== i)));
  const mover = (i: number, dir: -1 | 1) =>
    setSlides((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-4">
      <input type="hidden" name="slidesJson" value={JSON.stringify(slides)} />
      {slides.map((sl, i) => (
        <CartaoSlide
          key={i}
          slide={sl}
          indice={i}
          total={slides.length}
          formato={formato}
          treinamentoId={treinamentoId}
          onTrocar={(patch) => trocar(i, patch)}
          onMover={(dir) => mover(i, dir)}
          onRemover={() => remover(i)}
        />
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {d.admin.editorSlides.adicionar}
      </button>
    </div>
  );
}

function CartaoSlide({
  slide,
  indice,
  total,
  formato,
  treinamentoId,
  onTrocar,
  onMover,
  onRemover,
}: {
  slide: Slide;
  indice: number;
  total: number;
  formato: string;
  treinamentoId: number;
  onTrocar: (patch: Partial<Slide>) => void;
  onMover: (dir: -1 | 1) => void;
  onRemover: () => void;
}) {
  const d = useDict();
  const [instrucao, setInstrucao] = useState("");
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const layoutAtual = (LAYOUTS as readonly string[]).includes(slide.layout ?? "")
    ? (slide.layout as Layout)
    : formato === "prosa"
      ? "prosa"
      : "topicos";

  const refazer = () => {
    setErroIa(null);
    iniciar(async () => {
      const r = await refazerSlideComIA(
        treinamentoId,
        { titulo: slide.titulo, conteudo: slide.conteudo, layout: layoutAtual, svg: slide.svg },
        instrucao
      );
      if (r.ok) {
        onTrocar(r.slide);
        setInstrucao("");
      } else {
        // Mostra o motivo real quando existe: "não foi possível" sozinho não
        // ajuda ninguém a resolver.
        setErroIa(
          r.motivo
            ? `${d.admin.editorSlides.erroIa[r.erro]} (${r.motivo})`
            : d.admin.editorSlides.erroIa[r.erro]
        );
      }
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          {d.admin.editorSlides.slide(indice + 1)}
        </span>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={indice === 0}
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={indice === total - 1}
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemover}
            disabled={total === 1}
            className="rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50 disabled:opacity-30"
          >
            {d.admin.editorSlides.remover}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Campos */}
        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-slate-500">
            {d.admin.editorSlides.layout}
          </span>
          <div className="mb-3 flex flex-wrap gap-1">
            {LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onTrocar({ layout: l })}
                className={`rounded-md border px-2 py-1 text-xs transition ${
                  layoutAtual === l
                    ? "border-indigo-500 bg-indigo-500 font-medium text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d.admin.editorSlides.layouts[l]}
              </button>
            ))}
          </div>

          <input
            value={slide.titulo}
            onChange={(e) => onTrocar({ titulo: e.target.value })}
            placeholder={d.admin.editorSlides.tituloSlide}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <textarea
            value={slide.conteudo}
            onChange={(e) => onTrocar({ conteudo: e.target.value })}
            rows={6}
            placeholder={d.admin.editorSlides.topicos}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-slate-500"
          />
          {/* Cada layout lê o conteúdo de um jeito; sem esta dica o admin tem
              que adivinhar (principalmente os marcadores + e - da comparação). */}
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {d.admin.editorSlides.ajuda[layoutAtual]}
          </p>

          {slide.svg && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-500">{d.admin.editorSlides.temIlustracao}</span>
              <button
                type="button"
                onClick={() => onTrocar({ svg: null })}
                className="rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50"
              >
                {d.admin.editorSlides.removerIlustracao}
              </button>
            </div>
          )}

          {/* Refazer com IA: age sobre o que está na tela e devolve para a tela.
              Nada é gravado até o admin salvar o formulário. */}
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-2.5">
            <span className="mb-1.5 block text-[11px] font-medium text-slate-500">
              {d.admin.editorSlides.refazerTitulo}
            </span>
            <div className="flex gap-2">
              <input
                value={instrucao}
                onChange={(e) => setInstrucao(e.target.value)}
                onKeyDown={(e) => {
                  // Enter aqui não pode submeter o formulário inteiro do treino.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (instrucao.trim() && !pendente) refazer();
                  }
                }}
                placeholder={d.admin.editorSlides.refazerPh}
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={refazer}
                disabled={pendente || !instrucao.trim()}
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {pendente ? d.admin.editorSlides.refazendo : d.admin.editorSlides.refazerBtn}
              </button>
            </div>
            {erroIa && <p className="mt-1.5 text-[11px] text-red-600">{erroIa}</p>}
          </div>
        </div>

        {/* Prévia: mesmo componente que o aluno vê. */}
        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-slate-500">
            {d.admin.editorSlides.previa}
          </span>
          <div
            className={`overflow-hidden rounded-lg border border-slate-200 bg-white transition ${
              pendente ? "opacity-50" : ""
            }`}
          >
            <SlideView
              slide={{ ...slide, layout: layoutAtual } as DadosSlide}
              formato={formato}
              indice={indice + 1}
              total={total}
              rotuloPosicao={d.treino.slideDe(indice + 1, total)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
