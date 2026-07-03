import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statusDe, formatarData, type StatusAtribuicao } from "@/lib/status";
import { getDict } from "@/lib/i18n-server";

export const runtime = "nodejs";

// Cores por status (preenchimento claro + texto forte), padrão dashboard.
const STATUS_FILL: Record<StatusAtribuicao, string> = {
  concluido: "FFDCFCE7",
  pendente: "FFFEF3C7",
  vencido: "FFFEE2E2",
};
const STATUS_FONT: Record<StatusAtribuicao, string> = {
  concluido: "FF166534",
  pendente: "FF92400E",
  vencido: "FF991B1B",
};

// Exporta o relatório fez/não-fez como um .xlsx formatado (evidência de auditoria).
// Respeita o filtro de cliente (?cliente=ID) e o idioma. Apenas admin.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const d = await getDict();
  const clienteParam = req.nextUrl.searchParams.get("cliente");
  const clienteId = clienteParam ? Number(clienteParam) : null;

  const [atribuicoes, clienteSel] = await Promise.all([
    prisma.atribuicao.findMany({
      where: clienteId ? { usuario: { clienteId } } : {},
      include: { treinamento: true, usuario: { include: { cliente: true } } },
      orderBy: [{ usuario: { nome: "asc" } }, { prazo: "asc" }],
    }),
    clienteId ? prisma.cliente.findUnique({ where: { id: clienteId } }) : Promise.resolve(null),
  ]);

  const tipoLabel = (t: string) =>
    t === "video"
      ? d.admin.treinos.tipoVideo
      : t === "slides"
        ? d.admin.treinos.tipoSlides
        : t === "arquivo"
          ? d.admin.treinos.tipoApresentacao
          : d.admin.treinos.tipoTexto;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Capacita";
  wb.created = new Date();
  const ws = wb.addWorksheet(d.report.titulo.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  ws.columns = [
    { key: "aluno", width: 24 },
    { key: "email", width: 26 },
    { key: "cliente", width: 18 },
    { key: "treino", width: 30 },
    { key: "tipo", width: 18 },
    { key: "prazo", width: 20 },
    { key: "status", width: 15 },
    { key: "concluido", width: 20 },
    { key: "nota", width: 10 },
  ];
  const N = 9;

  // Título
  ws.mergeCells(1, 1, 1, N);
  const t1 = ws.getCell(1, 1);
  t1.value = `Capacita — ${d.report.titulo}`;
  t1.font = { size: 16, bold: true, color: { argb: "FF0F172A" } };
  ws.getRow(1).height = 26;

  // Subtítulo: data + cliente filtrado
  ws.mergeCells(2, 1, 2, N);
  const sub = ws.getCell(2, 1);
  const subtitulo = clienteSel
    ? `${d.report.geradoEm(formatarData(new Date()))}  ·  ${d.report.clienteFiltro(clienteSel.nome)}`
    : d.report.geradoEm(formatarData(new Date()));
  sub.value = subtitulo;
  sub.font = { size: 10, color: { argb: "FF64748B" } };

  // Cabeçalho (linha 4)
  const cabecalho = [
    d.report.thAluno,
    d.report.colEmail,
    d.report.thCliente,
    d.report.thTreino,
    d.report.colTipo,
    d.report.thPrazo,
    d.report.thStatus,
    d.report.colConcluidoEm,
    d.report.colNota,
  ];
  const headerRow = ws.getRow(4);
  headerRow.values = cabecalho;
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle" };
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: N } };

  // Dados
  atribuicoes.forEach((a, i) => {
    const status = statusDe(a);
    const row = ws.addRow({
      aluno: a.usuario.nome,
      email: a.usuario.email,
      cliente: a.usuario.cliente?.nome ?? "",
      treino: a.treinamento.titulo,
      tipo: tipoLabel(a.treinamento.tipo),
      prazo: formatarData(a.prazo),
      status: d.status[status],
      concluido: a.concluidoEm ? formatarData(a.concluidoEm) : "",
      nota: a.nota ?? "",
    });
    row.alignment = { vertical: "middle" };
    // Listra alternada
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    // Célula de status colorida (padrão pill)
    const sc = row.getCell(7);
    sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[status] } };
    sc.font = { bold: true, color: { argb: STATUS_FONT[status] } };
    sc.alignment = { vertical: "middle", horizontal: "center" };
    // Nota centralizada
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
  });

  const buf = await wb.xlsx.writeBuffer();
  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-capacita-${hoje}.xlsx"`,
    },
  });
}
