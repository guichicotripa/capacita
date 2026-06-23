// Status derivado de uma atribuicao. A regra central do produto:
// concluiu -> concluido | passou do prazo sem concluir -> vencido | senao -> pendente.

export type StatusAtribuicao = "concluido" | "vencido" | "pendente";

export function statusDe(atrib: {
  concluidoEm: Date | null;
  prazo: Date;
}): StatusAtribuicao {
  if (atrib.concluidoEm) return "concluido";
  if (new Date() > atrib.prazo) return "vencido";
  return "pendente";
}

export const rotuloStatus: Record<StatusAtribuicao, string> = {
  concluido: "Concluído",
  vencido: "Vencido",
  pendente: "Pendente",
};

// Classes Tailwind para o badge de cada status.
export const corStatus: Record<StatusAtribuicao, string> = {
  concluido: "bg-green-100 text-green-800 border-green-200",
  vencido: "bg-red-100 text-red-800 border-red-200",
  pendente: "bg-amber-100 text-amber-800 border-amber-200",
};

export function formatarData(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}
