import Link from "next/link";
import { logout } from "@/lib/actions";

export function Header({
  nome,
  papel,
  children,
}: {
  nome: string;
  papel: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href={papel === "admin" ? "/admin" : "/aluno"} className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded bg-slate-900 text-sm font-bold text-white">
              C
            </span>
            <span className="font-semibold">Capacita</span>
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">{children}</nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/conta" className="text-slate-500 hover:text-slate-900">
            {nome}
          </Link>
          <form action={logout}>
            <button className="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
