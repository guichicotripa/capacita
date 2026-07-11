"use client";

// Botão que dispara a impressão do navegador (que também permite "Salvar como PDF").
// Marcado com class "no-print" para não aparecer no papel.
export function BotaoImprimir({ rotulo }: { rotulo: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      {rotulo}
    </button>
  );
}
