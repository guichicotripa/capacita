// Multi-tenancy: um admin com clienteId = null é o "admin geral" (full) e vê
// tudo; um admin com clienteId setado é "admin de cliente" e só enxerga aquele
// cliente. Estes helpers centralizam a regra para não vazar dado entre clientes.

type AdminLike = { papel: string; clienteId: number | null };
type TreinoLike = { clienteId: number | null };

export function ehFullAdmin(u: AdminLike): boolean {
  return u.papel === "admin" && u.clienteId === null;
}

// clienteId ao qual o admin está restrito, ou null se for full (sem restrição).
export function escopoCliente(u: AdminLike): number | null {
  return ehFullAdmin(u) ? null : u.clienteId;
}

// Admin de cliente vê treinos do próprio cliente + os globais (compartilhados
// pelo full admin). Full admin vê todos.
export function podeVerTreino(treino: TreinoLike, u: AdminLike): boolean {
  if (ehFullAdmin(u)) return true;
  return treino.clienteId === u.clienteId || treino.clienteId === null;
}

// Só edita/apaga/mexe no quiz de treinos do próprio cliente. Globais são do
// full admin; admin de cliente não os edita, só usa.
export function podeEditarTreino(treino: TreinoLike, u: AdminLike): boolean {
  if (ehFullAdmin(u)) return true;
  return treino.clienteId === u.clienteId;
}

// Cliente ao qual um recurso criado deve ser vinculado. Admin de cliente sempre
// cria preso ao próprio cliente (ignora o valor do form); full admin usa a
// escolha do form (que pode ser global/null ou um cliente específico).
export function clienteParaCriacao(u: AdminLike, clienteIdRaw: string): number | null {
  const escopo = escopoCliente(u);
  if (escopo !== null) return escopo;
  return clienteIdRaw ? Number(clienteIdRaw) : null;
}
