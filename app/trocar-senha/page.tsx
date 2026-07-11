import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { trocarSenha } from "@/lib/actions";
import { getDict } from "@/lib/i18n-server";

// Troca obrigatória no primeiro acesso (usuário com senha definida pelo admin).
export default async function TrocarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  // Quem já trocou não precisa estar aqui.
  if (!usuario.senhaTemporaria) redirect(usuario.papel === "admin" ? "/admin" : "/aluno");
  const d = await getDict();

  const mensagemErro: Record<string, string> = {
    atual: d.conta.erroAtual,
    confirma: d.conta.erroConfirma,
    curta: d.politicaSenha.curta,
    semMinuscula: d.politicaSenha.semMinuscula,
    semMaiuscula: d.politicaSenha.semMaiuscula,
    semDigito: d.politicaSenha.semDigito,
    semEspecial: d.politicaSenha.semEspecial,
    reutilizada: d.politicaSenha.reutilizada,
  };

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-semibold">{d.trocarSenha.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{d.trocarSenha.intro}</p>

        {erro && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensagemErro[erro] ?? d.conta.erroGenerico}
          </p>
        )}

        <form action={trocarSenha} className="mt-5 space-y-4">
          <Campo nome="senhaAtual" rotulo={d.trocarSenha.senhaAtual} />
          <Campo nome="novaSenha" rotulo={d.trocarSenha.novaSenha} dica={d.politicaSenha.requisitos} />
          <Campo nome="confirmar" rotulo={d.trocarSenha.confirmar} />
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.trocarSenha.salvarEntrar}
          </button>
        </form>
      </div>
    </main>
  );
}

function Campo({ nome, rotulo, dica }: { nome: string; rotulo: string; dica?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        name={nome}
        type="password"
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        placeholder="••••••••"
      />
      {dica && <p className="mt-1 text-xs text-slate-400">{dica}</p>}
    </div>
  );
}
