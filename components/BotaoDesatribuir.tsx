"use client";

import { removerAtribuicao } from "@/lib/actions";
import { useDict } from "./I18nProvider";

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
  const d = useDict();
  return (
    <form
      action={removerAtribuicao}
      onSubmit={(e) => {
        if (!confirm(d.report.confirmarDesatribuir(treinamento, aluno))) e.preventDefault();
      }}
    >
      <input type="hidden" name="atribuicaoId" value={atribuicaoId} />
      <button
        title={d.report.desatribuir}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {d.report.desatribuir}
      </button>
    </form>
  );
}
