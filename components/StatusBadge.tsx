"use client";

import { corStatus, type StatusAtribuicao } from "@/lib/status";
import { useDict } from "./I18nProvider";

const pontoCor: Record<StatusAtribuicao, string> = {
  concluido: "bg-green-500",
  pendente: "bg-amber-500",
  vencido: "bg-red-500",
};

export function StatusBadge({ status }: { status: StatusAtribuicao }) {
  const d = useDict();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${corStatus[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pontoCor[status]}`} />
      {d.status[status]}
    </span>
  );
}
