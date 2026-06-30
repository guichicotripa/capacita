import { NextRequest, NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statusDe, rotuloStatus, formatarData } from "@/lib/status";

const rotuloTipo: Record<string, string> = {
  slides: "Slides",
  arquivo: "Arquivo (PDF/PPT)",
  video: "Vídeo",
  texto: "Texto",
};

// Escapa um valor para CSV: envolve em aspas e dobra aspas internas.
function csvCampo(valor: string | number | null): string {
  const s = valor === null || valor === undefined ? "" : String(valor);
  return `"${s.replace(/"/g, '""')}"`;
}

// Exporta o relatório fez/não-fez como CSV (evidência de auditoria).
// Respeita o filtro de cliente da tela (?cliente=ID). Apenas admin.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const clienteParam = req.nextUrl.searchParams.get("cliente");
  const clienteId = clienteParam ? Number(clienteParam) : null;

  const atribuicoes = await prisma.atribuicao.findMany({
    where: clienteId ? { usuario: { clienteId } } : {},
    include: { treinamento: true, usuario: { include: { cliente: true } } },
    orderBy: [{ usuario: { nome: "asc" } }, { prazo: "asc" }],
  });

  const cabecalho = [
    "Aluno",
    "Email",
    "Cliente",
    "Treinamento",
    "Tipo",
    "Prazo",
    "Status",
    "Concluído em",
    "Nota (%)",
  ];

  const linhas = atribuicoes.map((a) => {
    const status = statusDe(a);
    return [
      csvCampo(a.usuario.nome),
      csvCampo(a.usuario.email),
      csvCampo(a.usuario.cliente?.nome ?? ""),
      csvCampo(a.treinamento.titulo),
      csvCampo(rotuloTipo[a.treinamento.tipo] ?? a.treinamento.tipo),
      csvCampo(formatarData(a.prazo)),
      csvCampo(rotuloStatus[status]),
      csvCampo(a.concluidoEm ? formatarData(a.concluidoEm) : ""),
      csvCampo(a.nota ?? ""),
    ].join(",");
  });

  // BOM (﻿) para o Excel reconhecer UTF-8 e não quebrar os acentos.
  const csv = "﻿" + [cabecalho.map(csvCampo).join(","), ...linhas].join("\r\n");

  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-capacita-${hoje}.csv"`,
    },
  });
}
