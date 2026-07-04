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
      <div className="max-w-md pt-5">
        {abas.map((a, i) => (
          <div key={i} className={ativa === i ? "block" : "hidden"}>
            {a.conteudo}
          </div>
        ))}
      </div>
    </div>
  );
}
