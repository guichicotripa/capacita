import { corStatus, rotuloStatus, type StatusAtribuicao } from "@/lib/status";

export function StatusBadge({ status }: { status: StatusAtribuicao }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${corStatus[status]}`}
    >
      {rotuloStatus[status]}
    </span>
  );
}
