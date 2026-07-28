"use client";

import { excluirCliente } from "@/lib/actions";

// Exclui uma empresa-cliente. O servidor recusa se ainda houver usuário ou
// treinamento vinculado — aqui só confirmamos a intenção.
export function BotaoExcluirCliente({
  id,
  rotulo,
  confirmacao,
}: {
  id: number;
  rotulo: string;
  confirmacao: string;
}) {
  return (
    <form
      action={excluirCliente}
      onSubmit={(e) => {
        if (!confirm(confirmacao)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
        {rotulo}
      </button>
    </form>
  );
}
