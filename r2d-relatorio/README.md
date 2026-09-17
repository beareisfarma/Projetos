# Relatório de Ações do R2D

Ferramenta para o representante documentar **o que fez para executar o R2D** e
entregar ao gestor um relatório executivo em PDF ou imagem.

```
R2D original (PDF)  →  ações realizadas  →  evidências  →  indicadores
                    →  resultados  →  RELATÓRIO DE AÇÕES DO R2D
```

## O princípio do produto

**O R2D é o plano. Este sistema não cria, não altera e não substitui o R2D.**

O PDF do R2D entra só como documento de referência: o app lê o texto para
entender objetivos, estratégias e ações previstas, e usa isso para que cada
ação registrada possa apontar para o item do plano que ela responde. O
arquivo original nunca é escrito. O documento gerado é **complementar** — é
chamado de *Relatório de Ações do R2D* na capa, no cabeçalho de todas as
páginas e no nome do arquivo exportado. Em nenhum lugar ele se apresenta
como um plano novo.

| | |
|---|---|
| **R2D** | o que foi planejado |
| **Relatório de Ações** | o que foi feito para executar o plano |

## Como usar

Seis etapas, na barra do topo:

1. **Dados e R2D** — representante, produto, período, logo do produto
   (opcional) e o R2D em PDF.
2. **Plano do R2D** — a leitura do plano, para conferir e ajustar. Cada item
   ganha uma sigla (OBJ1, EST2, PLN3) usada para amarrar as ações.
3. **Ações realizadas** — `+ Registrar ação`, linha do tempo e filtros por
   período, categoria e busca.
4. **Indicadores** — market share, índice de evolução e atingimento de cota,
   um período por linha.
5. **Resultados** — resumo executivo, entregas, pendências, próximos passos
   e pontos de atenção.
6. **Relatório** — prévia página a página e exportação.

Não há cadastro, login, e-mail ou senha. Abra e use.

## O documento gerado

| Página | Conteúdo |
|---|---|
| 1 | Capa: marca institucional, título, produto, representante, período |
| 2 | Contexto do R2D: objetivos, estratégias, desafios, ações previstas |
| 3 | Indicadores: números do período e evolução |
| 4 | Execução do plano: previsto × realizado, ações por tipo, cobertura |
| 5+ | Ações realizadas em ordem cronológica, com evidências |
| última | Resultados e próximos passos |

Páginas sem conteúdo não são geradas: sem indicadores, não existe página de
indicadores. A paginação das ações é **medida no DOM** — cada bloco é
inserido, o `scrollHeight` é comparado com o `clientHeight` e, se passou,
abre página nova. Por isso uma ação com três fotos nunca vaza do papel.

### Exportação

- **Exportar PDF** — A4, uma página por folha, ~230 dpi. No celular abre a
  folha de compartilhamento (vai direto ao WhatsApp); no computador baixa.
- **Exportar imagens** — um PNG por página, para mandar por WhatsApp.
- **Imprimir** — usa a impressão do navegador. Gera PDF vetorial, com texto
  selecionável e arquivo menor, mas quem controla o resultado é o navegador.

A captura **não** sai da prévia da tela: ela é reduzida para caber no monitor,
e capturá-la daria um PDF na escala da janela. A exportação monta um palco
próprio, em tamanho natural, fora da vista.

## Identidade visual

A **logo institucional é fixa**. Não existe caminho no app para trocá-la,
remover ou enviar outra — a identidade da empresa é padronizada em todo
relatório gerado. A pessoa só pode acrescentar a **logo do produto**, que é
opcional e aparece discreta no alto da capa.

O símbolo está em `js/marca.js`, em SVG (só paths). O logotipo "APSEN" e a
assinatura saem como texto HTML, e isso é de propósito: o html2canvas
serializa `<svg>` como imagem e nesse caminho as webfonts não carregam —
`<text>` dentro de SVG sairia com a fonte errada no PDF.

> **O símbolo é uma reconstrução vetorial feita a partir do material de
> referência, não o arquivo oficial da marca.** Ele é fiel o suficiente para
> o tamanho em que aparece, mas se você tiver o SVG oficial da empresa,
> troque a constante `SIMBOLO` em `js/marca.js` por ele (mesma proporção,
> 148 × 74) e rode `npm run gen:icons`. Nada mais no app precisa mudar.

Paleta amostrada do material da empresa: navy `#004080` (marca, títulos,
estrutura) e `#1163b0` para marca de dado nos gráficos — o navy é escuro
demais para isso e reprova na banda de luminosidade de cor de gráfico.

## Gráficos

Um gráfico por indicador, lado a lado. Market share, índice de evolução e
atingimento de cota são todos "%", mas medem coisas diferentes em escalas
diferentes: juntar os três num gráfico só exigiria dois eixos, que é o erro
clássico de leitura. Série única por gráfico dispensa legenda, e o rótulo
direto fica só no primeiro e no último ponto — a série completa está na
tabela logo abaixo, que também é a versão acessível dos dados.
Com menos de dois períodos não existe evolução: o gráfico não é desenhado.

## Inteligência artificial — opcional

**O app funciona inteiro sem IA.** A leitura padrão do R2D é o
`js/extrator.js`: determinística, gratuita, offline, e que devolve vazio para
o que não estiver no documento em vez de chutar.

Duas funções opcionais entram por cima, quando a pessoa pede:

| Rota | O que faz |
|---|---|
| `POST /api/interpretar` | lê o R2D e organiza produto, período, objetivos, estratégias, desafios, ações previstas e metas |
| `POST /api/resumir` | escreve resumo executivo, entregas, pendências, próximos passos e pontos de atenção a partir do que já foi registrado |

Ambas usam `claude-opus-5` com saída em JSON Schema e **fallback do lado do
servidor ativado** (`fallbacks: "default"`): se um classificador recusar, o
pedido é atendido por outro modelo em vez de devolver erro. Os prompts são
fechados sobre o material enviado — a IA não inventa, não completa por
plausibilidade e não sugere boas práticas genéricas de vendas.

Sem `ANTHROPIC_API_KEY` no ambiente, as rotas respondem 501 e a tela segue
com a leitura local. Servido como site estático (sem as funções), o `fetch`
toma 404 e o resultado é o mesmo. **Isso custa dinheiro por chamada** —
alguns centavos por R2D lido. Se não quiser esse custo, é só não configurar
a chave: nenhuma função do app deixa de existir.

## Onde ficam os dados

Sem login, tudo mora **só no navegador deste aparelho** (IndexedDB: o
projeto numa loja, os Blobs das fotos em outra). Trocar de celular, limpar os
dados do site ou usar uma janela anônima começa do zero.

A saída honesta para isso é o **Backup** no topo: baixa um `.json` com o
relatório inteiro, fotos incluídas, e **Restaurar** traz de volta em qualquer
aparelho. Vale fazer backup antes de trocar de celular.

Cada endereço é uma origem diferente para o navegador: um relatório montado
em `a.vercel.app` não aparece em `b.vercel.app`.

## Rodando

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # 17 testes do leitor do R2D, dos gráficos e da formatação
npm run gen:icons  # regera os PNGs a partir do símbolo em js/marca.js
```

Não há build: é HTML, CSS e ESM servidos como estão. As bibliotecas
(`pdf.js`, `html2canvas`, `jsPDF`) e a fonte (Source Sans 3) estão em
`vendor/` e `fonts/` — nada é buscado em CDN, e o service worker guarda tudo,
então o app abre sem internet. Um representante monta o relatório no carro,
no corredor da farmácia, no consultório.

### Publicando na Vercel

Root Directory = `r2d-relatorio`. O `vercel.json` já está aqui. As funções em
`api/` só ganham vida se `ANTHROPIC_API_KEY` for cadastrada no painel — esse
passo é manual, não há ferramenta para ele.

Projeto novo na Vercel nasce com **Vercel Authentication ligada** e a URL
pede login antes de abrir. Desligar em *Settings → Deployment Protection*,
senão o PWA e o compartilhamento não funcionam.

## Estrutura

```
index.html            casca; as seis telas vivem em <section data-tela>
css/app.css           a ferramenta
css/relatorio.css     o documento A4 (vale na tela e na exportação)
js/marca.js           marca institucional — fonte única do símbolo
js/estado.js          modelo do relatório e persistência
js/db.js              IndexedDB
js/extrator.js        leitor local do R2D (padrão)
js/pdf-leitor.js      extração de texto do PDF
js/ia.js              cliente das rotas opcionais
js/graficos.js        SVG escrito na mão, sem biblioteca
js/relatorio.js       monta as páginas e pagina medindo no DOM
js/exportar.js        PDF, PNG e impressão
js/telas/*.js         uma por etapa
api/*.js              funções serverless opcionais
```

### Armadilhas já pagas (não desfazer sem ler)

- **Foto de evidência nunca é `<img>`.** O html2canvas ignora `object-fit` e
  estica a imagem no PDF. Toda foto entra como `background-image` +
  `background-size:cover` num `<div>`.
- **O espaçamento entre ações é ancorado no `:first-child`, não no
  `:last-child`.** Com `:last-child`, anexar o bloco seguinte fazia o
  anterior crescer 14 mm *depois* de já ter sido medido e aprovado — a última
  foto da página vazava para fora do papel.
- **Toda tela é esvaziada na troca de etapa**, não só a que entra. As seis
  convivem no mesmo documento, e uma tela inativa com conteúdo fazia
  `#listas` e `#b-seguir` casarem com a etapa errada no `querySelector`.
- **No cabeçalho das páginas internas entra só o símbolo.** O logotipo
  completo não cabe na faixa de 11 mm e passa por cima do filete.
- **Datas ISO são montadas na mão** (`'2026-09-08'.split('-')`). O
  `new Date('2026-09-08')` é lido como UTC e, em São Paulo, cai no dia 7.
- **Nas expressões em português, as bordas são Unicode**
  (`(?<![\p{L}\p{N}])`). O `\b` do JavaScript é ASCII e falha depois de
  ã, ç, ê — sem isso, "Reações adversas" viraria título da seção "ações".
- **Fotos são reduzidas a 1600 px na entrada.** Foto de celular chega com
  4000 px e 5 MB; vinte evidências seriam 100 MB no IndexedDB e uma
  exportação que trava o aparelho.
- **Nada de `filter`, `mix-blend-mode` ou `background-clip:text` na folha do
  documento**: o html2canvas não desenha e a página sai diferente do que se vê.
