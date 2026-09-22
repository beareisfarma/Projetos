# Como levar este projeto para GitHub e Vercel

Este pacote contém o código-fonte do site **Médicos disponíveis**.

## Atenção antes de publicar no Vercel

O projeto original foi construído para ChatGPT Sites usando:

- Vinext/Next.js;
- Cloudflare Worker;
- banco Cloudflare D1;
- identificação do usuário enviada pela hospedagem do ChatGPT.

O GitHub aceita o projeto como está, mas o Vercel não oferece D1 nem os cabeçalhos de identificação do ChatGPT. Portanto, uma publicação direta no Vercel pode exibir a interface, porém o salvamento de médicos visitados e dos roteiros não funcionará corretamente.

Para manter essas funções no Vercel, peça à IA que fizer a migração para:

- Next.js compatível com Vercel;
- Supabase Postgres para persistência;
- autenticação simples ou uso individual com um único usuário;
- variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Prompt pronto para outra IA

> Migre este projeto do ChatGPT Sites/Cloudflare para Vercel. Preserve integralmente a interface, a base de médicos, os filtros, as marcações de visitado e os roteiros por dia e turno. Substitua Cloudflare D1 e os cabeçalhos `oai-authenticated-user-*` por Supabase. Crie o SQL das tabelas e políticas RLS, um `.env.example` sem segredos e deixe o projeto compatível com implantação no Vercel. Não remova nenhuma função existente.

## Colocar no GitHub pelo navegador

1. Acesse <https://github.com/new>.
2. Crie um repositório, por exemplo `medicos-disponiveis`.
3. Extraia este ZIP no computador.
4. No repositório, escolha **Add file → Upload files**.
5. Envie os arquivos e pastas extraídos, não o ZIP fechado.
6. Confirme em **Commit changes**.

Para projetos com muitos arquivos, é mais confiável usar GitHub Desktop ou Git pelo terminal.

## Publicar no Vercel depois da adaptação

1. Acesse <https://vercel.com/new>.
2. Importe o repositório do GitHub.
3. Cadastre as variáveis de ambiente solicitadas pela versão adaptada.
4. Clique em **Deploy**.

## Arquivos principais

- `app/page.tsx`: tela principal e interações.
- `app/api/visits/route.ts`: marcações de visita.
- `app/api/itinerary/route.ts`: roteiros por dia e turno.
- `public/medicos.json`: base de médicos e disponibilidades.
- `db/schema.ts`: estrutura atual do banco.
- `drizzle/`: migrações do banco atual.

## Segurança

O pacote não deve conter senhas ou chaves privadas. Nunca envie arquivos `.env` com credenciais para um repositório público.
