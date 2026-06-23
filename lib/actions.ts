"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { verificarSenha } from "./password";
import { criarSessao, encerrarSessao, getUsuarioAtual } from "./auth";
import { statusDe } from "./status";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
    redirect("/login?erro=1");
  }

  await criarSessao(usuario.id);
  redirect(usuario.papel === "admin" ? "/admin" : "/aluno");
}

export async function logout() {
  await encerrarSessao();
  redirect("/login");
}

// Aluno marca um treinamento como concluido. So vale se a atribuicao e dele
// e ainda nao venceu (acesso cortado apos o prazo).
export async function concluir(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const atribuicaoId = Number(formData.get("atribuicaoId"));
  const atrib = await prisma.atribuicao.findUnique({
    where: { id: atribuicaoId },
  });

  if (!atrib || atrib.usuarioId !== usuario!.id) {
    redirect("/aluno");
  }
  if (statusDe(atrib!) === "vencido") {
    // Prazo expirado: acesso cortado, nao deixa concluir.
    redirect("/aluno");
  }

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { concluidoEm: new Date() },
  });

  revalidatePath("/aluno");
  redirect("/aluno");
}

// Admin cria um treinamento.
export async function criarTreinamento(formData: FormData) {
  const tipo = String(formData.get("tipo") || "texto");
  const clienteIdRaw = String(formData.get("clienteId") || "");

  await prisma.treinamento.create({
    data: {
      titulo: String(formData.get("titulo") || "").trim(),
      descricao: String(formData.get("descricao") || "").trim(),
      tipo,
      conteudoUrl: tipo === "video" ? String(formData.get("conteudoUrl") || "") : null,
      corpo: tipo === "texto" ? String(formData.get("corpo") || "") : null,
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
    },
  });

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

// Admin atribui um treinamento a um aluno com prazo. Gera a notificacao de
// liberacao (o "email" simulado).
export async function atribuir(formData: FormData) {
  const treinamentoId = Number(formData.get("treinamentoId"));
  const usuarioId = Number(formData.get("usuarioId"));
  const prazo = new Date(String(formData.get("prazo")));

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
  });

  const atrib = await prisma.atribuicao.upsert({
    where: { treinamentoId_usuarioId: { treinamentoId, usuarioId } },
    update: { prazo, concluidoEm: null },
    create: { treinamentoId, usuarioId, prazo },
  });

  await prisma.notificacao.create({
    data: {
      atribuicaoId: atrib.id,
      tipo: "liberacao",
      mensagem: `Treinamento "${treinamento?.titulo}" liberado. Prazo para concluir: ${prazo.toLocaleDateString("pt-BR")}.`,
    },
  });

  revalidatePath("/admin");
  redirect("/admin");
}
