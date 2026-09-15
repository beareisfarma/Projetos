# Memória do projeto

## Logo pessoal da Beatriz — "a minha logo" (BCR)

Quando a Beatriz pedir para "adicionar a minha logo" (ou "logo BCR"), ela se
refere ao monograma pessoal criado em 23/08/2026, no estilo **Elegante**:
as iniciais **BCR** em Playfair Display (convertida em curvas vetoriais),
entre filetes horizontais, com um pequeno losango neon (#d7ff1a) no topo
central. Ela usa essa logo ao lado do crédito "Created by Beatriz C Reis"
nos rodapés de todos os seus apps/sites.

Arquivos prontos em `logo/` (na raiz deste repositório):

- `logo/bcr-logo-inline.svg` — usa `currentColor`, herda a cor do texto ao
  redor. **É esta a versão para embutir inline em HTML** (foi assim que foi
  aplicada nos rodapés de `cronometro-jogos/index.html` e
  `cronometro-jogos/placar/index.html` — usar como referência de aplicação).
- `logo/bcr-logo-dark-bg.svg` / `logo/bcr-logo-light-bg.svg` — cor fixa
  (branca / #141414) para fundo escuro / claro.
- `logo/bcr-logo-dark-bg.png` / `logo/bcr-logo-light-bg.png` — PNGs
  transparentes em alta resolução (1600px).

Padrão de aplicação em rodapé (copiar dos apps existentes): SVG inline com
`height: 1.7rem` num flex row, seguido de `<span>Created by Beatriz C Reis</span>`.

## Contexto geral

- Apps "Cronômetro de Jogos" (4 modos: cronômetro, timer, HIIT, Tabata) e
  "Placar de Jogos" (vôlei) vivem em `cronometro-jogos/` (placar em
  `cronometro-jogos/placar/`), publicados na Vercel (projeto
  `cronometro-gamer`, deploy automático da branch `main`).
- **URL oficial: https://marqueseujogo.vercel.app** (domínio adicionado pela
  Beatriz em 23/08/2026; os endereços antigos `cronometro-gamer.vercel.app`
  e `projetos-6q65.vercel.app` continuam ativos no mesmo projeto).
- Identidade visual: tema escuro padrão + tema claro (toggle ☀️/🌙 no rodapé),
  amarelo neon `#d7ff1a`, fonte Anton inclinada (-6°) nos números, PWA
  instalável com funcionamento offline (service worker em
  `cronometro-jogos/sw.js`).
- Fluxo de publicação: commitar na branch de trabalho, push, e fazer
  fast-forward merge para `main` (a Vercel publica sozinha).
- **Vercel via MCP: o `teamId` é o slug `beareisfarma`**, NUNCA o `accountId`
  `team_66bC2Y1ngoNCmOwjkyA5D10I` que aparece na listagem de projetos. Passar o
  accountId devolve `403 forbidden ... scope "beareisfarmas-projects"`, que
  parece problema de autorização do conector e não é. Já custou uma
  reconexão inútil do conector.
- Projeto novo na Vercel nasce com **Vercel Authentication ligada**: a URL pede
  login antes de abrir. Desligar com `update_project_deployment_protection`
  (`ssoProtection.enabled=false`), senão o PWA e o push não funcionam.
- **Não existe ferramenta MCP para definir variáveis de ambiente na Vercel.**
  Esse passo é sempre manual, no painel.

## App "Lembretes" (`lembretes/`)

Assistente pessoal de prazos da Beatriz: ela manda um recado por texto ou áudio,
o interpretador lê a data, e o sistema notifica por Web Push.

- **As antecedências são escolhidas por lembrete**, não fixas: 2 dias / 1 dia /
  1 hora / 15 min / 5 min (`ANTECEDENCIAS` em `api/_lib/agenda.js`). O aviso na
  **hora exata do prazo é sempre criado** e não entra nessa lista. Padrão de um
  lembrete novo: `['d1','h1']`. Guardadas na coluna `antecedencias` (jsonb).
  A escada fixa antiga (7d/3d/dia/3h/30min) foi substituída por isso.
- A tela segue o padrão do app "Tô Aqui": contadores (pendentes / para hoje /
  em atraso), abas Pendentes|Hoje|Concluídos, cartões claros com bolinha de
  concluir e ações em link. Tema claro por padrão, escuro no toggle.
  A lista de opções em `index.html` precisa bater com a de `agenda.js`.

**Projeto Vercel `hdexternopremium`** (`prj_zYwqWIfQabSbyjPuYyvsCPss5FBn`), separado do `cronometro-gamer` — tem backend, então o
Root Directory na Vercel é `lembretes`. Não misturar com o app estático.

- **O projeto é de custo zero, e isso é um requisito, não um detalhe.** Tudo roda
  em camada gratuita: Vercel Hobby, Supabase free, cron-job.org, Web Push (VAPID,
  sem intermediário) e Groq Whisper free (2.000 transcrições/dia).
- Stack: funções serverless Node + **Supabase Postgres via PostgREST** (projeto
  `lembretes`, ref `oyyruucruevoefxzrzpj`, em sa-east-1/São Paulo) + Web Push
  (VAPID) + Whisper (Groq/OpenAI) para o áudio. Acesso pela `service_role`: as
  três tabelas têm RLS ligado **sem nenhuma policy**, de propósito — a chave
  anônima não acessa nada. Não criar policy permissiva "para facilitar".
- A retirada do aviso da fila é atômica no banco (`pegar_avisos_vencidos`,
  `DELETE ... RETURNING` com `FOR UPDATE SKIP LOCKED`). Não trocar isso por
  ler-depois-apagar: é o que impede dois ticks de notificarem o mesmo aviso.
- **Quem lê a data é o `api/_lib/interpretador-local.js`**, determinístico e
  gratuito (cobre "sexta às 14h", "dia 20", "amanhã de manhã", "em 2 semanas").
  A Claude API é **opcional** e só entra em recado sem data reconhecível;
  `MODO_INTERPRETACAO=local` desliga a IA de vez. Sem chave nenhuma o app
  funciona inteiro. Não reintroduzir a IA no caminho crítico.
- Nas regex em português, usar as bordas Unicode `(?<![\p{L}\p{N}])` /
  `(?![\p{L}\p{N}])`: o `\b` do JavaScript é ASCII e falha depois de ã/ç/ê.
- **OneSignal foi avaliado e descartado** (não economiza nada, não contorna a
  exigência da Apple de instalar na tela de início, e o service worker dele
  colide com o nosso). O porquê completo está no README.
- **A API roda numa Supabase Edge Function** (`api`, verify_jwt desligado), não
  na Vercel. Motivo: lá dentro `SUPABASE_SERVICE_ROLE_KEY` já existe no
  ambiente, então o projeto sobe sem ninguém cadastrar variável nenhuma.
  A Vercel serve só o PWA estático.
  - A função é **gerada** por `npm run build:funcao` a partir de `api/_lib/`.
    Nunca editar `supabase/functions/api/index.ts` na mão.
  - O deploy importa esse arquivo pela URL do GitHub **presa a um commit**.
    Ao republicar, trocar o commit na URL (`main` pega cache do raw e engana).
  - Três armadilhas do runtime Deno já pagas: escrever em `Deno.env` é
    proibido (a função usa um `process` próprio); `Deno.env.toObject()` também;
    e o caminho que chega ao roteador varia, por isso ele normaliza três formas.
- **Várias contas.** Tabela `usuarios` (senha em **hash bcrypt** via pgcrypto —
  nunca guardar senha em claro). `lembretes` e `push_inscricoes` têm coluna
  `usuario` com FK e cascade. **Toda leitura é escopada pela conta**; o lembrete
  de outra pessoa responde 404, nunca 403 (não confirma que existe).
  O tick é a única exceção: percorre os avisos de todo mundo e despacha para os
  aparelhos do dono (`despachar(mensagem, usuario)`).
  **Não existe cadastro público** — conta nova se cria por SQL, de propósito.
- **Login com limite de tentativas** na função `autenticar_acesso`: 5 erros
  bloqueiam aquela origem por 15 min. Estar bloqueado vence a senha certa, de
  propósito — checar credencial antes deixaria o limite decorativo. Não inverter.
- **Segredos ficam na tabela `config_app`** (RLS ligado, sem policy), lida pela
  função no primeiro request. Não colocar segredo em arquivo, em variável de
  ambiente nem no git.
- **O cron é o `pg_cron` do próprio banco** (job `lembretes-tick`, `* * * * *`),
  chamando o tick via `pg_net` com o segredo lido de `config_app`. Não precisa
  de cron-job.org nem do plano Pro da Vercel.
- **O núcleo é agnóstico de canal**: `api/_lib/canais.js` é uma lista de
  adaptadores. Plugar Telegram ou WhatsApp é acrescentar um objeto ali — o
  README traz o exemplo pronto do Telegram.
- Regras que não devem ser quebradas em manutenções futuras: adiar move o
  aviso e **nunca** o prazo; aviso não entregue é reenfileirado (3 tentativas);
  o aviso sai da fila antes de disparar (evita notificar em loop).
- **URL: https://hdexternopremium.vercel.app** (deploy automático da `main`). O projeto na Vercel
  chama-se `hdexternopremium`; o endereço antigo `lembretes-olive.vercel.app`
  saiu do ar com a renomeação.
  **Verificado ponta a ponta em 15/09/2026**: recado → escada → pg_cron → Web Push
  → notificação na tela de bloqueio do iPhone dela (`entregues: 1`).
- **No Safari do iPhone fora da tela de início, `window.Notification` não existe.**
  Ler `Notification.permission` sem guarda lança ReferenceError e derruba a
  renderização inteira. Usar sempre os helpers `permissao()` / `podePush()`.
  E confirmar com `registration.showNotification`, nunca `new Notification`
  (o construtor não exibe nada no iOS).
- Endpoints em `api/*.js` são a variante Vercel, mantida porque os 41 testes a
  exercitam e ela serve de reserva; o que está publicado é a Edge Function.
- Setup completo (chaves, Supabase, cron) em `lembretes/README.md`.
- `npm test` em `lembretes/` roda 41 testes com PostgREST e serviço de push falsos.
