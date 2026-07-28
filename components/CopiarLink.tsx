"use client";

import { useState } from "react";

// Mostra um link em texto puro com botão de copiar. Usado no link de acesso do
// usuário: o admin precisa conseguir copiar e mandar por WhatsApp quando o
// email não estiver configurado.
export function CopiarLink({
  link,
  rotulo,
  rotuloCopiado,
}: {
  link: string;
  rotulo: string;
  rotuloCopiado: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Clipboard bloqueado: o link já está visível para cópia manual.
    }
  }

  return (
    <div className="flex items-stretch gap-1.5">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none"
      />
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {copiado ? rotuloCopiado : rotulo}
      </button>
    </div>
  );
}
