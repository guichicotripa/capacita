# Capacita — Protótipo

Plataforma de **treinamento e conscientização de segurança** (estilo KnowBe4), com foco
em **atendimento por cliente**. Admin atribui treinamentos com prazo, o aluno faz, e um
relatório mostra quem fez e quem não fez. Passado o prazo sem concluir, o acesso é cortado.

> Protótipo para validação de conceito. Veja "Limites do protótipo" antes de usar com dados reais.

## Como rodar

Pré-requisito: Node.js 20+.

```bash
npm install
cp .env.example .env   # define o caminho do banco SQLite
npm run db:reset       # cria o banco SQLite e popula dados de demonstração
npm run dev            # sobe em http://localhost:3000
```

## Contas de demonstração

| Papel | Email | Senha |
|-------|-------|-------|
| Admin | admin@platinum.com | admin123 |
| Aluno | ana@acme.com | aluno123 |
| Aluno | bruno@acme.com | aluno123 |
| Aluno | carla@globex.com | aluno123 |

Os dados de seed incluem, de propósito, **uma atribuição já vencida** (Bruno) para você ver
a regra de corte de acesso funcionando na hora.

## O que dá pra fazer

**Admin:**
- Relatório de conclusão (taxa, concluídos/pendentes/vencidos) com filtro por cliente
- Atribuir treinamento a um aluno com prazo (gera notificação)
- Criar treinamentos (vídeo via embed ou texto), globais ou específicos de um cliente
- Ver clientes e o progresso de cada aluno

**Aluno:**
- Ver treinamentos liberados com prazo
- Abrir e consumir o conteúdo, marcar como concluído
- Treinamento vencido aparece como "Acesso encerrado" e não pode mais ser aberto

## Como funciona por dentro

- **Next.js (App Router) + TypeScript** — telas e Server Actions para as mutações.
- **Prisma + SQLite** — banco em arquivo (`prisma/dev.db`). O schema está em
  `prisma/schema.prisma` e é a melhor forma de entender o modelo de dados.
- **Senhas com hash scrypt** (`lib/password.ts`) — nada de senha em texto puro.
- A regra de status (concluído / pendente / vencido) fica isolada em `lib/status.ts`.

## Limites do protótipo (o que falta para produção)

Itens deixados de fora de propósito, para não inflar o protótipo:

- **Autenticação é simplificada** (cookie com id do usuário, sem expiração de sessão nem
  proteção CSRF). Não usar em produção como está.
- **Email é simulado** — as notificações vão para uma tabela e aparecem na tela de Atribuir.
  Trocar por envio real (SMTP/Resend) é mudança localizada na action `atribuir`.
- **Sem upload de arquivo** — vídeo entra por URL de embed. PPT interativa de verdade é
  evolução futura.
- **Sem phishing simulado**, SSO, multi-idioma, lembretes automáticos por agendador.

## Scripts úteis

- `npm run db:reset` — recria o banco e repopula a demo
- `npm run db:seed` — só repopula
- `npm run build` — build de produção (valida tipos)
