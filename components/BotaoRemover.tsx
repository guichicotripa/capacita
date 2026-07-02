"use client";

import { removerTreinamento } from "@/lib/actions";
import { useDict } from "./I18nProvider";

// Botao de remover treinamento com confirmacao. Client component so para o confirm().
export function BotaoRemover({ treinamentoId, titulo }: { treinamentoId: number; titulo: string }) {
  const d = useDict();
  return (
    <form
      action={removerTreinamento}
      onSubmit={(e) => {
        if (!confirm(d.admin.treinos.confirmarRemover(titulo))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="treinamentoId" value={treinamentoId} />
      <button className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
        {d.admin.treinos.remover}
      </button>
    </form>
  );
}
