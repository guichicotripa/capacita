"use client";

import { useDict } from "./I18nProvider";

// Na janela separada não há menu para voltar: o caminho é fechar a janela.
// Se ela não foi aberta por script (o navegador barra o close), cai de volta
// para a lista em vez de deixar a pessoa presa.
export function FecharJanela({ voltarHref = "/aluno" }: { voltarHref?: string }) {
  const d = useDict();
  return (
    <button
      onClick={() => {
        window.close();
        setTimeout(() => {
          if (!window.closed) window.location.href = voltarHref;
        }, 300);
      }}
      className="text-sm text-slate-500 hover:underline"
    >
      ✕ {d.treino.fecharJanela}
    </button>
  );
}
