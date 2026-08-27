import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioAtual } from "@/lib/auth";
import { escopoCliente } from "@/lib/escopo";
import { prisma } from "@/lib/db";
import { statusDe, formatarData, type StatusAtribuicao } from "@/lib/status";
import { getDict } from "@/lib/i18n-server";

export const runtime = "nodejs";

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
const accFill = (a: number) => (a >= 70 ? "FFDCFCE7" : a >= 40 ? "FFFEF3C7" : "FFFEE2E2");
const accFont = (a: number) => (a >= 70 ? "FF166534" : a >= 40 ? "FF92400E" : "FF991B1B");

type Dict = Awaited<ReturnType<typeof getDict>>;

// Título (linha 1) + subtítulo (linha 2) + cabeçalho escuro na linha 4.
function montarBase(ws: ExcelJS.Worksheet, titulo: string, sub: string, cabecalho: string[]) {
  const n = cabecalho.length;
  ws.mergeCells(1, 1, 1, n);
  const t1 = ws.getCell(1, 1);
  t1.value = titulo;
  t1.font = { size: 15, bold: true, color: { argb: "FF0F172A" } };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, n);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { size: 10, color: { argb: "FF64748B" } };

  const header = ws.getRow(4);
  header.values = cabecalho;
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle" };
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
}

// Exporta o relatório em .xlsx com 3 abas: Conclusão, Por pergunta e Por pessoa.
// Respeita o filtro de cliente (?cliente=ID) e o idioma. Apenas admin.
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario || usuario.papel !== "admin") {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const d = await getDict();
  const escopo = escopoCliente(usuario);
  const clienteParam = req.nextUrl.searchParams.get("cliente");
  // Admin de cliente exporta só o próprio cliente; o parâmetro é ignorado.
  const clienteId = escopo ?? (clienteParam ? Number(clienteParam) : null);

  const [atribuicoes, clienteSel] = await Promise.all([
    prisma.atribuicao.findMany({
      where: clienteId ? { usuario: { clienteId } } : {},
      include: {
        usuario: { include: { cliente: { omit: { logo: true } } } },
        treinamento: {
          include: { perguntas: { orderBy: { ordem: "asc" }, include: { alternativas: true } } },
        },
      },
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

  const subtitulo = clienteSel
    ? `${d.report.geradoEm(formatarData(new Date()))}  ·  ${d.report.clienteFiltro(clienteSel.nome)}`
    : d.report.geradoEm(formatarData(new Date()));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Capacita";
  wb.created = new Date();

  montarAbaConclusao(wb, d, atribuicoes, tipoLabel, subtitulo);
  montarAbaPorPergunta(wb, d, atribuicoes, subtitulo);
  montarAbaPorPessoa(wb, d, atribuicoes, subtitulo);

  const buf = await wb.xlsx.writeBuffer();
  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-capacita-${hoje}.xlsx"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Atrib = any;

// Aba 1 — Conclusão (fez / não fez).
function montarAbaConclusao(
  wb: ExcelJS.Workbook,
  d: Dict,
  atribuicoes: Atrib[],
  tipoLabel: (t: string) => string,
  sub: string,
) {
  const ws = wb.addWorksheet(d.report.abaConclusao);
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
  montarBase(ws, `Capacita — ${d.report.titulo}`, sub, [
    d.report.thAluno,
    d.report.colEmail,
    d.report.thCliente,
    d.report.thTreino,
    d.report.colTipo,
    d.report.thPrazo,
    d.report.thStatus,
    d.report.colConcluidoEm,
    d.report.colNota,
  ]);

  atribuicoes.forEach((a, i) => {
    const status = statusDe(a);
    const row = ws.addRow({
      aluno: a.usuario.nome,
      email: a.usuario.email,
      cliente: a.usuario.cliente?.nome ?? "",
      treino: a.treinamento.titulo,
      tipo: tipoLabel(a.treinamento.tipo),
      prazo: formatarData(a.prazo),
      status: d.status[status as StatusAtribuicao],
      concluido: a.concluidoEm ? formatarData(a.concluidoEm) : "",
      nota: a.nota ?? "",
    });
    row.alignment = { vertical: "middle" };
    if (i % 2 === 1) row.eachCell((c) => (c.fill = zebra()));
    const sc = row.getCell(7);
    sc.fill = solid(STATUS_FILL[status as StatusAtribuicao]);
    sc.font = { bold: true, color: { argb: STATUS_FONT[status as StatusAtribuicao] } };
    sc.alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
  });
}

// Aba 2 — Por pergunta (acerto e quem errou, por treinamento).
function montarAbaPorPergunta(wb: ExcelJS.Workbook, d: Dict, atribuicoes: Atrib[], sub: string) {
  const ws = wb.addWorksheet(d.report.abaPorPergunta);
  ws.columns = [
    { key: "treino", width: 28 },
    { key: "num", width: 5 },
    { key: "pergunta", width: 46 },
    { key: "acertaram", width: 12 },
    { key: "total", width: 10 },
    { key: "acerto", width: 12 },
    { key: "certa", width: 34 },
    { key: "erraram", width: 40 },
  ];
  montarBase(ws, `Capacita — ${d.report.abaPorPergunta}`, sub, [
    d.report.thTreino,
    d.report.colNum,
    d.report.colPergunta,
    d.report.colAcertaram,
    d.report.total,
    d.report.colAcerto,
    d.report.colRespostaCerta,
    d.report.colQuemErrou,
  ]);

  // Treinamentos com quiz (mantém ordem por título).
  const treinos = new Map<number, Atrib["treinamento"]>();
  for (const a of atribuicoes) {
    if (a.treinamento.perguntas.length > 0) treinos.set(a.treinamento.id, a.treinamento);
  }
  const ordenados = [...treinos.values()].sort((x, y) => x.titulo.localeCompare(y.titulo));

  let algum = false;
  let linha = 0;
  for (const treino of ordenados) {
    const tentativas = atribuicoes.filter(
      (a) => a.treinamentoId === treino.id && a.ultimasRespostas,
    );
    if (tentativas.length === 0) continue;
    treino.perguntas.forEach((p: Atrib, i: number) => {
      const correta = p.alternativas.find((al: Atrib) => al.correta);
      const erraram: string[] = [];
      let acertos = 0;
      for (const a of tentativas) {
        const resp = (a.ultimasRespostas as Record<string, number>)[p.id];
        if (correta && resp === correta.id) acertos++;
        else erraram.push(a.usuario.nome);
      }
      const acc = Math.round((acertos / tentativas.length) * 100);
      const row = ws.addRow({
        treino: treino.titulo,
        num: i + 1,
        pergunta: p.enunciado,
        acertaram: acertos,
        total: tentativas.length,
        acerto: `${acc}%`,
        certa: correta?.texto ?? "",
        erraram: erraram.join(", "),
      });
      row.alignment = { vertical: "middle", wrapText: true };
      if (linha % 2 === 1) row.eachCell((c) => (c.fill = zebra()));
      const ac = row.getCell(6);
      ac.fill = solid(accFill(acc));
      ac.font = { bold: true, color: { argb: accFont(acc) } };
      ac.alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      linha++;
      algum = true;
    });
  }
  if (!algum) ws.addRow({ treino: d.report.semDadosQuiz });
}

// Aba 3 — Por pessoa (nota e quais perguntas cada um errou).
function montarAbaPorPessoa(wb: ExcelJS.Workbook, d: Dict, atribuicoes: Atrib[], sub: string) {
  const ws = wb.addWorksheet(d.report.abaPorPessoa);
  ws.columns = [
    { key: "aluno", width: 24 },
    { key: "email", width: 26 },
    { key: "cliente", width: 18 },
    { key: "treino", width: 28 },
    { key: "nota", width: 10 },
    { key: "acertos", width: 12 },
    { key: "erradas", width: 26 },
  ];
  montarBase(ws, `Capacita — ${d.report.abaPorPessoa}`, sub, [
    d.report.thAluno,
    d.report.colEmail,
    d.report.thCliente,
    d.report.thTreino,
    d.report.colNota,
    d.report.colAcertos,
    d.report.colPerguntasErradas,
  ]);

  const tentativas = atribuicoes.filter(
    (a) => a.ultimasRespostas && a.treinamento.perguntas.length > 0,
  );

  tentativas.forEach((a, idx) => {
    const perguntas = a.treinamento.perguntas;
    const erradas: number[] = [];
    perguntas.forEach((p: Atrib, i: number) => {
      const correta = p.alternativas.find((al: Atrib) => al.correta);
      const resp = (a.ultimasRespostas as Record<string, number>)[p.id];
      if (!correta || resp !== correta.id) erradas.push(i + 1);
    });
    const acertos = perguntas.length - erradas.length;
    const row = ws.addRow({
      aluno: a.usuario.nome,
      email: a.usuario.email,
      cliente: a.usuario.cliente?.nome ?? "",
      treino: a.treinamento.titulo,
      nota: a.nota ?? "",
      acertos: `${acertos}/${perguntas.length}`,
      erradas: erradas.join(", "),
    });
    row.alignment = { vertical: "middle" };
    if (idx % 2 === 1) row.eachCell((c) => (c.fill = zebra()));
    row.getCell(5).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
  });

  if (tentativas.length === 0) ws.addRow({ aluno: d.report.semDadosQuiz });
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function zebra(): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
}
