"use client";

import { createContext, useContext } from "react";
import { getDicionario, type Dict, type Lang } from "@/lib/i18n";

// Segura o idioma atual no client. Recebe só a string do idioma (serializável);
// o dicionário (que tem funções) é importado direto no bundle do client.
const LangContext = createContext<Lang>("pt");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useDict(): Dict {
  return getDicionario(useContext(LangContext));
}
