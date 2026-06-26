// Gera um PDF e um PPTX reais, insere como treinamentos tipo "arquivo" e
// atribui à Ana, para testar os visualizadores.
//   node --import tsx --env-file=.env.local scripts/seed-arquivos.ts
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import pptxgen from "pptxgenjs";

const prisma = new PrismaClient();

function emDias(d: number) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x;
}

async function gerarPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const corpo = await doc.embedFont(StandardFonts.Helvetica);
  const paginas = [
    ["Phishing por Email", "Como reconhecer mensagens fraudulentas."],
    ["Sinais de alerta", "Remetente estranho. Senso de urgencia. Links suspeitos."],
    ["O que fazer", "Nao clique. Nao baixe anexos. Reporte ao time de seguranca."],
  ];
  for (const [titulo, texto] of paginas) {
    const p = doc.addPage([595, 420]);
    p.drawText(titulo, { x: 50, y: 340, size: 28, font, color: rgb(0.1, 0.1, 0.2) });
    p.drawText(texto, { x: 50, y: 280, size: 16, font: corpo, color: rgb(0.2, 0.2, 0.2) });
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function gerarPptx(): Promise<Buffer> {
  const pptx = new pptxgen();
  const slides = [
    ["Phishing no Microsoft Teams", "Treinamento de conscientizacao"],
    ["Como funciona", "Mensagem falsa de colega ou suporte\nPede para clicar ou informar senha"],
    ["Como se proteger", "Confirme por outro canal\nNunca informe senha\nReporte ao TI"],
  ];
  for (const [titulo, corpo] of slides) {
    const s = pptx.addSlide();
    s.background = { color: "FFFFFF" }; // arquivos reais do PowerPoint sempre têm background
    s.addText(titulo, { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 28, bold: true, color: "1F2937" });
    s.addText(corpo, { x: 0.5, y: 1.8, w: 9, h: 3, fontSize: 18, color: "374151" });
  }
  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}

async function main() {
  const ana = await prisma.usuario.findUnique({ where: { email: "ana@acme.com" } });
  if (!ana) throw new Error("Ana não encontrada — rode o seed antes.");

  const pdf = await gerarPdf();
  const tPdf = await prisma.treinamento.create({
    data: {
      titulo: "Phishing por Email (PDF)",
      descricao: "Apresentação em PDF mostrada como está.",
      tipo: "arquivo",
      arquivo: { create: { mime: "application/pdf", nomeOriginal: "phishing.pdf", dados: pdf } },
    },
  });

  const pptx = await gerarPptx();
  const tPptx = await prisma.treinamento.create({
    data: {
      titulo: "Phishing no Teams (PPTX)",
      descricao: "Apresentação PPTX mostrada como está.",
      tipo: "arquivo",
      arquivo: {
        create: {
          mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          nomeOriginal: "phishing-teams.pptx",
          dados: pptx,
        },
      },
    },
  });

  for (const t of [tPdf, tPptx]) {
    await prisma.atribuicao.upsert({
      where: { treinamentoId_usuarioId: { treinamentoId: t.id, usuarioId: ana.id } },
      update: { prazo: emDias(7), concluidoEm: null },
      create: { treinamentoId: t.id, usuarioId: ana.id, prazo: emDias(7) },
    });
  }

  console.log("PDF treinamento id:", tPdf.id, "| PPTX treinamento id:", tPptx.id);
  console.log("Atribuídos à Ana (ana@acme.com).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
