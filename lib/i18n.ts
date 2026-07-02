// Dicionários de tradução da interface (PT/ES). Arquivo puro (sem next/headers),
// pode ser importado tanto no server quanto no client. A leitura do idioma atual
// no server fica em i18n-server.ts; no client, no I18nProvider.

export type Lang = "pt" | "es";

const pt = {
  comum: {
    sair: "Sair",
    salvar: "Salvar",
    cancelar: "Cancelar",
  },
  idioma: { rotulo: "Idioma", pt: "PT", es: "ES" },
  login: {
    subtitulo: "Treinamento de segurança",
    email: "Email",
    senha: "Senha",
    entrar: "Entrar",
    erro: "Email ou senha inválidos.",
  },
  nav: {
    relatorio: "Relatório",
    atribuir: "Atribuir",
    treinamentos: "Treinamentos",
    clientes: "Clientes",
    usuarios: "Usuários",
  },
  status: { concluido: "Concluído", pendente: "Pendente", vencido: "Vencido" },
  aluno: {
    meus: "Meus treinamentos",
    nenhum: "Nenhum treinamento atribuído a você.",
    prazo: "Prazo",
    concluidoEm: (d: string) => `Concluído em ${d}`,
    acessoEncerrado: "Acesso encerrado",
    abrir: "Abrir",
    revisar: "Revisar",
  },
  treino: {
    voltar: "← Voltar",
    prazo: "Prazo",
    slideDe: (n: number, t: number) => `Slide ${n} de ${t}`,
    paginaDe: (n: number, t: number | string) => `Página ${n} de ${t}`,
    carregando: "Carregando…",
    vejaTodosSlides: "Veja todos os slides para liberar a avaliação.",
    vejaTodasPaginas: "Veja todas as páginas para liberar a avaliação.",
    irAvaliacao: "Ir para avaliação →",
    proximo: "Próximo →",
    anterior: "← Anterior",
    avaliacaoFinal: "Avaliação final",
    respondaConcluir: (min: number) => `Responda para concluir (mínimo ${min}%)`,
    enviarRespostas: "Enviar respostas",
    avaliacaoMin: (min: number) => `Avaliação (mínimo ${min}% para concluir)`,
    aprovadoCom: (n: number) => `✓ Aprovado com ${n}%. Treinamento concluído.`,
    vocefez: (n: number, min: number) =>
      `Você fez ${n}% (mínimo ${min}%). Revise o conteúdo e tente de novo.`,
    concluidoEm: (d: string) => `✓ Concluído em ${d}`,
    nota: (n: number) => ` · nota ${n}%`,
    aoTerminar: "Ao terminar o conteúdo, marque como concluído.",
    marcarConcluido: "Marcar como concluído",
    revisao: "Revisão da avaliação",
    revisaoLegenda: "Em verde a resposta certa; em vermelho o que você marcou errado.",
    suaResposta: "(sua resposta)",
  },
  report: {
    titulo: "Relatório de conclusão",
    subtitulo: "Quem fez e quem não fez os treinamentos.",
    enviarLembretes: "Enviar lembretes",
    exportarCsv: "Exportar CSV",
    atribuirTreino: "+ Atribuir treinamento",
    atribuidoA: (n: string) => `Treinamento atribuído a ${n} aluno(s).`,
    lembretesEnviados: (t: string, v: string, a: string) =>
      `${t} lembrete(s) enviado(s): ${v} vencido(s), ${a} a vencer.`,
    nenhumLembrete:
      "Nenhum lembrete a enviar agora (ninguém vencido ou vencendo em breve, ou já avisados hoje).",
    taxa: "Taxa de conclusão",
    concluidos: "Concluídos",
    pendentes: "Pendentes",
    vencidos: "Vencidos",
    todosClientes: "Todos os clientes",
    thAluno: "Aluno",
    thCliente: "Cliente",
    thTreino: "Treinamento",
    thPrazo: "Prazo",
    thStatus: "Status",
    nenhumaAtrib: "Nenhuma atribuição.",
    desatribuir: "Desatribuir",
    confirmarDesatribuir: (treino: string, aluno: string) =>
      `Desatribuir "${treino}" de ${aluno}?`,
  },
};

export type Dict = typeof pt;

const es: Dict = {
  comum: {
    sair: "Salir",
    salvar: "Guardar",
    cancelar: "Cancelar",
  },
  idioma: { rotulo: "Idioma", pt: "PT", es: "ES" },
  login: {
    subtitulo: "Capacitación de seguridad",
    email: "Correo",
    senha: "Contraseña",
    entrar: "Entrar",
    erro: "Correo o contraseña inválidos.",
  },
  nav: {
    relatorio: "Informe",
    atribuir: "Asignar",
    treinamentos: "Capacitaciones",
    clientes: "Clientes",
    usuarios: "Usuarios",
  },
  status: { concluido: "Completado", pendente: "Pendiente", vencido: "Vencido" },
  aluno: {
    meus: "Mis capacitaciones",
    nenhum: "No tienes capacitaciones asignadas.",
    prazo: "Plazo",
    concluidoEm: (d: string) => `Completado el ${d}`,
    acessoEncerrado: "Acceso cerrado",
    abrir: "Abrir",
    revisar: "Revisar",
  },
  treino: {
    voltar: "← Volver",
    prazo: "Plazo",
    slideDe: (n: number, t: number) => `Diapositiva ${n} de ${t}`,
    paginaDe: (n: number, t: number | string) => `Página ${n} de ${t}`,
    carregando: "Cargando…",
    vejaTodosSlides: "Mira todas las diapositivas para desbloquear la evaluación.",
    vejaTodasPaginas: "Mira todas las páginas para desbloquear la evaluación.",
    irAvaliacao: "Ir a la evaluación →",
    proximo: "Siguiente →",
    anterior: "← Anterior",
    avaliacaoFinal: "Evaluación final",
    respondaConcluir: (min: number) => `Responde para completar (mínimo ${min}%)`,
    enviarRespostas: "Enviar respuestas",
    avaliacaoMin: (min: number) => `Evaluación (mínimo ${min}% para completar)`,
    aprovadoCom: (n: number) => `✓ Aprobado con ${n}%. Capacitación completada.`,
    vocefez: (n: number, min: number) =>
      `Obtuviste ${n}% (mínimo ${min}%). Revisa el contenido e inténtalo de nuevo.`,
    concluidoEm: (d: string) => `✓ Completado el ${d}`,
    nota: (n: number) => ` · nota ${n}%`,
    aoTerminar: "Al terminar el contenido, márcalo como completado.",
    marcarConcluido: "Marcar como completado",
    revisao: "Revisión de la evaluación",
    revisaoLegenda: "En verde la respuesta correcta; en rojo lo que marcaste mal.",
    suaResposta: "(tu respuesta)",
  },
  report: {
    titulo: "Informe de finalización",
    subtitulo: "Quién hizo y quién no las capacitaciones.",
    enviarLembretes: "Enviar recordatorios",
    exportarCsv: "Exportar CSV",
    atribuirTreino: "+ Asignar capacitación",
    atribuidoA: (n: string) => `Capacitación asignada a ${n} usuario(s).`,
    lembretesEnviados: (t: string, v: string, a: string) =>
      `${t} recordatorio(s) enviado(s): ${v} vencido(s), ${a} por vencer.`,
    nenhumLembrete:
      "Ningún recordatorio para enviar ahora (nadie vencido o por vencer pronto, o ya avisados hoy).",
    taxa: "Tasa de finalización",
    concluidos: "Completados",
    pendentes: "Pendientes",
    vencidos: "Vencidos",
    todosClientes: "Todos los clientes",
    thAluno: "Usuario",
    thCliente: "Cliente",
    thTreino: "Capacitación",
    thPrazo: "Plazo",
    thStatus: "Estado",
    nenhumaAtrib: "Ninguna asignación.",
    desatribuir: "Quitar",
    confirmarDesatribuir: (treino: string, aluno: string) =>
      `¿Quitar "${treino}" de ${aluno}?`,
  },
};

export const dicionarios: Record<Lang, Dict> = { pt, es };

export function getDicionario(lang: Lang): Dict {
  return dicionarios[lang] ?? dicionarios.pt;
}
