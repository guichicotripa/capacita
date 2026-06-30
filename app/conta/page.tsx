import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getUsuarioAtual } from "@/lib/auth";
import { Header } from "@/components/Header";
import { iniciarMfa, confirmarMfa, desativarMfa, trocarSenha } from "@/lib/actions";
import { otpauthUrl } from "@/lib/mfa";

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const u = usuario!;
  const pendente = Boolean(u.mfaSecret) && !u.mfaAtivo;
  const qrDataUrl = pendente
    ? await QRCode.toDataURL(otpauthUrl(u.email, u.mfaSecret!))
    : null;

  return (
    <>
      <Header nome={u.nome} papel={u.papel} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold">Minha conta</h1>
        <p className="mb-6 text-sm text-slate-500">
          {u.nome} · {u.email}
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-medium">Verificação em duas etapas (2FA)</h2>

          {u.mfaAtivo ? (
            <>
              <p className="mt-1 text-sm text-green-700">✓ 2FA ativo. Pediremos o código no login.</p>
              <form action={desativarMfa} className="mt-4">
                <button className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                  Desativar 2FA
                </button>
              </form>
            </>
          ) : pendente ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Escaneie o QR com Google Authenticator, Authy ou similar e digite o código gerado.
              </p>
              {erro && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Código inválido. Tente de novo.
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
                  Confirmar
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Adicione uma camada extra: além da senha, um código do seu celular.
              </p>
              {ok && (
                <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                  2FA ativado.
                </p>
              )}
              <form action={iniciarMfa} className="mt-4">
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  Ativar 2FA
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-medium">Trocar senha</h2>
          {ok === "senha" && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Senha alterada.
            </p>
          )}
          {erro && erro !== "1" && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro === "atual"
                ? "Senha atual incorreta."
                : erro === "curta"
                  ? "A nova senha precisa ter ao menos 8 caracteres."
                  : erro === "confirma"
                    ? "A confirmação não bate com a nova senha."
                    : "Não foi possível trocar a senha."}
            </p>
          )}
          <form action={trocarSenha} className="mt-4 space-y-3">
            <input
              name="senhaAtual"
              type="password"
              required
              placeholder="Senha atual"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <input
              name="novaSenha"
              type="password"
              required
              placeholder="Nova senha (mín. 8 caracteres)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <input
              name="confirmar"
              type="password"
              required
              placeholder="Confirmar nova senha"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Trocar senha
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
