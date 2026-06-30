import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { trocarSenha } from "@/lib/actions";

const MENSAGEM_ERRO: Record<string, string> = {
  atual: "Senha atual incorreta.",
  curta: "A nova senha precisa ter ao menos 8 caracteres.",
  confirma: "A confirmação não bate com a nova senha.",
};

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

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-semibold">Defina sua senha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sua senha foi definida pelo administrador. Crie uma senha sua para continuar.
        </p>

        {erro && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {MENSAGEM_ERRO[erro] ?? "Não foi possível trocar a senha."}
          </p>
        )}

        <form action={trocarSenha} className="mt-5 space-y-4">
          <Campo nome="senhaAtual" rotulo="Senha atual" />
          <Campo nome="novaSenha" rotulo="Nova senha (mín. 8 caracteres)" />
          <Campo nome="confirmar" rotulo="Confirmar nova senha" />
          <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Salvar e entrar
          </button>
        </form>
      </div>
    </main>
  );
}

function Campo({ nome, rotulo }: { nome: string; rotulo: string }) {
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
    </div>
  );
}
