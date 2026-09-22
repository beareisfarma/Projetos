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

## Como a Beatriz quer receber o trabalho

**Todo trabalho visual volta com algo que ela possa ABRIR e usar, não só olhar.**
Print e PDF mostram o resultado; não deixam simular o uso. Sempre que mexer em
app, site ou tela, publicar e mandar a **URL** junto da resposta — de preferência
antes de explicar o que foi feito. Ela pediu isso explicitamente em 17/09/2026,
depois de receber duas rodadas só com imagem e PDF.

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
- **O selo da logo no cabeçalho tem fundo fixo** (`--selo-fundo:#fcfcfc` nos dois
  temas), nunca `var(--ink)`: um token que vira quase branco no tema escuro já
  fez a logo sumir uma vez. Logo não inverte com o tema — é a mesma marca nos dois,
  igual ao ícone da tela de início. **Toda mudança de logo/cor tem que ser vista
  nos dois temas**, não só no claro.
- **Os botões do topo (`.icone`) têm largura FIXA**, não padding. Com padding a
  largura seguia o glifo, e o iOS desenha `☀` como emoji (largo) e `☽` como
  texto (estreito) — trocar de tema mudava a largura do bloco de ações e o
  título "Personal Assistant" quebrava em duas linhas **só no tema escuro**.
  Os glifos levam `\uFE0E` (apresentação de texto) para não virarem emoji
  colorido, mas isso é tentativa: quem garante o layout é a largura fixa.
- Elemento com `display:flex` no CSS ignora o atributo `hidden` (que só traz
  `display:none` de fábrica). Sempre acompanhar de `.classe[hidden]{display:none;}`.
- **Período dito depois da hora manda no relógio**: "8h da noite" é 20h, não 8h.
  `RE_PERIODO_APOS` em `interpretador-local.js` consome o trecho (para sair do
  título) e corrige a hora. "12 da manhã"/"da madrugada" é meia-noite. Esse bug
  não fazia o app parecer quebrado — fazia marcar de manhã um compromisso da
  noite, que é pior.
- **Transcrição de áudio vem pontuada** e recortar a data do meio deixa lixo no
  título (", ,") e preposição solta no fim ("almoço com a Ana ao"). `limparTitulo`
  junta vírgulas repetidas e apara preposição final. Ao mexer nos recortes,
  conferir o título, não só a data.
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
- **Resumo diário** (`api/_lib/resumo.js` + `enviarResumos` no tick): uma
  notificação por dia, por conta — "Bom dia! Você tem X tarefas para hoje e Y
  atrasadas". Hora escolhida por conta em `usuarios.resumo_hora` (padrão **7**,
  `NULL` desliga; **0 é meia-noite, não "desligado"** — comparar contra null, não
  contra a veracidade do número).
  **A idempotência é `usuarios.resumo_em`** (data LOCAL do último resumo): o tick
  bate a cada minuto e sem isso seriam 60 "bom dia" por hora. A marcação é
  condicional na data anterior, então dois ticks cruzados não duplicam.
  `JANELA_HORAS = 4`: passou disso o dia é dado por perdido (um "bom dia" às 22h
  é pior que nenhum) e a data é marcada mesmo sem enviar. Só marca como enviado
  quando chegou em alguém — sem aparelho às 7h, ainda dá tempo dentro da janela.
  **O tick não pode mais retornar cedo quando não há aviso vencido**: o resumo
  roda em todo tick.
- **Atraso vira uma corrente diária** (`avisoDeAtraso` em `agenda.js`): vencido e
  ainda pendente, todo disparo agenda o aviso do dia seguinte, no **mesmo
  horário do prazo** (assim o número de dias é exato, não arredondamento de um
  horário fixo). Rótulo: "Em atraso há N dias". A corrente **anda sozinha e morre
  sozinha** — o tick ignora lembrete que não está pendente, e a linha da fila
  morre junto. Continua **sem limite de dias**, de propósito.
  Duas armadilhas já pagas: a referência do "próximo dia" é a hora **marcada**
  do aviso que acabou de sair (`aviso.em`), não o relógio — disparando adiantado
  o relógio apontaria para o mesmo dia e a corrente travaria; e o aviso diário é
  agendado **mesmo se a entrega falhou**, senão ficar uns dias sem aparelho
  inscrito mataria a corrente para sempre. A cobrança de 2h (`chave: 'atraso'`)
  continua existindo, é outra coisa: um empurrão no mesmo dia.
- **O painel de contadores fica no topo**, logo abaixo de "Seus prazos, sem
  surpresa", e cada um é botão: leva para a aba certa e **rola até a lista**
  ("em atraso" vai para Pendentes e para no grupo "Em atraso"). Não devolver
  esse painel para o fim da página — número que ela só vê rolando não serve.
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
- **Paleta do app: navy `#24293f`, azul `#4a749e`, off-white `#fcfcfc`**
  (16/09/2026). As três foram **amostradas do arquivo** da referência que a
  Beatriz trouxe (a logo do yeschat.ai), não estimadas no olho. O azul virou o
  `--accent` do app inteiro — botões, fichas selecionadas, destaques — no lugar
  do amarelo neon, que ficava brigando com a logo. `--on-accent` é branco:
  contraste medido em 4.9:1, acima do 4.5 que o WCAG AA pede.
  **O neon `#d7ff1a` só sobrevive no losango da logo pessoal BCR no rodapé** —
  aquilo é marca dela, não tema do app. E segue valendo no Cronômetro/Placar.
- **Ícone: o monograma "P"** de Personal Assistant — haste (corpo), bojo (ombro)
  e um círculo no vazio (cabeça), navy com a cabeça azul sobre ladrilho
  off-white. Sólido, não vazado: em 26px na aba do navegador um traço fino some.
  Nasceu de uma referência que a Beatriz trouxe (a logo do yeschat.ai), usada
  como direção e nunca como molde — o desenho é próprio. A cabeça de robô com
  antena e o cérebro anterior foram aposentados.
  **O SVG carrega as próprias cores** (são duas, e a marca não muda com o tema),
  então `gerar-icones.mjs` não recolore nada — só ajusta o tamanho e põe o fundo.
  A fonte é `lembretes/logo-assistente.svg`; os PNGs saem de `npm run gen:icons` (usa
  `sharp`, devDependency) e ficam commitados porque a tela de início do iPhone
  precisa deles. O mesmo SVG vai inline no cabeçalho do app — gerar a versão
  inline a partir do arquivo, nunca copiar à mão, senão as duas divergem.
  As listras inclinadas seguem valendo no Cronômetro/Placar.
- Setup completo (chaves, Supabase, cron) em `lembretes/README.md`.
- `npm test` em `lembretes/` roda 74 testes com PostgREST e serviço de push falsos.

## App "Relatório de Execução do R2D" (`r2d-relatorio/`)

**URL: https://r2d-relatorio.vercel.app** — projeto Vercel `r2d-relatorio`
(`prj_XO2aIpmlqDVUuci5eY99McldUbr9`), ligado a `beareisfarma/Projetos`, Root
Directory `r2d-relatorio`, deploy automático da `main`, Vercel Authentication
desligada. Nasceu em 17/09/2026. Identidade **APSEN** (não é a marca pessoal
da Beatriz).

- **O princípio, e ele não pode ser diluído: o R2D já existe e já foi aprovado
  com a gerente dela. Este app não cria, não edita e não substitui o plano.**
  O PDF entra só como referência, e o app lê TRÊS coisas dele: **objetivo**,
  **gap** e **ações previstas**. Nada de tela de edição de plano, siglas
  OBJ/EST/PLN, vínculo entre ação e item do plano, cobertura ou percentual de
  execução — a v1 tinha tudo isso e a Beatriz recusou: *"você ainda não
  compreendeu exatamente a proposta… é mais simples do que você está fazendo"*.
  O que o app registra é a **execução**: ações e indicadores.
- **A ação tem CINCO campos**, os que ela listou: data, ação realizada,
  local/PDV/médico, informações ou resultados relevantes, e fotos. Não
  reintroduzir categoria, objetivo da ação, próximo passo nem observações
  separadas.
- **Quatro etapas**: Identificação e R2D → Ações realizadas → Indicadores →
  Relatório. Não existe etapa de fechamento com resumo executivo, entregas,
  pendências e pontos de atenção — era máquina de consultoria, não foi pedida.
- **Indicadores são o segundo eixo do produto.** Ela define quais acompanhar
  (Market Share em `%` e Índice de Evolução como **número índice, sem `%`** vêm
  prontos; outros podem ser acrescentados, cada um com sua unidade). Uma linha é
  a **referência** (marco de início do plano) e as demais são os meses, editáveis
  conforme fecham.
  **REGRA DELA, EXPLÍCITA: o app não calcula, não estima e não completa
  indicador nenhum.** Ela digita os valores reais; a ferramenta guarda, compara
  com a referência e desenha. Por isso o extrator **descarta de propósito** a
  seção de indicadores/metas do PDF — ler market share de dentro do R2D seria
  inventar um número que vai para a gerência. Diferença entre dois valores que
  ela digitou é comparação, não cálculo, e é permitida.
- **O relatório tem TRÊS páginas num ciclo típico** e conta a história na ordem
  em que a gerente pergunta (ela escolheu "números primeiro"): faixa de
  indicadores (atual vs. referência) → objetivo e gap do R2D → ações
  cronológicas com fotos → gráficos e tabela mês a mês. **Sem capa.** Tudo num
  fluxo contínuo de paginação, sem quebra forçada em lugar nenhum.
- **A marca em `js/marca.js` foi vetorizada do arquivo oficial** que a Beatriz
  enviou (PNG 1024 com alfa, traçado com potrace). Duas constantes: `SIMBOLO`
  (só a montanha — cabeçalho das páginas internas e ícones) e `MARCA` (montanha
  + logotipo — abertura e barra do app). Nada de `<text>` em SVG: o html2canvas
  serializa SVG como imagem e a webfont não carrega nesse caminho.
  **O `fill-rule` é `evenodd` e não pode sair**: a estrela e a gota são vazados
  no mesmo path do contorno; com nonzero o miolo da estrela é preenchido e ela
  vira um borrão azul. Esse bug já aconteceu — o extrator de path copiou só o
  `d` e deixou o `fill-rule` do potrace para trás.
  A cor sai da constante `COR` (`#004080`, navy do material impresso); o arquivo
  oficial vem em `#0913b1`. **Pergunta ainda em aberto com ela: qual das duas é
  o valor de marca correto.**
- Paleta: navy **#004080** (marca, títulos, estrutura) e **#1163b0** só para
  marca de dado em gráfico (o navy reprova na banda de luminosidade).
- **Um gráfico por indicador, lado a lado.** `%` e número índice não cabem no
  mesmo eixo. Série única ⇒ sem legenda; rótulo direto só no primeiro e no
  último ponto; o ponto de referência ganha um anel; a tabela abaixo é a versão
  acessível. Menos de dois períodos não desenha nada.
- **Sem cadastro, sem login, sem e-mail.** A contrapartida é que tudo mora no
  IndexedDB daquele navegador — por isso existem **Backup** e **Restaurar**
  (JSON com as fotos embutidas) no topo.
- **A IA é opcional e fica fora do caminho crítico** (mesma decisão do app de
  lembretes). A leitura padrão do R2D é o `js/extrator.js`, local e
  determinístico, que devolve vazio em vez de chutar. `api/interpretar.js` usa
  `claude-opus-5` com JSON Schema e `fallbacks: "default"`; sem
  `ANTHROPIC_API_KEY` responde 501 e nada deixa de funcionar. **Cada chamada
  custa dinheiro** — este app não é de custo zero se a chave for cadastrada.
- **Nada de CDN**: pdf.js, html2canvas, jsPDF e a fonte Source Sans 3 estão em
  `vendor/`/`fonts/` e o service worker guarda tudo. O app abre offline, que é o
  cenário real (corredor de farmácia, consultório).
- Armadilhas já pagas, todas com o porquê no `README.md` e no código:
  - **Foto de evidência nunca é `<img>`** — o html2canvas ignora `object-fit` e
    estica no PDF. Sempre `background-image` + `background-size:cover` num div,
    e **um terço da largura** por foto.
  - **Espaçamento entre ações ancorado no `:first-child`**, nunca no
    `:last-child`: anexar o bloco seguinte fazia o anterior crescer depois de já
    medido, e a última foto vazava da página.
  - **Toda tela é esvaziada na troca de etapa**, não só a que entra — elas
    convivem no mesmo documento e o `querySelector` casava com a etapa errada.
  - **A exportação monta um palco próprio em tamanho natural**, fora da vista:
    capturar a prévia (reduzida por transform) daria um PDF na escala da janela.
  - Cabeçalho de página interna leva **só o símbolo**.
  - **"Estratégia" só vira ação prevista quando o R2D não trouxe lista de
    ações** — somar as duas infla a lista com o "como" quando se quer o "o quê".
  - Datas ISO montadas na mão; bordas Unicode nas regex.
- `estado.js` tem migração da v1 para a v2: o plano estruturado antigo vira
  texto nos campos novos e as três colunas fixas de indicador viram definições.
- `npm test` roda 21 testes (leitor do R2D, gráficos, formatação). Fluxo
  verificado ponta a ponta com Playwright: upload de PDF → 5 ações com 6 fotos →
  4 meses de indicadores → relatório de 3 páginas → PDF de 0,82 MB em 1,3 s, sem
  erro de console, no desktop e no iPhone.

## App "Médicos disponíveis" (`medicos-disponiveis/`)

**URL: https://medicos-disponiveis.vercel.app** — projeto Vercel
`medicos-disponiveis` (`prj_d3KGTq55XhH0DAi0G4R87AaggTVS`), ligado a
`beareisfarma/Projetos`, Root Directory `medicos-disponiveis`, sem build,
deploy automático da `main`, Vercel Authentication desligada. Nasceu em
22/09/2026, a partir de um ZIP que a Beatriz montou no ChatGPT Sites.

Roteiro de visitas médicas: escolhe dia e turno, lista os médicos disponíveis
agrupados por bairro e endereço, marca visitas e monta o roteiro de cada turno.
Base de 755 disponibilidades (314 médicos, 91 endereços, Ipanema/Leblon/Copacabana).

- **O original não rodava na Vercel, e não era questão de configuração**: usava
  banco **Cloudflare D1** (`db/index.ts` importa `cloudflare:workers`) e os
  cabeçalhos `oai-authenticated-user-*` para identificar a pessoa. Fora da
  hospedagem do ChatGPT, a tela abriria e **nada salvaria**. O código como veio
  está preservado em `medicos-disponiveis/origem-chatgpt/`.
- **Recusada de propósito a migração para Next.js + Supabase** que o pacote
  sugeria: é app de uma pessoa, os dados salvos são poucos KB e o uso real é
  dentro de prédio de consultório, sem sinal — um backend falharia justamente na
  hora de marcar a visita. Virou **PWA estático com `localStorage`**, mesma
  decisão do `r2d-relatorio`. A contrapartida são **Backup e Restaurar** em JSON.
  Sincronizar entre dois aparelhos é que exigiria Supabase + login: é projeto,
  não ajuste.
- **A marca de visita guarda a data e existe "Começar nova semana"**. No
  original `visited_doctors` guardava só o nome: na segunda semana de uso tudo
  estaria riscado e a marcação perderia sentido. Zerar as visitas **mantém os
  roteiros montados**.
- **A lista é redesenhada inteira a cada clique**, então a animação de entrada
  dos cartões só roda quando muda o contexto (dia, turno, busca ou aba) — é o
  que a classe `.animar` em `#lista` controla. Sem esse freio, cada marcação
  fazia a tela toda piscar.
- **Busca insensível a pontuação**: a base escreve o mesmo sobrenome de vários
  jeitos (`Sant'anna`, `Sant Anna`) e a comparação também é feita sem espaços.
  Nome com apóstrofo vai para atributo HTML — escapar sempre (`esc()`).
- **No celular o botão "Adicionar ao roteiro" flutua no rodapé** enquanto há
  seleção (classe `selecionando` no `body`): a seleção acontece rolando a lista,
  e com o botão no topo era subir a página inteira para confirmar.
- Dois avisos independentes na faixa do topo: falhar em carregar `medicos.json` é
  uma coisa, o navegador não guardar as marcações é outra — o sucesso de um não
  pode apagar o outro. E `localStorage` pode lançar exceção já no `getItem`
  (navegação privada): tudo dentro de `try/catch`, a tela desenha sem ele.
- Identidade: o desenho é o que veio do ChatGPT (navy `#071f2b`, teal `#14b8a6`),
  preservado. O ícone (pino com cruz) é próprio. Logo pessoal BCR no rodapé.
- Sem testes automatizados — é uma tela só, sem cálculo. A lista do que conferir
  no navegador está no fim do `medicos-disponiveis/README.md`.
