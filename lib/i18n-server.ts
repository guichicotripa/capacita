import { cookies } from "next/headers";
import { getDicionario, type Lang } from "./i18n";

export const LANG_COOKIE = "capacita_lang";

// Idioma atual, lido do cookie (default pt). Usado nos server components.
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get(LANG_COOKIE)?.value === "es" ? "es" : "pt";
}

// Dicionário do idioma atual, para server components.
export async function getDict() {
  return getDicionario(await getLang());
}
