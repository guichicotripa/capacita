"use client";

import { useState } from "react";

export function AbasCriacao({ abas }: { abas: { titulo: string; conteudo: React.ReactNode }[] }) {
  const [ativa, setAtiva] = useState(0);
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200">
        {abas.map((a, i) => (
          <button
            key={i}
            onClick={() => setAtiva(i)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
              ativa === i
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {a.titulo}
          </button>
        ))}
      </div>
      {/* Sem largura máxima aqui: cada aba decide a sua. A de gerar por IA usa
          duas colunas (campos + seletor de layouts); as outras se limitam. */}
      <div className="pt-5">
        {abas.map((a, i) => (
          <div key={i} className={ativa === i ? "block" : "hidden"}>
            {a.conteudo}
          </div>
        ))}
      </div>
    </div>
  );
}
