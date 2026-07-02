"use client";

import { definirIdioma } from "@/lib/actions";
import { useLang } from "./I18nProvider";

// Botão PT | ES que troca o idioma da interface (cookie global).
export function SeletorIdioma() {
  const lang = useLang();
  return (
    <form action={definirIdioma} className="flex items-center overflow-hidden rounded-md border border-slate-300 text-xs">
      <button
        name="lang"
        value="pt"
        className={lang === "pt" ? "bg-slate-900 px-2 py-1 text-white" : "px-2 py-1 text-slate-600 hover:bg-slate-50"}
      >
        PT
      </button>
      <button
        name="lang"
        value="es"
        className={lang === "es" ? "bg-slate-900 px-2 py-1 text-white" : "px-2 py-1 text-slate-600 hover:bg-slate-50"}
      >
        ES
      </button>
    </form>
  );
}
