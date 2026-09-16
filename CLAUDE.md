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
- **Recado com dia E hora não abre cartão de conferência**: a resposta do POST
  traz `dataExplicita`/`horaExplicita` (só na criação, não são colunas) e a tela
  mostra apenas a faixa "✓ Marcado: … — data, hora · ajustar". Pedir confirmação
  de uma data que ela mesma disse faz um recado completo parecer rascunho.
  Dia da semana pelo nome com a hora já vencida rola para a semana seguinte;
  "hoje"/"dia 20" com hora vencida avisam que passou em vez de inventar outra
  data — ela nomeou um dia, mover seria mentir.
- **Prazo e fichas de aviso ficam no próprio cartão de captura**, abaixo da
  Observação e antes dos botões. O POST aceita `recado` + `prazo` junto: o prazo
  digitado vence o que o interpretador leria (ela olhou o calendário; o parser
  deduz) e marca o lembrete como explícito, sem cartão de conferência. Não voltar
  a esconder essas opções atrás do botão Adicionar — é um clique a mais no
  caminho de quem está com pressa.
- **O selo da logo no cabeçalho tem fundo fixo** (`--selo-fundo:#16233f` nos dois
  temas), nunca `var(--ink)`: no tema escuro `--ink` é quase branco e o P neon
  some em cima dele. Logo não inverte com o tema — é a mesma marca nos dois,
  igual ao ícone da tela de início. **Toda mudança de logo/cor tem que ser vista
  nos dois temas**, não só no claro.
- Elemento com `display:flex` no CSS ignora o atributo `hidden` (que só traz
  `display:none` de fábrica). Sempre acompanhar de `.classe[hidden]{display:none;}`.
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
  Login certo apaga o contador; estar bloqueado não estende o bloqueio.
  **Na tela, 401 e 429 querem coisas opostas** (`tratouAcesso` em `index.html`):
  401 volta para o login, 429 mantém a sessão e mostra a faixa `#limite`.
  Derrubar no 429 faz a senha certa ser recusada e parecer que mudou sozinha.
  E `entrar()` faz **uma** requisição só (ela valida e já traz a lista): duas
  gastavam duas das cinco tentativas por abertura do app.
- **Perfil da conta** (`api/perfil.js` e a rota `perfil` na função): o nome que a
  pessoa deu ao assistente (coluna `usuarios.assistente`, máx. 24) e a troca de
  senha. O nome fica na **conta**, não no aparelho — trocar de celular não apaga.
  A apresentação ("Olá, chefe!…") só aparece quando o servidor **respondeu** e
  disse que não há nome; falha de rede não pode fazer o app perguntar de novo a
  quem já batizou o assistente.
  **Troca de senha**: pede a senha atual mesmo com a sessão aberta (celular
  desbloqueado na mão de outra pessoa não vira troca de senha), confere contra o
  hash dentro do Postgres (`trocar_senha`, security definer), mínimo 6
  caracteres. **Depois de trocar, a tela precisa atualizar a senha guardada no
  localStorage E no IndexedDB** — senão a próxima abertura tenta a senha velha,
  toma 401 e queima o limite de tentativas até se trancar sozinha.
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
- **URL oficial: https://assistentepessoal.vercel.app** (16/09/2026, escolhida pela
  Beatriz; deploy automático da `main`). O projeto na Vercel continua chamado
  `hdexternopremium` — ela **acrescentou domínios** em vez de renomear o projeto,
  então os endereços antigos seguem vivos e apontam para o mesmo deploy:
  `hdexternopremium.vercel.app`, `assistentepremium.vercel.app` e
  `lembretes-olive.vercel.app`.
  **Cada endereço é uma origem diferente para o navegador**: login, permissão de
  notificação, inscrição de push, cache e tema são separados por URL. Instalar o
  app em dois endereços com notificação ligada nos dois = **duas notificações por
  lembrete**, porque o tick despacha para todas as inscrições da conta.
  **Verificado ponta a ponta em 15/09/2026**: recado → escada → pg_cron → Web Push
  → notificação na tela de bloqueio do iPhone dela (`entregues: 1`).
- **No Safari do iPhone fora da tela de início, `window.Notification` não existe.**
  Ler `Notification.permission` sem guarda lança ReferenceError e derruba a
  renderização inteira. Usar sempre os helpers `permissao()` / `podePush()`.
  E confirmar com `registration.showNotification`, nunca `new Notification`
  (o construtor não exibe nada no iOS).
- Endpoints em `api/*.js` são a variante Vercel, mantida porque os 41 testes a
  exercitam e ela serve de reserva; o que está publicado é a Edge Function.
- **Nome do app: "Personal Assistant"** (16/09/2026). Era "HD Externo Premium",
  que era o HD da memória — mas o produto é um assistente, então o nome passou a
  dizer isso. A Beatriz pediu "Personal Assistance"; apontei que `Assistance` é
  a ajuda e `Assistant` é quem ajuda, e ela escolheu `Assistant`.
  **O endereço continua `hdexternopremium.vercel.app`** (renomear o projeto na
  Vercel troca a URL e derruba o PWA já instalado no iPhone dela).
- **Ícone: o monograma "P"** de Personal Assistant — haste (corpo), bojo (ombro)
  e um círculo cheio no vazio (cabeça). Sólido, não vazado: em 26px na aba do
  navegador um traço fino some. Nasceu de uma referência que a Beatriz trouxe
  (a logo do yeschat.ai), usada como direção e nunca como molde — o desenho é
  próprio. A cabeça de robô com antena e o cérebro anterior foram aposentados.
  A fonte é `lembretes/logo-assistente.svg`; os PNGs saem de `npm run gen:icons` (usa
  `sharp`, devDependency) e ficam commitados porque a tela de início do iPhone
  precisa deles. O mesmo SVG vai inline no cabeçalho do app — gerar a versão
  inline a partir do arquivo, nunca copiar à mão, senão as duas divergem.
  **`gerar-icones.mjs` usa `replaceAll`, não `replace`**: um desenho com traço E
  preenchimento tem `currentColor` em vários lugares, e só o primeiro sairia
  colorido — o resto viria preto sobre o fundo azul, ou seja, invisível.
  As listras inclinadas seguem valendo no Cronômetro/Placar.
- Setup completo (chaves, Supabase, cron) em `lembretes/README.md`.
- `npm test` em `lembretes/` roda 63 testes com PostgREST e serviço de push falsos.
