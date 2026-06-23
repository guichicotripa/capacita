import { cookies } from "next/headers";
import { prisma } from "./db";

// Sessao de prototipo: um cookie httpOnly com o id do usuario.
// NAO e auth de producao (sem JWT, sem expiracao server-side, sem CSRF token).
const COOKIE = "capacita_uid";

export async function getUsuarioAtual() {
  const store = await cookies();
  const uid = store.get(COOKIE)?.value;
  if (!uid) return null;
  return prisma.usuario.findUnique({
    where: { id: Number(uid) },
    include: { cliente: true },
  });
}

export async function criarSessao(uid: number) {
  const store = await cookies();
  store.set(COOKIE, String(uid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function encerrarSessao() {
  const store = await cookies();
  store.delete(COOKIE);
}
