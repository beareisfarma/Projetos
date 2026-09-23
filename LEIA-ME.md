# Branch `gh-pages` — só o site público

Esta branch **não é código-fonte**. Ela existe apenas para o GitHub Pages
servir arquivos prontos:

- `/` e `portfólio/`, `portfolio-v1/`, `portfolio-v2/` — o portfólio.
- `medicos-disponiveis/` — espelho do app, para o dia em que a Vercel bater a
  cota diária de deploys.

O código de verdade vive na branch **`main`**. Nunca desenvolver aqui.

## Por que esta branch já quebrou os deploys uma vez

Os projetos da Vercel apontam para este mesmo repositório e, por padrão,
constroem **todas as branches**. Como a `gh-pages` não tem as pastas
`lembretes/`, `r2d-relatorio/` e `cronometro-jogos/`, o Root Directory desses
três projetos não existia aqui e o build falhava — três e-mails de
"deployment failed" por push nesta branch.

Corrigido em 23/09/2026 com duas camadas, nos sete projetos:

1. **Prévias desligadas** (`previewDeploymentsDisabled`): só a branch de
   produção constrói.
2. **Ignored Build Step travado por branch**: a regra começa com
   `if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; fi`, então mesmo que
   alguém religue as prévias, nada fora da `main` constrói.
