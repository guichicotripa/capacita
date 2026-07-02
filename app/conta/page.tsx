import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getUsuarioAtual } from "@/lib/auth";
import { Header } from "@/components/Header";
import { iniciarMfa, confirmarMfa, desativarMfa, trocarSenha } from "@/lib/actions";
import { otpauthUrl } from "@/lib/mfa";
import { getDict } from "@/lib/i18n-server";

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  const d = await getDict();

  const u = usuario!;
  const pendente = Boolean(u.mfaSecret) && !u.mfaAtivo;
  const qrDataUrl = pendente
    ? await QRCode.toDataURL(otpauthUrl(u.email, u.mfaSecret!))
    : null;

  return (
    <>
      <Header nome={u.nome} papel={u.papel} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold">{d.conta.titulo}</h1>
        <p className="mb-6 text-sm text-slate-500">
          {u.nome} · {u.email}
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-medium">{d.conta.duasEtapas}</h2>

          {u.mfaAtivo ? (
            <>
              <p className="mt-1 text-sm text-green-700">{d.conta.ativo}</p>
              <form action={desativarMfa} className="mt-4">
                <button className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                  {d.conta.desativar}
                </button>
              </form>
            </>
          ) : pendente ? (
            <>
              <p className="mt-1 text-sm text-slate-500">{d.conta.escaneie}</p>
              {erro && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {d.conta.codigoInvalido}
                </p>
              )}
              {qrDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="QR code 2FA" className="mt-4 h-44 w-44" />
              )}
              <form action={confirmarMfa} className="mt-4 flex items-center gap-2">
                <input
                  name="codigo"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="000000"
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 text-center tracking-widest outline-none focus:border-slate-500"
                />
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  {d.conta.confirmar}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">{d.conta.camadaExtra}</p>
              {ok && (
                <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                  {d.conta.ativado}
                </p>
              )}
              <form action={iniciarMfa} className="mt-4">
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  {d.conta.ativar}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-medium">{d.conta.trocarSenha}</h2>
          {ok === "senha" && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {d.conta.senhaAlterada}
            </p>
          )}
          {erro && erro !== "1" && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro === "atual"
                ? d.conta.erroAtual
                : erro === "curta"
                  ? d.conta.erroCurta
                  : erro === "confirma"
                    ? d.conta.erroConfirma
                    : d.conta.erroGenerico}
            </p>
          )}
          <form action={trocarSenha} className="mt-4 space-y-3">
            <input
              name="senhaAtual"
              type="password"
              required
              placeholder={d.conta.senhaAtual}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <input
              name="novaSenha"
              type="password"
              required
              placeholder={d.conta.novaSenha}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <input
              name="confirmar"
              type="password"
              required
              placeholder={d.conta.confirmarNova}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {d.conta.trocarBtn}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
