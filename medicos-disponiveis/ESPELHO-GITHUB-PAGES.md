# Espelho grátis no GitHub Pages

Serve para quando a cota diária de deploys da Vercel estourar (100 por dia na
conta inteira, plano gratuito) e o app precisar estar no ar **hoje**. O GitHub
Pages não tem cota diária de publicação.

## Endereço

    https://beareisfarma.github.io/Projetos/medicos-disponiveis/

Funciona porque o app não tem nenhum caminho absoluto: o `index.html`, o
`manifest.webmanifest` (`start_url` e `scope` são `.`) e a lista `CASCA` do
`sw.js` usam `./`. Em subpasta tudo continua resolvendo.

## Ligar (uma vez só, no painel do GitHub)

Settings → Pages → **Source: Deploy from a branch** → branch `main`, pasta
`/ (root)` → Save. Em um ou dois minutos o endereço acima responde, e **todo
push para a `main` atualiza sozinho** — sem cota, sem build.

## O que este espelho NÃO muda

- **Os dados continuam no Supabase**, na conta de cada pessoa. O espelho é só
  outra cópia dos arquivos do app.
- **Endereço diferente = origem diferente para o navegador.** Login, cópia de
  trabalho no IndexedDB e cache do service worker são separados por URL. Quem
  abrir o espelho entra de novo com o mesmo e-mail e senha, e a base desce da
  nuvem. Trabalho feito offline num endereço só sobe a partir daquele aparelho
  e daquele endereço.
- **`.nojekyll` na raiz do repositório é obrigatório**: sem ele o GitHub roda o
  Jekyll no conteúdo, que ignora arquivos e pastas começando com `_` e pode
  engasgar em arquivo que não é do site.

## Por que não é o endereço oficial

A Vercel continua sendo a publicação principal (`medicos-disponiveis.vercel.app`),
porque é ela que tem os cabeçalhos de cache do `vercel.json` — em especial o
`Cache-Control: max-age=0, must-revalidate` no `sw.js`, que é o que faz uma
versão nova chegar rápido ao iPhone. O GitHub Pages serve com o cache padrão
dele, então a troca de versão pode demorar mais para aparecer.
