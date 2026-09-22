# Espelho grátis no GitHub Pages

Serve para quando a cota diária de deploys da Vercel estourar (100 por dia na
conta inteira, plano gratuito) e o app precisar estar no ar **hoje**. O GitHub
Pages não tem cota diária de publicação.

## Endereço (no ar desde 22/09/2026)

    https://beareisfarma.github.io/Projetos/medicos-disponiveis/

Funciona porque o app não tem nenhum caminho absoluto: o `index.html`, o
`manifest.webmanifest` (`start_url` e `scope` são `.`) e a lista `CASCA` do
`sw.js` usam `./`. Em subpasta tudo continua resolvendo.

## Como publicar aqui

**A fonte do Pages é a branch `gh-pages`, não a `main`.** Push para a `main`
não chega ao ar — esse engano já custou uma rodada e um 404 na mão dela.

    git worktree add <tmp> origin/gh-pages
    # copiar o app para <tmp>/medicos-disponiveis/ (sem README, sem
    # gerar-icones.mjs, sem vercel.json, sem origem-chatgpt/)
    git -C <tmp> add -A && git -C <tmp> commit
    git push origin <branch-do-worktree>:gh-pages

A `gh-pages` também hospeda o **portfólio** dela, na raiz e em `portfolio-v1`,
`portfolio-v2` e `portfólio`. Publicar o app ali é **acréscimo numa subpasta**,
nunca substituição da árvore.

## Como conferir sem conseguir abrir o site

O proxy da sessão bloqueia o domínio `github.io` **e** a rota `/pages` da API,
então não dá para abrir o endereço nem ler a configuração. O que dá:

1. **Antes do push**: servir a árvore que vai subir e abrir a subpasta no
   Playwright — tela de entrar aparece, nenhum 404, nenhum erro de JS, e o
   escopo do service worker igual à subpasta.
2. **Depois do push**: acompanhar `pages build and deployment` pela API de
   Actions e conferir o resultado em `/deployments?environment=github-pages`
   (estado `success`). Essas duas rotas não são bloqueadas.

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
