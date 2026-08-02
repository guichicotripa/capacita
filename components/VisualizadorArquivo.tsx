"use client";

import { useEffect, useRef, useState } from "react";
import { PaginaQuiz } from "./PaginaQuiz";
import { useDict } from "./I18nProvider";
import { salvarProgresso } from "@/lib/actions";

type Quiz = {
  atribuicaoId: number;
  notaMinima: number;
  perguntas: { id: number; enunciado: string; alternativas: { id: number; texto: string }[] }[];
};

// Mostra o PDF ou PPTX original "como está", página por página.
// No PDF, se houver quiz, ele vira a última página.
export function VisualizadorArquivo({
  treinamentoId,
  mime,
  quiz,
  atribuicaoId,
  progressoInicial = 1,
}: {
  treinamentoId: number;
  mime: string;
  quiz?: Quiz | null;
  atribuicaoId?: number;
  progressoInicial?: number;
}) {
  return mime === "application/pdf" ? (
    <VisualizadorPdf
      treinamentoId={treinamentoId}
      quiz={quiz}
      atribuicaoId={atribuicaoId}
      progressoInicial={progressoInicial}
    />
  ) : (
    <VisualizadorPptx treinamentoId={treinamentoId} />
  );
}

// --- PDF: renderiza cada página num canvas com pdf.js ---
function VisualizadorPdf({
  treinamentoId,
  quiz,
  atribuicaoId,
  progressoInicial = 1,
}: {
  treinamentoId: number;
  quiz?: Quiz | null;
  atribuicaoId?: number;
  progressoInicial?: number;
}) {
  const d = useDict();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const [total, setTotal] = useState(0);
  // Retoma de onde parou; tudo até ali já conta como visto.
  const inicio = Math.max(1, progressoInicial);
  const [pag, setPag] = useState(inicio);
  const [visitados, setVisitados] = useState<Set<number>>(
    () => new Set(Array.from({ length: inicio }, (_, i) => i + 1))
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Marca as páginas já vistas (libera a avaliação só depois de ver todas).
  useEffect(() => {
    if (total > 0 && pag <= total) {
      setVisitados((v) => (v.has(pag) ? v : new Set(v).add(pag)));
    }
  }, [pag, total]);

  // Persiste a posição, só avançando o marcador.
  const maisLonge = useRef(inicio);
  useEffect(() => {
    if (!atribuicaoId || pag <= maisLonge.current) return;
    maisLonge.current = pag;
    salvarProgresso(atribuicaoId, pag).catch(() => {});
  }, [pag, atribuicaoId]);

  // Carrega o documento uma vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const res = await fetch(`/api/treinamento/${treinamentoId}/arquivo`);
        const buf = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelado) return;
        pdfRef.current = pdf;
        setTotal(pdf.numPages);
        setCarregando(false);
      } catch (e) {
        console.error(e);
        setErro("Não foi possível carregar o PDF.");
        setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [treinamentoId]);

  // Renderiza a página atual ajustada à largura do container.
  useEffect(() => {
    (async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas || pag > total) return; // pag > total = página de quiz
      const page = await pdf.getPage(pag);
      // Renderiza em alta resolução fixa; o CSS (max-w-full h-auto) encaixa no container.
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1400 / base.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
    })();
  }, [pag, total]);

  if (erro) return <Aviso texto={erro} />;

  const temQuiz = Boolean(quiz);
  const totalNav = total + (temQuiz ? 1 : 0);
  const naQuiz = temQuiz && pag > total;
  // Só libera a avaliação depois de ver todas as páginas do PDF.
  const quizLiberado = !temQuiz || (total > 0 && visitados.size >= total);
  const maxNav = quizLiberado ? totalNav : total;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {naQuiz ? (
        <PaginaQuiz
          atribuicaoId={quiz!.atribuicaoId}
          notaMinima={quiz!.notaMinima}
          perguntas={quiz!.perguntas}
        />
      ) : (
        <div className="flex min-h-[280px] flex-col items-center justify-center bg-slate-50 p-3">
          {carregando ? (
            <p className="text-sm text-slate-400">{d.treino.carregando}</p>
          ) : (
            <canvas ref={canvasRef} className="h-auto max-w-full rounded shadow-sm" />
          )}
          {temQuiz && pag === total && !quizLiberado && (
            <p className="pt-3 text-xs text-amber-600">{d.treino.vejaTodasPaginas}</p>
          )}
        </div>
      )}
      <Navegacao
        pag={pag}
        total={maxNav}
        rotuloProximo={temQuiz && pag === total && quizLiberado ? d.treino.irAvaliacao : d.treino.proximo}
        onAnterior={() => setPag((p) => Math.max(1, p - 1))}
        onProximo={() => setPag((p) => Math.min(maxNav, p + 1))}
      />
    </div>
  );
}

// --- PPTX: usa pptx-preview no modo slide (navegação embutida) ---
function VisualizadorPptx({ treinamentoId }: { treinamentoId: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let destruir: (() => void) | undefined;
    (async () => {
      try {
        const { init } = await import("pptx-preview");
        const res = await fetch(`/api/treinamento/${treinamentoId}/arquivo`);
        const buf = await res.arrayBuffer();
        const el = ref.current;
        if (!el) return;
        const largura = el.clientWidth || 800;
        const previewer = init(el, {
          mode: "slide",
          width: largura,
          height: Math.round((largura * 9) / 16),
        });
        await previewer.preview(buf);
        setCarregando(false);
        destruir = () => {
          try {
            previewer.destroy?.();
          } catch {
            /* noop */
          }
        };
      } catch (e) {
        console.error(e);
        setErro("Não foi possível renderizar este PPTX. Tente exportar para PDF e subir como PDF.");
        setCarregando(false);
      }
    })();
    return () => destruir?.();
  }, [treinamentoId]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {erro ? (
        <div className="p-4">
          <Aviso texto={erro} />
        </div>
      ) : (
        <>
          {carregando && (
            <p className="p-4 text-sm text-slate-400">Carregando apresentação…</p>
          )}
          <div ref={ref} className="mx-auto" />
        </>
      )}
    </div>
  );
}

function Navegacao({
  pag,
  total,
  onAnterior,
  onProximo,
  rotuloProximo,
}: {
  pag: number;
  total: number;
  onAnterior: () => void;
  onProximo: () => void;
  rotuloProximo?: string;
}) {
  const d = useDict();
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
      <button
        onClick={onAnterior}
        disabled={pag <= 1}
        className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        {d.treino.anterior}
      </button>
      <span className="text-xs text-slate-500">
        {d.treino.paginaDe(pag, total || "…")}
      </span>
      <button
        onClick={onProximo}
        disabled={pag >= total}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {rotuloProximo ?? d.treino.proximo}
      </button>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{texto}</p>
  );
}
