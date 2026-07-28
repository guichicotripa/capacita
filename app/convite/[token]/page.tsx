import Link from "next/link";
import { prisma } from "@/lib/db";
import { conviteValido } from "@/lib/convite";
import { definirSenhaPorConvite } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";
import { SeletorIdioma } from "@/components/SeletorIdioma";

// Primeiro acesso por convite: a pessoa define a própria senha e já entra.
// Fica fora de /admin e /aluno de propósito — quem abre este link ainda não
// tem sessão nenhuma.
export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro } = await searchParams;
  const d = await getDict();

  const usuario =
    token && token !== "invalido"
      ? await prisma.usuario.findUnique({ where: { conviteToken: token } })
      : null;
  const valido = Boolean(usuario && usuario.ativo && conviteValido(usuario));

  if (!valido) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-semibold">{d.convite.invalidoTitulo}</h1>
          <p className="mt-2 text-sm text-slate-500">{d.convite.invalidoTexto}</p>
          <Link href="/login" className="mt-5 inline-block text-sm text-slate-600 hover:underline">
            {d.convite.irLogin}
          </Link>
        </div>
      </main>
    );
  }

  const mensagemErro: Record<string, string> = {
    confirma: d.conta.erroConfirma,
    curta: d.politicaSenha.curta,
    semMinuscula: d.politicaSenha.semMinuscula,
    semMaiuscula: d.politicaSenha.semMaiuscula,
    semDigito: d.politicaSenha.semDigito,
    semEspecial: d.politicaSenha.semEspecial,
  };

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
              <p className="text-xs text-slate-500">{d.convite.subtitulo}</p>
            </div>
          </div>
          <SeletorIdioma />
        </div>

        <p className="text-sm text-slate-600">{d.convite.ola(usuario!.nome)}</p>
        <p className="mt-1 text-xs text-slate-400">{usuario!.email}</p>

        {erro && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensagemErro[erro] ?? d.conta.erroGenerico}
          </p>
        )}

        <form action={definirSenhaPorConvite} className="mt-5 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {d.convite.novaSenha}
            </label>
            <input
              name="novaSenha"
              type="password"
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-slate-400">{d.politicaSenha.requisitos}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {d.convite.confirmar}
            </label>
            <input
              name="confirmar"
              type="password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder="••••••••"
            />
          </div>
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.convite.criarEntrar}
          </button>
        </form>
      </div>
    </main>
  );
}
