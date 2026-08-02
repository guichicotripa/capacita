import Link from "next/link";
import { logout } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";
import { SeletorIdioma } from "./SeletorIdioma";

export async function Header({
  nome,
  papel,
  children,
}: {
  nome: string;
  papel: string;
  children?: React.ReactNode;
}) {
  const d = await getDict();
  return (
    <header className="border-b border-slate-200 bg-white">
      {/* No celular o cabeçalho quebra em duas linhas: logo + conta em cima, menu
          embaixo (rolável na horizontal se não couber). Numa linha só, os 6 links
          estouravam a largura da tela e o navegador dava zoom out na página
          inteira, o que fazia tudo parecer minúsculo no mobile. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-6">
        <Link
          href={papel === "admin" ? "/admin" : "/aluno"}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="grid h-7 w-7 place-items-center rounded bg-slate-900 text-sm font-bold text-white">
            C
          </span>
          {/* No celular fica só o selo "C": o nome por extenso empurrava a conta
              para uma terceira linha. */}
          <span className="hidden font-semibold sm:inline">Capacita</span>
        </Link>
        {children && (
          <nav className="order-last -mx-4 flex w-full gap-4 overflow-x-auto whitespace-nowrap px-4 text-sm text-slate-600 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            {children}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
          <SeletorIdioma />
          <Link
            href="/conta"
            className="max-w-[7rem] truncate text-slate-500 hover:text-slate-900 sm:max-w-none"
          >
            {nome}
          </Link>
          <form action={logout}>
            <button className="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
              {d.comum.sair}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
