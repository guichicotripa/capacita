# Capacita

Plataforma de **treinamento e conscientização de segurança da informação**, no estilo
KnowBe4, com atendimento **multi-cliente**: uma instalação atende várias empresas, e cada
admin de empresa só enxerga a sua.

O ciclo é: o admin cria uma capacitação (ou pede para a IA criar), atribui a funcionários
com prazo, o funcionário estuda e faz a avaliação, e o relatório mostra quem fez e quem não
fez. Passado o prazo sem concluir, o acesso é cortado. Quem conclui emite um certificado
com código de verificação, que é o artefato que RH e auditoria arquivam.

**Produção:** https://capacita-rust.vercel.app

---

## Sumário

- [O que a plataforma faz](#o-que-a-plataforma-faz)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Custo de operação](#custo-de-operação)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Decisões de projeto](#decisões-de-projeto)
- [O que ainda não existe](#o-que-ainda-não-existe)

---

## O que a plataforma faz

### Criação de capacitação

Três caminhos, na aba de nova capacitação:

| Caminho | O que acontece |
|---|---|
| **Gerar por IA (tema)** | A IA escreve o curso em slides ilustrados + banco de 12 perguntas |
| **Subir apresentação** | PDF ou PPT mostrado como está, e a IA gera a avaliação a partir dele |
| **Manual** | Vídeo por URL de embed, ou texto corrido |

Na geração por IA o admin escolhe **quais layouts** a IA pode usar. Cada slide tem um
layout, e é ele que define o desenho:

- `capa` — abertura, fundo escuro
- `topicos` / `prosa` — explicação em bullets ou parágrafos
- `destaque` — a regra que precisa grudar
- `comparacao` — o certo contra o errado, lado a lado
- `passos` — procedimento numerado
- `fechamento` — checklist final

A IA também desenha **ilustrações em SVG** para alguns slides. Não é geração de imagem:
é vetor escrito pelo modelo, o que escala sem borrar e não precisa de hospedagem de arquivo.

### Edição

O editor de slides mostra os campos de um lado e a **prévia real** do outro, usando o mesmo
componente que o aluno vê. Dá para trocar o layout, remover a ilustração e usar
**"Refazer este slide com IA"** com instrução livre ("deixe mais curto e vire comparação").
O refazer não grava nada: devolve para a tela e o admin decide se salva.

### Avaliação

O quiz é um **banco** (padrão: 12 perguntas), e cada tentativa sorteia um subconjunto
(padrão: 5). Tentativas consecutivas **não repetem nenhuma pergunta**, porque a escolha é
uma janela deslizante sobre uma ordem fixa por atribuição, e não sorteio aleatório.

Quem **reprova vê apenas quais errou**, sem a resposta certa. Quem aprova vê a revisão
completa. Isso é deliberado: entregar o gabarito a quem reprovou transforma a segunda
tentativa em cópia.

### Consumo pelo aluno

- Retoma de onde parou (progresso gravado no servidor, não no navegador)
- A avaliação só libera depois de passar por todos os slides
- Modo apresentação: abre em janela separada, sem menu, com botão de tela cheia
- Certificado imprimível com código de verificação assinado (HMAC)

### Administração

- Relatório de conclusão com taxa, filtro por cliente e exportação em Excel de 3 abas
- Lembretes automáticos de prazo (cron diário) e envio manual
- Cadastro de empresas e usuários, com convite de primeiro acesso por link de uso único
- 2FA por TOTP, bloqueio por tentativas, política de senha, histórico de senhas
- Interface completa em **português e espanhol**

---

## Como funciona por dentro

### Stack

- **Next.js (App Router) + TypeScript** — Server Components e Server Actions
- **Prisma + PostgreSQL** (Neon em produção)
- **Anthropic API** (Claude Opus 5) para geração de conteúdo
- **Tailwind CSS**
- Deploy contínuo na **Vercel** a cada push na `main`

### Modelo de dados

O `prisma/schema.prisma` é a melhor forma de entender, mas o resumo:

```
Cliente ──< Usuario ──< Atribuicao >── Treinamento ──< Slide
                            │                     └──< Pergunta ──< Alternativa
                            └──< Notificacao      └─── Arquivo (PDF/PPT)
```

**Não existe tabela de "tenant".** A separação entre empresas é feita por
`Usuario.clienteId`: um admin com `clienteId` nulo é o admin geral e vê tudo; um admin com
`clienteId` preenchido é admin daquela empresa e só vê ela. As regras ficam centralizadas em
`lib/escopo.ts` para não vazar dado entre clientes.

### Arquivos que valem ler primeiro

| Arquivo | Por quê |
|---|---|
| `prisma/schema.prisma` | O modelo de dados inteiro, comentado |
| `lib/escopo.ts` | Regra de separação entre empresas |
| `lib/actions.ts` | Todas as mutações (Server Actions) |
| `lib/ai.ts` | Prompts, schemas e chamadas ao modelo |
| `lib/quiz.ts` | Sorteio das perguntas por tentativa |
| `lib/svg.ts` | Sanitizador do SVG vindo da IA |
| `lib/status.ts` | Regra de concluído / pendente / vencido |

### Segurança

- Senhas com **scrypt** (`lib/password.ts`), nunca em texto puro
- Sessão em cookie **assinado com HMAC** e expiração de 8h server-side (`lib/auth.ts`)
- Bloqueio de conta após 5 tentativas erradas, por 15 minutos
- Primeiro acesso por **link de convite de uso único** (7 dias): a senha nunca trafega
  por email nem por mensagem
- O **SVG gerado pela IA é sanitizado por allowlist** antes de entrar no DOM
  (`lib/svg.ts`, 13 testes). Sem isso, um `<script>` ou um `onload=` vindo do modelo viraria
  XSS dentro de uma plataforma que vende segurança

### Testes

```bash
npm test
```

Cobertura deliberadamente estreita: a lógica pura e verificável (sorteio de perguntas e
sanitização de SVG). O resto é validado rodando a aplicação.

---

## Custo de operação

### IA

Medido em produção, com Claude Opus 5 (US$ 5,00 por milhão de tokens de entrada e
US$ 25,00 de saída):

| Operação | Entrada | Saída | Custo |
|---|---:|---:|---:|
| Gerar capacitação completa | 1.881 | 4.649 | **US$ 0,126** |
| Refazer um slide no editor | 1.530 | 687 | **US$ 0,025** |
| Gerar quiz de PDF enviado | variável | ~3.000 | *não medido* |

O quiz de arquivo é o único caminho em que a entrada cresce com o tamanho do documento,
porque o PDF vai inteiro para a API como documento (o modelo lê a página com layout e
imagens, em vez de a gente extrair texto e perder o que não é texto). Uma página consome
na ordem de 1.500 a 3.000 tokens de entrada.

### A propriedade que importa para precificar

**O custo de IA não escala por aluno.** Ele é pago uma vez, na criação da capacitação.
Atribuir o mesmo curso para 10 ou 10.000 funcionários custa zero em IA.

Uma empresa de 200 funcionários, com 8 capacitações por ano e 20 ajustes de slide, gasta
**US$ 1,50 por ano** em IA. Isso é menos de um centavo de dólar por funcionário por ano.
O custo real da operação está na infraestrutura fixa (hospedagem, banco, email), não no
modelo de linguagem.

### Como reconferir

Toda chamada de IA grava o consumo no log:

```
[IA] curso "Phishing no WhatsApp" — input=1881 output=4649 tokens
```

No painel da Vercel, em Runtime Logs, filtrando por `[IA]`. A conta é sempre
`(entrada × 5 + saída × 25) ÷ 1.000.000`, em dólares.

---

## Como rodar localmente

Pré-requisitos: **Node.js 20+** e uma URL de PostgreSQL (um banco free do Neon serve).

```bash
npm install
cp .env.example .env
```

Preencha as conexões do Postgres no `.env` e então:

```bash
npm run db:push
npm run db:seed
npm run dev
```

Sobe em http://localhost:3000.

> O seed cria dados de demonstração, incluindo de propósito **uma atribuição já vencida**,
> para você ver a regra de corte de acesso funcionando na hora.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (valida tipos) |
| `npm test` | Testes de lógica pura |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run db:reset` | Recria o banco do zero e popula |

⚠️ `db:reset` apaga tudo. Nunca aponte para o banco de produção.

---

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `POSTGRES_PRISMA_URL` | sim | Conexão com pooling (aplicação) |
| `POSTGRES_URL_NON_POOLING` | sim | Conexão direta (migrations e seed) |
| `SESSION_SECRET` | **em produção** | Assinatura do cookie de sessão |
| `ANTHROPIC_API_KEY` ou `ANTHROPIC_KEY` | para IA | Geração de conteúdo e avaliações |
| `APP_URL` | recomendada | Base dos links de convite enviados por email |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | para email | Envio pelo domínio do cliente |
| `RESEND_API_KEY` | opcional | Alternativa ao SMTP |
| `CRON_SECRET` | para lembretes | Protege a rota do cron de lembretes |

Sem chave da Anthropic a plataforma funciona normalmente; só as funções de IA ficam
indisponíveis, com aviso na tela.

O envio de email tem três camadas, nesta ordem: **SMTP → Resend → simulado**. Sem
nenhuma configurada, o convite não é enviado, mas o link aparece na tela do admin com botão
de copiar, então ninguém fica sem acesso.

---

## Decisões de projeto

Coisas que parecem estranhas até você saber o porquê.

**Multi-cliente sem tabela de tenant.** `Usuario.clienteId` faz o papel. Menos tabela e
menos junção, ao custo de exigir disciplina: toda consulta que lista dado de várias empresas
precisa passar por `lib/escopo.ts`.

**Sorteio de perguntas por janela deslizante, não aleatório.** Sorteio puramente aleatório
repetia demais: com banco de 12 e prova de 5, deu 4 perguntas repetidas na segunda
tentativa. A janela deslizante sobre uma ordem fixa por atribuição garante zero
sobreposição entre tentativas consecutivas.

**Ilustração em SVG, não imagem gerada.** A API não gera foto, mas escreve vetor bem. E
vetor é melhor aqui: escala, não borra, não precisa de armazenamento nem de CDN. O preço é
ter que sanitizar, o que é feito.

**PDF vai inteiro para a API, sem extração de texto.** Extrair texto perde diagramas,
tabelas e qualquer slide que seja imagem. Mandando o documento, o modelo lê a página como
ela é.

**"Refazer com IA" não grava.** O resultado volta para a tela e o admin decide. Se gravasse
direto, um refazer ruim destruiria o texto que a pessoa acabou de ajustar.

**Arquivo enviado fica no banco, numa tabela separada.** `Arquivo` guarda os bytes fora de
`Treinamento` para não pesar as consultas de lista e relatório. Funciona no volume atual,
mas **é o primeiro candidato a virar problema de custo** com muitos clientes subindo
material pesado; a saída natural é mover para armazenamento de objeto.

---

## O que ainda não existe

- **Phishing simulado.** É o que o mercado de conscientização espera de um concorrente do
  KnowBe4, e é a maior lacuna funcional hoje.
- **Logo e identidade visual por cliente.** As capacitações saem com a identidade da
  plataforma, não a da empresa.
- **Imagem própria no slide.** Só ilustração gerada pela IA.
- **SSO** e provisionamento de usuários (SCIM).
- **Trilha de auditoria** e tratamento formal de LGPD.
- **Testes automatizados abrangentes.** Hoje só a lógica pura é testada.

### Dívida conhecida

- O `.pptx` é renderizado por uma biblioteca que **volta ao primeiro slide** ao chegar no
  fim e falha em alguns arquivos. **PDF é o formato recomendado** e a tela de upload diz
  isso. A correção de verdade é converter PPT para PDF no servidor.
- O seed cria um admin com senha fraca conhecida. **Troque a senha desse usuário em
  qualquer ambiente que tenha dado real**, ou remova o usuário.
