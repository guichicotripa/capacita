"use client";

import { corStatus, type StatusAtribuicao } from "@/lib/status";
import { useDict } from "./I18nProvider";

export function StatusBadge({ status }: { status: StatusAtribuicao }) {
  const d = useDict();
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${corStatus[status]}`}
    >
      {d.status[status]}
    </span>
  );
}
