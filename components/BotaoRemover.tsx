"use client";

import { removerTreinamento } from "@/lib/actions";

// Botao de remover treinamento com confirmacao. Client component so para o confirm().
export function BotaoRemover({ treinamentoId, titulo }: { treinamentoId: number; titulo: string }) {
  return (
    <form
      action={removerTreinamento}
      onSubmit={(e) => {
        if (!confirm(`Remover o treinamento "${titulo}"? Isso apaga as atribuições e o quiz dele.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="treinamentoId" value={treinamentoId} />
      <button className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
        Remover
      </button>
    </form>
  );
}
