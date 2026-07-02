import { redirect } from "next/navigation";
import { getMfaPendente } from "@/lib/auth";
import { verificarMfaLogin } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";

export default async function MfaLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  // Só acessível com MFA pendente (senha já validada).
  const uid = await getMfaPendente();
  if (!uid) redirect("/login");
  const d = await getDict();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-semibold">{d.mfa.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{d.mfa.digite}</p>

        {erro && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {d.mfa.invalido}
          </p>
        )}

        <form action={verificarMfaLogin} className="mt-5 space-y-4">
          <input
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-slate-500"
          />
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.mfa.verificar}
          </button>
        </form>
      </div>
    </main>
  );
}
