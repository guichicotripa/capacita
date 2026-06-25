import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../lib/password";

const prisma = new PrismaClient();

// Datas relativas a hoje para a demo ficar sempre coerente.
function emDias(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

async function main() {
  // Limpa tudo (ordem importa por causa das FKs).
  await prisma.notificacao.deleteMany();
  await prisma.atribuicao.deleteMany();
  await prisma.treinamento.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.cliente.deleteMany();

  // --- Clientes (empresas atendidas) ---
  const acme = await prisma.cliente.create({ data: { nome: "Acme Corp" } });
  const globex = await prisma.cliente.create({ data: { nome: "Globex S.A." } });

  // --- Admin (interno, sem cliente) ---
  await prisma.usuario.create({
    data: {
      nome: "Danilo (Admin)",
      email: "admin@platinum.com",
      senhaHash: hashSenha("admin123"),
      papel: "admin",
    },
  });

  // --- Alunos ---
  const ana = await prisma.usuario.create({
    data: {
      nome: "Ana Souza",
      email: "ana@acme.com",
      senhaHash: hashSenha("aluno123"),
      papel: "aluno",
      clienteId: acme.id,
    },
  });
  const bruno = await prisma.usuario.create({
    data: {
      nome: "Bruno Lima",
      email: "bruno@acme.com",
      senhaHash: hashSenha("aluno123"),
      papel: "aluno",
      clienteId: acme.id,
    },
  });
  const carla = await prisma.usuario.create({
    data: {
      nome: "Carla Dias",
      email: "carla@globex.com",
      senhaHash: hashSenha("aluno123"),
      papel: "aluno",
      clienteId: globex.id,
    },
  });

  // --- Treinamentos ---
  const phishing = await prisma.treinamento.create({
    data: {
      titulo: "Reconhecendo Phishing",
      descricao: "Como identificar emails e mensagens fraudulentas.",
      tipo: "video",
      conteudoUrl: "https://www.youtube.com/embed/o0btqyGWIQw",
      clienteId: null, // global
    },
  });
  const senhas = await prisma.treinamento.create({
    data: {
      titulo: "Boas Práticas de Senhas",
      descricao: "Por que não reutilizar senhas e como usar um gerenciador.",
      tipo: "texto",
      corpo:
        "Nunca reutilize a mesma senha em serviços diferentes.\n\n" +
        "Use um gerenciador de senhas para gerar e guardar senhas longas e únicas.\n\n" +
        "Ative a verificação em duas etapas (2FA) sempre que possível.\n\n" +
        "Nunca compartilhe senhas por mensagem, email ou WhatsApp.",
      clienteId: null,
      // Quiz de exemplo: conclusão exige passar (notaMinima padrão 70%).
      perguntas: {
        create: [
          {
            ordem: 0,
            enunciado: "Você deve reutilizar a mesma senha em vários serviços?",
            alternativas: {
              create: [
                { texto: "Não, cada serviço deve ter uma senha única", correta: true },
                { texto: "Sim, facilita lembrar", correta: false },
                { texto: "Só em sites de banco", correta: false },
                { texto: "Tanto faz", correta: false },
              ],
            },
          },
          {
            ordem: 1,
            enunciado: "O que ajuda a guardar senhas longas e únicas com segurança?",
            alternativas: {
              create: [
                { texto: "Um gerenciador de senhas", correta: true },
                { texto: "Um post-it no monitor", correta: false },
                { texto: "Usar sempre 1234", correta: false },
                { texto: "Mandar para si mesmo no WhatsApp", correta: false },
              ],
            },
          },
        ],
      },
    },
  });
  const lgpd = await prisma.treinamento.create({
    data: {
      titulo: "LGPD para Colaboradores",
      descricao: "Tratamento de dados pessoais no dia a dia.",
      tipo: "texto",
      corpo:
        "Dados pessoais devem ser tratados apenas para a finalidade informada.\n\n" +
        "Não copie bases de clientes para dispositivos pessoais.\n\n" +
        "Em caso de incidente, comunique o time de segurança imediatamente.",
      clienteId: globex.id, // específico do cliente Globex
    },
  });

  // --- Atribuições com prazos variados ---
  // Ana: 1 concluída + 1 pendente (no prazo)
  const a1 = await prisma.atribuicao.create({
    data: {
      treinamentoId: phishing.id,
      usuarioId: ana.id,
      prazo: emDias(5),
      concluidoEm: emDias(-1),
    },
  });
  const a2 = await prisma.atribuicao.create({
    data: { treinamentoId: senhas.id, usuarioId: ana.id, prazo: emDias(7) },
  });

  // Bruno: 1 VENCIDA (a "negativa") — prazo no passado, não concluída
  const a3 = await prisma.atribuicao.create({
    data: { treinamentoId: phishing.id, usuarioId: bruno.id, prazo: emDias(-2) },
  });

  // Carla: 1 pendente do treinamento do próprio cliente
  const a4 = await prisma.atribuicao.create({
    data: { treinamentoId: lgpd.id, usuarioId: carla.id, prazo: emDias(3) },
  });

  // Notificações de liberação para cada atribuição
  for (const a of [a1, a2, a3, a4]) {
    await prisma.notificacao.create({
      data: {
        atribuicaoId: a.id,
        tipo: "liberacao",
        mensagem: "Treinamento liberado para você.",
      },
    });
  }
  // Notificação de vencido para o caso do Bruno
  await prisma.notificacao.create({
    data: {
      atribuicaoId: a3.id,
      tipo: "vencido",
      mensagem: "Prazo expirado sem conclusão. Acesso encerrado.",
    },
  });

  console.log("Seed concluído.");
  console.log("Login admin:  admin@platinum.com / admin123");
  console.log("Login aluno:  ana@acme.com / aluno123  (também bruno@acme.com, carla@globex.com)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
