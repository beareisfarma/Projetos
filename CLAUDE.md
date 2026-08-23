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
- Identidade visual: tema escuro padrão + tema claro (toggle ☀️/🌙 no rodapé),
  amarelo neon `#d7ff1a`, fonte Anton inclinada (-6°) nos números, PWA
  instalável com funcionamento offline (service worker em
  `cronometro-jogos/sw.js`).
- Fluxo de publicação: commitar na branch de trabalho, push, e fazer
  fast-forward merge para `main` (a Vercel publica sozinha).
