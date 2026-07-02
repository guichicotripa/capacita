import { prisma } from "./db";
import { notificar } from "./email";
import { formatarData } from "./status";

const DIA = 24 * 60 * 60 * 1000;

// Envia lembretes das atribuições pendentes que estão vencidas ou vencendo em
// até 3 dias. Não repete o lembrete se já mandou um nas últimas 20h (dedup).
// Usado pelo cron diário e pelo botão manual do admin.
export async function enviarLembretes(): Promise<{
  total: number;
  vencidos: number;
  aVencer: number;
}> {
  const agora = new Date();
  const emTresDias = new Date(agora.getTime() + 3 * DIA);
  const limiteDedup = new Date(agora.getTime() - 20 * (60 * 60 * 1000));

  const pendentes = await prisma.atribuicao.findMany({
    where: {
      concluidoEm: null,
      AND: [
        { OR: [{ prazo: { lt: agora } }, { prazo: { gte: agora, lte: emTresDias } }] },
        { OR: [{ ultimoLembrete: null }, { ultimoLembrete: { lt: limiteDedup } }] },
      ],
    },
    include: { usuario: true, treinamento: true },
  });

  let vencidos = 0;
  let aVencer = 0;

  for (const a of pendentes) {
    const venceu = agora > a.prazo;
    if (venceu) vencidos++;
    else aVencer++;

    const dias = Math.max(0, Math.ceil((a.prazo.getTime() - agora.getTime()) / DIA));
    const mensagem = venceu
      ? `O treinamento "${a.treinamento.titulo}" venceu em ${formatarData(a.prazo)} e não foi concluído. Procure regularizar.`
      : `Lembrete: o treinamento "${a.treinamento.titulo}" vence em ${dias} dia(s) (${formatarData(a.prazo)}). Conclua antes do prazo.`;

    await notificar({
      atribuicaoId: a.id,
      tipo: venceu ? "vencido" : "lembrete",
      mensagem,
      emailDestino: a.usuario.email,
      assunto: `Capacita — ${venceu ? "Treinamento vencido" : "Lembrete de prazo"}: ${a.treinamento.titulo}`,
    });

    await prisma.atribuicao.update({
      where: { id: a.id },
      data: { ultimoLembrete: agora },
    });
  }

  return { total: pendentes.length, vencidos, aVencer };
}
