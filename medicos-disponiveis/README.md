# Médicos disponíveis

PWA de roteiro de visitas: mostra os médicos disponíveis por dia e turno,
agrupados por bairro e endereço, permite marcar visitas e montar o roteiro de
cada turno. Abre e funciona **sem internet**.

- **URL:** https://medicos-disponiveis.vercel.app
- Base: 755 disponibilidades, 314 médicos, 91 endereços, Segunda a Sexta,
  Manhã e Tarde (Ipanema, Leblon e Copacabana).

## De onde veio

O projeto nasceu no ChatGPT Sites e chegou como ZIP. O código original está
preservado em [`origem-chatgpt/`](origem-chatgpt/) — vale como referência do
que a interface fazia, não como o que roda hoje.

**O original não roda na Vercel**, e isso não é detalhe de configuração:

| O original usava | Por que não serve aqui |
| --- | --- |
| Banco **Cloudflare D1** (`db/index.ts` importa `cloudflare:workers`) | A Vercel não tem D1. A função quebra no primeiro `getDb()`. |
| Cabeçalhos `oai-authenticated-user-id` / `-email` para saber quem é a pessoa | Só existem na hospedagem do ChatGPT. Fora dela, toda requisição responde 401. |
| Vinext + Cloudflare Worker (`vite.config.ts`, `wrangler`) | Build voltado para Worker, não para a Vercel. |

Publicar aquele código como estava mostraria a tela e **não salvaria nada**:
cada visita marcada desapareceria ao recarregar.

O `EXPORTAR-PARA-GITHUB-E-VERCEL.md` que veio no pacote sugeria migrar para
Next.js + Supabase. **Não foi o caminho escolhido**, porque um backend aqui
resolveria um problema que este app não tem:

- é app de **uma pessoa só** — não há o que compartilhar, nem quem autorizar;
- os dados salvos são **alguns KB** de marcações;
- o uso real é **dentro de prédio de consultório em Ipanema**, corredor,
  elevador, sem sinal. Um app que depende de `fetch` para marcar visita falha
  exatamente na hora em que está sendo usado.

Então a persistência virou **`localStorage` do aparelho**, sem login e sem
servidor — mesma decisão do app `r2d-relatorio` deste repositório. A
contrapartida é honesta e está na tela: **os dados são daquele navegador**, e
por isso existem **Backup** e **Restaurar** (arquivo JSON).

Se um dia precisar dos dados em dois aparelhos ao mesmo tempo, aí sim entra
Supabase + login — e isso é um projeto, não um ajuste.

## O que mudou em relação ao original

Tudo o que a tela fazia continua funcionando: filtros por dia e turno, busca,
agrupamento por bairro e endereço, marcar visitado, selecionar para o roteiro,
roteiro por dia e turno com os três status (Pendente / Visitado / Não visitado),
remover, e o aviso "⚠ conferir horário cadastrado". Acrescentei:

- **Data na marca de visita.** No original `visited_doctors` guardava só o nome,
  sem data e sem virada de semana: na segunda semana de uso **tudo estaria
  riscado** e a marcação perderia sentido. Agora cada visita guarda o dia
  (`Visitado em 22/09`) e existe **"Começar nova semana"**, que devolve as
  visitas para pendente e **mantém os roteiros montados**.
- **Backup / Restaurar** em JSON, porque não há servidor.
- **Instalação como PWA** e funcionamento offline (service worker).
- **Progresso do turno** ("3 de 69 já visitados neste turno").
- **Botão de adicionar ao roteiro flutuando no rodapé no celular** — a seleção
  acontece rolando a lista; com o botão no topo era subir a página inteira.
- Busca **insensível a pontuação**: a base escreve o mesmo sobrenome de três
  jeitos (`Sant'anna`, `Sant Anna`), e qualquer um deles precisa achar todos.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `index.html` | Estrutura da tela. |
| `estilo.css` | O desenho original (bloco de cima, intacto) + os acréscimos da versão PWA, comentados. |
| `app.js` | Todo o comportamento: filtros, marcações, roteiro, backup, service worker. |
| `medicos.json` | A base, igual à do pacote original (755 registros). |
| `sw.js` | Service worker, cache-first. **Subir `VERSAO` troca o cache inteiro.** |
| `manifest.webmanifest` | Nome, ícones e cores da instalação. |
| `icone.svg` + `gerar-icones.mjs` | Fonte do ícone e geração dos PNGs (`node gerar-icones.mjs`, precisa de `sharp`). |
| `origem-chatgpt/` | O código como veio do ChatGPT Sites, para referência. |

## Armadilhas já pagas (não repetir)

- **A lista é redesenhada inteira a cada clique.** A animação de entrada dos
  cartões (`rise`) só pode rodar quando muda o contexto — dia, turno, busca ou
  aba. Sem esse freio (a classe `.animar` em `#lista`), cada "marcar como
  visitado" fazia a tela toda piscar.
- **Elemento com `display:flex`/`grid` no CSS ignora o atributo `hidden`.** Daí
  o `[hidden]{display:none !important}` no fim do `estilo.css`.
- **Dois avisos independentes.** Falhar em carregar `medicos.json` é uma coisa;
  o navegador não guardar as marcações é outra, e pior. Eram a mesma faixa, e o
  sucesso do `fetch` apagava o aviso de armazenamento bloqueado.
- **`localStorage` pode lançar exceção** (navegação privada, armazenamento
  bloqueado) já no `getItem`. Toda leitura e escrita é dentro de `try/catch`, e a
  tela desenha normalmente sem ele.
- **Nome de médico com apóstrofo** (`Victor Paulo Sant'anna`) vai para atributo
  HTML: escapar `& < > " '` sempre — o `esc()` existe para isso.
- **Buscar sem tirar a pontuação não acha o que está na base.** A normalização
  compara também a versão sem espaços, senão `Sant'anna` não encontra
  `Sant Anna`.
- **A sala às vezes vem vazia** (38 registros) e às vezes vem com sujeira do
  documento de origem (`211 *`, `1003 E 1004`). A tela só esconde a linha quando
  está vazia; não "limpar" esses valores sem conferir com a fonte.
- **"Nao Informado" e "Rio De Janeiro" aparecem como bairro** (1 registro cada),
  herdados da extração do `.docx`. São dados, não bug de agrupamento.

## Publicação

Projeto Vercel próprio (`medicos-disponiveis`), Root Directory
`medicos-disponiveis`, sem build — é HTML estático. Deploy automático da `main`.

## Como conferir antes de publicar

Não tem teste automatizado: é uma tela só, sem cálculo. O que precisa ser
conferido no navegador, no desktop **e** no celular:

1. Trocar dia e turno muda a contagem (Segunda/Tarde = 125, Terça/Manhã = 69).
2. Buscar `piraja` sem acento e `sant anna` sem apóstrofo acha resultados.
3. Marcar visitado, recarregar a página, a marca continuar lá com a data.
4. Montar um roteiro, trocar de dia, voltar, os itens continuarem no turno certo.
5. Backup, "Começar nova semana", Restaurar — e as visitas voltarem.
6. Modo avião: fechar e reabrir o app instalado; a lista tem de aparecer.
