# Relatório de Execução do R2D

**https://r2d-relatorio.vercel.app**

Ferramenta para o representante registrar o que fez para executar um R2D já
aprovado, acompanhar os indicadores do produto mês a mês, e entregar à gerência
um relatório em PDF ou imagem.

```
R2D aprovado (referência)  →  ações realizadas + evidências  →  indicadores mês a mês
                           →  RELATÓRIO DE EXECUÇÃO
```

## O princípio do produto

**O R2D já existe e já foi aprovado com a gerente. Este app não o cria, não o
edita e não o substitui.**

O PDF entra só como referência: o app lê três coisas dele — o **objetivo**, o
**gap** e as **ações previstas** — e as usa como contexto no topo do relatório.
O arquivo original nunca é escrito. Não há tela de edição de plano, não há
siglas, não há vínculo entre ação e item do plano, não há percentual de
execução. Tudo isso é gerir um R2D, e não é para isso que a ferramenta existe.

| | |
|---|---|
| **R2D** | o plano, já elaborado e aprovado |
| **Relatório de Execução** | o que foi feito para colocar o plano em prática |

## Como usar

Quatro etapas, na barra do topo:

1. **Identificação e R2D** — nome, produto, logo do produto, período e o PDF do
   plano. Logo abaixo, os três campos de contexto lidos do R2D, para conferir.
2. **Ações realizadas** — `+ Registrar ação`. Cinco campos: data, o que foi
   feito, local/PDV/médico, informações ou resultados, e fotos. Linha do tempo
   com filtro por período e busca.
3. **Indicadores** — quais indicadores acompanhar e os valores mês a mês.
4. **Relatório** — prévia página a página e exportação.

Não há cadastro, login, e-mail ou senha. Abre e usa.

## Indicadores

Duas coisas separadas: **quais** indicadores acompanhar e os **valores** de cada
mês. Market Share e Índice de Evolução vêm prontos; qualquer outro pode ser
acrescentado, cada um com a sua unidade (`%` para percentual, em branco para
número índice).

Uma linha é marcada como **referência** — o marco do início do plano. O
relatório mostra a posição mais recente e quanto ela andou desde a referência.

> **O app não calcula, não estima e não completa indicador nenhum.** Os números
> são digitados a partir do relatório oficial da empresa. A ferramenta guarda,
> compara com a referência e desenha. É por isso que o extrator **descarta de
> propósito** a seção de indicadores do PDF do R2D: ler market share de dentro
> do plano seria inventar um número que vai para a gerência.

A tabela é editável mês a mês porque no começo do ciclo só existe a referência —
os meses vão sendo preenchidos conforme fecham.

## O documento gerado

**Três páginas para um ciclo típico.** A ordem responde à pergunta da gerente na
sequência em que ela a faz:

| | |
|---|---|
| Como o produto está? | faixa de indicadores: posição atual e quanto andou desde a referência |
| O que o plano queria? | objetivo, gap e ações previstas, do R2D |
| O que você fez? | ações em ordem cronológica, com fotos |
| E os números, mês a mês? | gráficos de evolução e a tabela completa |

**Não há capa.** Uma folha quase vazia antes do conteúdo só adia a informação
que a gerente abriu o arquivo para ver.

Tudo é paginado num **fluxo contínuo**, sem quebra forçada em lugar nenhum: as
ações começam na própria página de abertura se couber, e os gráficos começam
onde a última ação terminou. A paginação é **medida no DOM** — cada bloco é
inserido, o `scrollHeight` é comparado com o `clientHeight` e, se passou, abre
página nova. Por isso uma ação com três fotos nunca vaza do papel.

### Exportação

- **Exportar PDF** — A4, ~230 dpi. No celular abre a folha de compartilhamento
  (vai direto ao WhatsApp); no computador baixa.
- **Exportar imagens** — um PNG por página.
- **Imprimir** — usa a impressão do navegador: PDF vetorial, texto selecionável,
  arquivo menor, mas quem controla o resultado é o navegador.

A captura **não** sai da prévia da tela: ela é reduzida para caber no monitor, e
capturá-la daria um PDF na escala da janela. A exportação monta um palco
próprio, em tamanho natural, fora da vista.

## Identidade visual

A **logo institucional é fixa**. Não existe caminho no app para trocá-la,
removê-la ou enviar outra. A pessoa só acrescenta a **logo do produto**, que é
opcional e aparece discreta no alto do relatório.

A marca está em `js/marca.js`, **vetorizada do arquivo oficial da empresa**
(PNG 1024 com transparência, traçado com potrace). Duas constantes: `SIMBOLO`
(só a montanha, para o cabeçalho das páginas internas e os ícones) e `MARCA`
(montanha + logotipo, para a abertura e a barra do app). São só paths, sem
`<text>`: o html2canvas serializa `<svg>` como imagem e nesse caminho as
webfontes não carregam.

O `fill-rule` é **evenodd** e não pode sair: a estrela e a gota são vazados no
mesmo path do contorno, e com a regra padrão o miolo da estrela é preenchido —
ela vira um borrão azul saindo da montanha.

A cor vem da constante `COR` (`#004080`, navy amostrada do material impresso da
empresa). O arquivo oficial que originou o traçado vem num azul mais vivo
(`#0913b1`); se for esse o valor correto, troque `COR` e rode `npm run gen:icons`.

## Gráficos

Um gráfico por indicador, lado a lado. Market Share em `%` e Índice de Evolução
em número índice não cabem no mesmo eixo, e dois eixos num gráfico só é o erro
clássico de leitura. Série única dispensa legenda; o rótulo direto fica só no
primeiro e no último ponto, e o ponto de referência ganha um anel. A tabela mês
a mês logo abaixo é a série completa e a versão acessível dos dados. Com menos
de dois períodos não existe evolução: o gráfico não é desenhado.

## Inteligência artificial — opcional

**O app funciona inteiro sem IA.** A leitura padrão do R2D é o
`js/extrator.js`: determinística, gratuita, offline, e que devolve vazio para o
que não estiver no documento em vez de chutar.

`POST /api/interpretar` é o reforço opcional para R2D de formatação irregular:
lê o PDF e devolve objetivo, gap e ações previstas. Usa `claude-opus-5` com
saída em JSON Schema e fallback do lado do servidor (`fallbacks: "default"`).
O prompt é fechado sobre o documento — a IA não inventa, não completa por
plausibilidade e não toca em número de indicador.

Sem `ANTHROPIC_API_KEY` no ambiente a rota responde 501 e a tela segue com a
leitura local. **Cada chamada custa dinheiro** — alguns centavos por R2D lido.
Se não quiser esse custo, é só não configurar a chave: nenhuma função do app
deixa de existir.

## Onde ficam os dados

Sem login, tudo mora **só no navegador daquele aparelho** (IndexedDB: o projeto
numa loja, os Blobs das fotos em outra). Trocar de celular, limpar os dados do
site ou usar uma janela anônima começa do zero.

A saída para isso é o **Backup** no topo: baixa um `.json` com o relatório
inteiro, fotos incluídas, e **Restaurar** traz de volta em qualquer aparelho.

## Rodando

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # 21 testes: leitor do R2D, gráficos e formatação
npm run gen:icons  # regera os PNGs a partir da marca em js/marca.js
```

Não há build: é HTML, CSS e ESM servidos como estão. As bibliotecas (`pdf.js`,
`html2canvas`, `jsPDF`) e a fonte (Source Sans 3) estão em `vendor/` e `fonts/`
— nada é buscado em CDN, e o service worker guarda tudo, então o app abre sem
internet. Um representante monta o relatório no carro, no corredor da farmácia,
no consultório.

### Publicação

Projeto Vercel `r2d-relatorio`, Root Directory `r2d-relatorio`, deploy
automático da `main`. As funções em `api/` só ganham vida se
`ANTHROPIC_API_KEY` for cadastrada no painel — esse passo é manual.

## Estrutura

```
index.html            casca; as quatro telas vivem em <section data-tela>
css/app.css           a ferramenta
css/relatorio.css     o documento A4 (vale na tela e na exportação)
js/marca.js           marca institucional vetorizada — fonte única
js/estado.js          modelo do relatório, migração e persistência
js/db.js              IndexedDB
js/extrator.js        leitor local do R2D (padrão)
js/pdf-leitor.js      extração de texto do PDF
js/ia.js              cliente da rota opcional
js/graficos.js        SVG escrito na mão, sem biblioteca
js/relatorio.js       monta o documento e pagina medindo no DOM
js/exportar.js        PDF, PNG e impressão
js/telas/*.js         uma por etapa
api/interpretar.js    função serverless opcional
```

### Armadilhas já pagas (não desfazer sem ler)

- **Foto de evidência nunca é `<img>`.** O html2canvas ignora `object-fit` e
  estica a imagem no PDF. Toda foto entra como `background-image` +
  `background-size:cover` num `<div>`.
- **Toda foto ocupa um terço da largura**, tenha a ação uma ou seis. Deixar duas
  crescerem até metade da página fazia a evidência dominar o texto.
- **O espaçamento entre ações é ancorado no `:first-child`, não no
  `:last-child`.** Com `:last-child`, anexar o bloco seguinte fazia o anterior
  crescer *depois* de já ter sido medido e aprovado — a última foto da página
  vazava para fora do papel.
- **Toda tela é esvaziada na troca de etapa**, não só a que entra. Elas convivem
  no mesmo documento, e uma tela inativa com conteúdo fazia o `querySelector`
  casar com a etapa errada.
- **No cabeçalho das páginas internas entra só o símbolo.** O logotipo completo
  não cabe na faixa de 11 mm e passa por cima do filete.
- **Datas ISO são montadas na mão** (`'2026-09-08'.split('-')`). O
  `new Date('2026-09-08')` é lido como UTC e, em São Paulo, cai no dia 7.
- **Nas expressões em português, as bordas são Unicode**
  (`(?<![\p{L}\p{N}])`). O `\b` do JavaScript é ASCII e falha depois de ã, ç, ê
  — sem isso, "Reações adversas" viraria título da seção "ações".
- **"Estratégia" só vira ação prevista quando o R2D não trouxe lista de ações.**
  Num documento com as duas, somar as estratégias infla a lista com o "como"
  quando a gerente quer ver o "o quê".
- **Fotos são reduzidas a 1600 px na entrada.** Foto de celular chega com
  4000 px e 5 MB; vinte evidências seriam 100 MB no IndexedDB.
- **Nada de `filter`, `mix-blend-mode` ou `background-clip:text` na folha do
  documento**: o html2canvas não desenha e a página sai diferente do que se vê.
