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

## App "Lembretes" (`lembretes/`)

Assistente pessoal de prazos da Beatriz: ela manda um recado por texto ou áudio,
a Claude API interpreta a data, o sistema agenda uma **escada de avisos**
(7d/3d/1d/no dia/3h/30min/na hora/+2h se atrasado) e notifica por Web Push.

**É um projeto Vercel separado** do `cronometro-gamer` — tem backend, então o
Root Directory na Vercel é `lembretes`. Não misturar com o app estático.

- **O projeto é de custo zero, e isso é um requisito, não um detalhe.** Tudo roda
  em camada gratuita: Vercel Hobby, Upstash free, cron-job.org, Web Push (VAPID,
  sem intermediário) e Groq Whisper free (2.000 transcrições/dia).
- Stack: funções serverless Node + Upstash Redis (REST) + Web Push (VAPID) +
  Whisper (Groq/OpenAI) para o áudio.
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
- **O cron é externo** (cron-job.org, de minuto em minuto, batendo em
  `/api/tick`): o plano Hobby da Vercel só permite cron 1x/dia.
- **O núcleo é agnóstico de canal**: `api/_lib/canais.js` é uma lista de
  adaptadores. Plugar Telegram ou WhatsApp é acrescentar um objeto ali — o
  README traz o exemplo pronto do Telegram.
- Regras que não devem ser quebradas em manutenções futuras: adiar move o
  aviso e **nunca** o prazo; aviso não entregue é reenfileirado (3 tentativas);
  o aviso sai da fila antes de disparar (evita notificar em loop).
- Setup completo (chaves, Upstash, cron) em `lembretes/README.md`.
- `npm test` em `lembretes/` roda 41 testes com Redis e serviço de push falsos.
