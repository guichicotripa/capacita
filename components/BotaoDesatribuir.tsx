"use client";

import { removerAtribuicao } from "@/lib/actions";

// Remove uma atribuição (desatribui um treinamento de um aluno), com confirmação.
export function BotaoDesatribuir({
  atribuicaoId,
  aluno,
  treinamento,
}: {
  atribuicaoId: number;
  aluno: string;
  treinamento: string;
}) {
  return (
    <form
      action={removerAtribuicao}
      onSubmit={(e) => {
        if (!confirm(`Desatribuir "${treinamento}" de ${aluno}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="atribuicaoId" value={atribuicaoId} />
      <button
        title="Desatribuir"
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Desatribuir
      </button>
    </form>
  );
}
