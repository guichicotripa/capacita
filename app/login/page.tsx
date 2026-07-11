import { login } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";
import { SeletorIdioma } from "@/components/SeletorIdioma";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const d = await getDict();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-lg font-bold text-white">
              C
            </span>
            <div>
              <h1 className="font-semibold leading-tight">Capacita</h1>
              <p className="text-xs text-slate-500">{d.login.subtitulo}</p>
            </div>
          </div>
          <SeletorIdioma />
        </div>

        {erro && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro === "bloqueado" ? d.login.bloqueado : d.login.erro}
          </p>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{d.login.email}</label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="voce@empresa.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{d.login.senha}</label>
            <input
              name="senha"
              type="password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="••••••••"
            />
          </div>
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.login.entrar}
          </button>
        </form>
      </div>
    </main>
  );
}
