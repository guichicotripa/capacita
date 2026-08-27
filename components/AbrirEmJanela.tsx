"use client";

import { useEffect, useState } from "react";
import { useDict } from "./I18nProvider";

// Abre a capacitação numa janela separada, sem cabeçalho, e deixa um aviso na
// página principal enquanto ela está aberta. Ao fechar a janela, recarrega a
// página de origem para refletir o que foi feito lá (progresso, nota, conclusão).
export function AbrirEmJanela({ href }: { href: string }) {
  const d = useDict();
  const [janela, setJanela] = useState<Window | null>(null);

  useEffect(() => {
    if (!janela) return;
    const t = setInterval(() => {
      if (janela.closed) {
        setJanela(null);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [janela]);

  const abrir = () => {
    // SEM "noopener": por especificação, window.open com noopener devolve null.
    // Com ele aqui, o código achava que o popup tinha sido bloqueado, navegava a
    // aba de origem para o treino E nunca guardava a referência — por isso o
    // aviso não aparecia e o "trazer para frente" não tinha o que focar.
    // A janela é do nosso próprio domínio, então abrir mão de noopener é seguro.
    const w = window.open(
      href,
      "capacita_treino",
      `width=${Math.min(1400, screen.availWidth)},height=${Math.min(900, screen.availHeight)}`
    );
    // Aí sim: null aqui significa popup realmente bloqueado. Leva na própria aba
    // para a pessoa não ficar sem nada.
    if (!w) {
      window.location.href = href;
      return;
    }
    w.focus();
    setJanela(w);
  };

  if (janela && !janela.closed) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <span>{d.treino.abertaEmOutraJanela}</span>
        <button
          onClick={() => janela.focus()}
          className="rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {d.treino.trazerParaFrente}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={abrir}
      className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      {d.treino.abrirEmJanela}
    </button>
  );
}
