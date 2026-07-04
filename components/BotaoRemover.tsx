"use client";

import { removerTreinamento } from "@/lib/actions";
import { useDict } from "./I18nProvider";
import { IconTrash } from "./Icones";

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
      className="inline"
    >
      <input type="hidden" name="treinamentoId" value={treinamentoId} />
      <button
        title={d.admin.treinos.remover}
        aria-label={d.admin.treinos.remover}
        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <IconTrash />
      </button>
    </form>
  );
}
