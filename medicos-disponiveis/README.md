# Médicos disponíveis

PWA de roteiro de visitas médicas com conta própria: cada pessoa envia a sua
base (planilha, Word ou JSON), monta o roteiro de cada dia, registra as visitas
com meta de 1 ou 2 por médico, e fecha o ciclo com resumo. **Abre e funciona sem
internet**; sincroniza quando o sinal volta.

- **URL:** https://medicos-disponiveis.vercel.app
- **Cadastro é por convite** (código). Não existe cadastro aberto, de propósito.

## Como funciona, em uma frase

O aparelho é a cópia de trabalho (IndexedDB) e a nuvem é o arquivo (Supabase
Postgres). Toda ação escreve local e volta na hora; a subida acontece depois.
É isso que faz "marcar visita no elevador" nunca falhar.

## De onde veio

O projeto nasceu no ChatGPT Sites e chegou como ZIP; o código original está em
[`origem-chatgpt/`](origem-chatgpt/) como referência. Ele não rodava fora da
hospedagem do ChatGPT: usava banco **Cloudflare D1** e os cabeçalhos
`oai-authenticated-user-*` para identificar a pessoa — na Vercel a tela abriria e
nada salvaria.

A v1 deste repositório resolveu isso com `localStorage` e uma base fixa
(`medicos.json`) servida junto com o site. A v2 substituiu as duas coisas
porque a Beatriz pediu contas e base enviada por cada pessoa — e porque a base
fixa era um **arquivo público**: qualquer pessoa com a URL baixava a lista de
médicos. Hoje a base mora na conta, protegida por RLS.

## Arquitetura

| Parte | Onde | Papel |
| --- | --- | --- |
| PWA estático | Vercel (projeto `medicos-disponiveis`, Root Directory `medicos-disponiveis`, sem build) | tudo o que a pessoa vê |
| Banco | Supabase `medicos-disponiveis` (`lbphkvbucukfptdutmmp`, sa-east-1) | `bases`, `ciclos`, `convites` |
| Contas | Supabase Auth (e-mail + senha) | sessão, renovação de token, redefinição de senha |
| Cadastro | Edge Function `cadastrar` (`verify_jwt` desligado) | valida o convite e cria a conta |

**Custo zero**: Supabase free + Vercel Hobby. Nenhuma chamada a modelo de IA.

### Segurança — o que não pode ser afrouxado

- **`bases` e `ciclos` têm RLS com policy `usuario = auth.uid()`**, para leitura
  e escrita. É só isso que impede a chave publicável (que vai no navegador) de
  ler a base de outra pessoa. Verificado: conta A vê 1 de 2 bases; `anon` vê 0;
  gravar no nome de outra conta responde `42501 violates row-level security`.
- **`convites` tem RLS ligado e ZERO policy**, de propósito: nem anônimo nem
  autenticado enxergam a tabela. Só a Edge Function (service_role) mexe nela.
  Não criar policy "para facilitar".
- **A reserva do convite é uma única instrução** (`reservar_convite`:
  `UPDATE ... WHERE usado_por IS NULL RETURNING`). Dois cadastros simultâneos
  com o mesmo código não passam os dois. Se a criação da conta falhar depois,
  `concluir_convite(codigo, null)` devolve o código.
- **A service_role não existe neste repositório.** Ela vive só no ambiente da
  Edge Function. `config.js` carrega apenas a chave publicável, que sozinha não
  lê nada.
- Contas novas entram com `email_confirm: true` — sem etapa de e-mail. Se
  alguém esquecer a senha, o "Esqueci minha senha" usa o SMTP padrão do
  Supabase, que no plano gratuito é limitado; em caso de bloqueio, redefinir
  pelo painel é mais rápido.

## Navegação

**Uma tela por vez, sempre.** Seis telas (`entrar`, `senha`, `base`, `ajustes`,
`convites`, `app`) e nenhuma delas se sobrepõe a outra — a versão anterior tinha
um painel de conta flutuante que ficava por cima da tela de convites e deixava
tudo confuso.

- O cabeçalho tem **um atalho de início** (a marca "BR", que aparece só quando há
  para onde voltar) e **um botão de Ajustes** (engrenagem; a palavra só aparece
  em tela larga, porque com ela o título quebrava em duas linhas no iPhone).
- Toda tela secundária começa com a mesma barra: **← Voltar** e o nome da tela.
- O Voltar usa uma **pilha** (`visao.pilha`), então voltar de Convites cai em
  Ajustes, e voltar de Ajustes cai no app — nunca num lugar aleatório.
- Sem base carregada, a tela de base **não tem Voltar**: não existe app para
  onde ir, e um botão que não leva a lugar nenhum é pior que nenhum botão.
- O ícone é SVG desenhado, nunca emoji: a largura de um glifo de emoji muda
  entre sistemas e desalinha o cabeçalho (a mesma armadilha do app de lembretes).

## Convites (quem entra no app)

O cadastro é por código, e **quem gera os códigos é a dona da conta, dentro do
próprio app** (Conta → Convites): gera, anota para quem é, copia, acompanha quem
já usou e apaga os que ainda não foram usados. Convite já usado não some — ele é
o registro de como aquela conta entrou.

- A permissão mora em `perfis.pode_convidar` e é conferida **dentro das funções
  SQL**, não na tela. O botão some para quem não pode, mas isso é conforto: quem
  recusa é o banco.
- **A primeira conta criada no sistema nasce podendo convidar** (gatilho
  `contas_ganham_perfil`). Sem isso, o primeiro convite dependeria de alguém
  mexer no banco na mão — que é justamente o que esta tela existe para evitar.
- A função de borda `convites` roda com `verify_jwt` ligado e **descobre quem
  chamou perguntando ao Supabase pelo token**, nunca lendo um id do corpo do
  pedido (seria trivial mentir).
- Para promover outra pessoa a "pode convidar", é um `update` em `perfis`. Não há
  tela para isso de propósito: dar acesso ao acesso merece uma decisão pensada.

## O importador

Não existe layout fixo: **o app lê o cabeçalho da planilha, chuta o mapeamento e
mostra o que entendeu** antes de aplicar. Chutar em silêncio seria pior que não
importar — daria um roteiro errado com cara de certo.

Formatos aceitos:

- **`.xlsx` / `.csv` / `.tsv`** em formato longo (uma linha por disponibilidade)
  **ou largo** (uma coluna por dia da semana, com o horário na célula).
- **`.docx`** no formato do roteiro semanal da Beatriz
  (`SEGUNDA-FEIRA` / `MANHÃ — n médicos` / `📍 Bairro` / endereço /
  `• 08:00–12:00 — Nome (ESPECIALIDADE) — sala/complemento 101 ⚠`).
  **A especialidade entre parênteses é separada do nome na importação** — se
  ficasse colada, o nome do médico mudaria e as visitas já registradas no ciclo,
  que são guardadas por nome, deixariam de casar.
- **`.json`**: base do próprio app ou a lista achatada da v1 (em inglês).

Dois modos:

- **Nova base** substitui tudo.
- **Atualizar médicos** (merge): quem vier no arquivo é substituído por inteiro
  (dados e horários); quem não vier fica intacto. É o que permite mandar um
  arquivo com três linhas para corrigir três médicos. Campo vazio no arquivo não
  apaga o que já havia.

**O importador nunca inventa horário.** Linha sem hora reconhecível entra na
lista de problemas, visível na tela, e fica de fora.

## Procurar um médico sem saber o dia

Dia e turno têm a opção **"Todos"**. Com o dia em Todos, a tela muda de forma:
em vez de 755 disponibilidades (o mesmo médico repetido até quatro vezes),
mostra **um cartão por médico** — 314 —, com todos os horários dele embaixo e um
botão por horário para mandá-lo ao roteiro daquele dia.

É o modo de "achar o Dr. Fulano": digita o nome e ele aparece uma vez só, com
tudo o que se precisa saber. Escolher um dia volta ao agrupamento por bairro e
endereço, que é o modo de "planejar a terça".

A aba **Roteiro não tem "Todos"**: roteiro é sempre de um dia. Entrar nela com o
dia em Todos cai no dia de hoje.

## Ciclos, visitas e metas

- Um **ciclo** é o período de trabalho, fechado quando a pessoa quiser. Concluir
  gera resumo (médicos visitados, visitas, metas batidas, não encontrados,
  roteiro por dia), guarda no histórico e abre espaço para o próximo — com a
  mesma base ou com uma nova.
- Cada médico tem **meta de 1 ou 2 visitas** por ciclo, vinda da planilha
  (coluna de visitas) ou editável no cartão. O contador mostra `0/1`, `1/2`,
  `2/2`. O botão **trava na meta**: `3/2` não significa nada e estragaria o
  resumo.
- **"Não encontrei"** é diferente de visita: registra a tentativa sem contar.
- **A especialidade fica ao LADO do nome**, em corpo menor, dentro de uma
  fichinha — é o que se lê de relance para decidir se a parada vale. Numa linha
  separada embaixo, o olho não pega. Vale nas duas telas (Disponíveis e
  Roteiro), e some quando a base não traz especialidade, em vez de deixar uma
  caixinha vazia.
- **Mostrada abreviada, guardada inteira.** `PSIQUIATRIA` vira `Psiq`,
  `GINECOLOGIA/OBSTETRICIA` vira `Gineco/Obst`. O texto completo fica no
  `title` (toque longo) e é o que vai para o banco; **a busca casa as duas
  formas**, porque a pessoa procura pelo que está lendo na tela.
  As abreviações conhecidas estão numa tabela em `utilidades.js`; o que não
  estiver nela passa pela regra genérica.
- A meta vive na **base** (segue para o ciclo seguinte); a contagem vive no
  **ciclo** (zera no ciclo novo).

## Corrigir horário sem subir arquivo nenhum

A agenda muda o tempo todo: o médico trocou o dia, mudou a sala, começou a
atender à tarde. Antes, qualquer correção obrigava a montar uma planilha e
reimportar a base inteira para mexer numa linha. Agora dá para **editar direto
no app**, e o arquivo continua servindo para o que ele é bom: carregar tudo de
uma vez.

Três caminhos, todos para a mesma tela:

- **✎ Editar horário** no cartão do dia — corrigir o que está na frente dela;
- **✎** em cada horário e **+ Acrescentar outro horário para este médico** na
  visão por médico (dia = Todos) — o médico que passou a atender mais um dia;
- **Acrescentar um médico ou horário**, nos Ajustes — quem não está na base.

Decisões que não devem ser desfeitas:

- **Cada linha da agenda tem um `id` próprio** (`garantirIds` em `dados.js`).
  Sem ele, "o horário das 10h do Dr. Fulano na segunda" só poderia ser
  encontrado comparando cinco campos — e é exatamente esse conjunto que a edição
  muda. As bases antigas ganham ids na primeira abertura, e isso conta como
  alteração local (sobe para a nuvem), senão a cada sincronização os ids
  nasceriam de novo, diferentes, em cada aparelho.
- **O nome não é editável na tela de edição de horário.** O nome é a chave que
  liga o médico às visitas já registradas do ciclo; deixar trocá-lo ali
  transformaria "corrigir o horário" em "perder o histórico de visitas" sem
  aviso. Nome novo = médico novo (pelo Ajustes).
- **O turno segue o horário de início**, a não ser que a pessoa escolha na mão.
  Mudar 10:00 para 14:30 e continuar aparecendo na manhã é o tipo de erro que
  só se descobre no corredor do consultório. O seletor mostra "Pelo horário
  (Tarde)" para a escolha ficar visível antes de salvar.
- **Salvar leva para o dia do horário editado**, com o turno em Todos. Voltar
  para a lista onde ela estava esconderia justamente o que acabou de mudar.
- **Apagar o último horário de um médico apaga o médico** e o tira dos roteiros
  montados — deixar o nome sem nenhum horário criaria um cartão que não aparece
  em dia nenhum.
- A edição é **tratada como qualquer outra alteração local**: vale offline, entra
  na fila de sincronização e sobe quando houver sinal.
- **Importar uma base nova sobrescreve estas correções** — é o comportamento
  esperado de "trocar a base". Para corrigir sem perder, o caminho é **atualizar**
  (mesclagem por nome), não trocar.

## Médico sem horário não some da base

Antes, uma linha com nome mas sem dia ou sem hora ia para a lista de "linhas
fora" e **desaparecia**. Do ponto de vista de quem usa, o médico simplesmente
não existia no app — e ela só descobria isso no corredor do consultório.

Agora essa linha **entra na base marcada como incompleta** (`incompleto: true`,
com `dia` e `inicio` vazios). O único caso que continua fora é a linha **sem
nome**: sem nome não há por onde chamar a pessoa, nem como casar as visitas.

Como aparece:

- Uma **faixa no topo** diz quantos médicos estão sem dia ou sem horário, com
  um botão "Ver quais" que leva à base inteira e rola até eles. É uma faixa
  **separada** da de falha de armazenamento — as duas coisas são independentes
  e uma não pode apagar a outra.
- Na visão por médico (dia = Todos) eles vêm num **grupo no topo**, "Faltam
  dados", com o cartão marcado e a ficha "faltam dados" ao lado do nome.
  Misturados em ordem alfabética entre 314 nomes, ninguém acharia.
- Cada linha incompleta diz **o que falta** ("Falta o horário", "Falta o dia",
  "Falta dia e horário") e troca "+ roteiro" por **"Completar"**, que abre a
  tela de edição. Roteiro é sempre de um dia: sem dia não há o que adicionar.
- Preencher dia e hora tira a marca sozinho, e a conta da faixa cai.

Armadilha paga: **incompleto tem de ordenar por último**. Sem dia,
`DIAS.indexOf("")` é `-1`, então esses médicos subiam para antes de
segunda-feira e ficavam atravessados no meio da semana. A ordenação começa por
`Number(Boolean(item.incompleto))`, nos dois lugares que ordenam agenda
(`importar.js` e `dados.js`).

## Limpar a busca num toque

O `×` do `type="search"` não aparece no Safari do iPhone e some no Firefox, e
apagar palavra por palavra num campo cheio é irritante. O botão é nosso, com
alvo de 30px, e só aparece quando há texto.

Duas decisões: a caixa deixou de ser `<label>` e virou `<div>` (um botão dentro
de um `label` reencaminha o toque para o input, e o `×` disputava o clique com
o foco do campo); e **todo caminho que mexe na busca passa por `definirBusca()`**
— com dois caminhos independentes (digitar e limpar) o botão acabaria visível
com o campo já vazio em algum deles.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `index.html` | As seis telas: entrar, senha, base, ajustes, convites e app. |
| `estilo.css` | Desenho original da v1 (intacto no topo) + acréscimos da v2. |
| `config.js` | URL do Supabase e a chave publicável. |
| `js/utilidades.js` | Normalização de texto, datas, leitura de dia/turno/hora. |
| `js/deposito.js` | IndexedDB (cópia de trabalho) e a sessão no localStorage. |
| `js/nuvem.js` | Supabase REST: contas e as tabelas. Sem biblioteca oficial. |
| `js/importar.js` | Leitores de arquivo, mapeamento de colunas e mesclagem. |
| `js/dados.js` | Estado, mutações e sincronização. |
| `js/app.js` | Interface. |
| `vendor/` | SheetJS (planilha) e fflate (descompactar `.docx`), com licenças. |
| `sw.js` | Service worker. **Subir `VERSAO` troca o cache inteiro.** |
| `origem-chatgpt/` | O código como veio do ChatGPT Sites. |

## Armadilhas já pagas (não repetir)

- **O `\b` do JavaScript é ASCII.** `/^MANHÃ\b/` **nunca casa** — e por isso a
  primeira versão do leitor de Word descartou em silêncio os 298 médicos de
  todos os turnos da manhã, entregando 457 de 755 linhas com cara de sucesso.
  Nas regex em português, usar `(?![\p{L}\p{N}])` com a flag `u`. O mesmo vale
  para `às`/`até` ao partir "08:00 às 12:00".
- **Concluir o ciclo se desfazia sozinho.** A sincronização pulava todo item do
  histórico que já tinha `id`, então a conclusão nunca subia: o servidor
  continuava com o ciclo `aberto`, a leitura seguinte o trazia de volta e o
  histórico desaparecia. Hoje sobe todo item com `localEm`, por PATCH quando já
  tem `id`.
- **Chave ausente no IndexedDB devolve um `IDBRequest`, não `undefined`.**
  Devolver `resultado?.result ?? resultado` vazava o objeto de requisição como
  valor — e ele é "verdadeiro", então uma base inexistente passava por base
  carregada e o app abria vazio em vez de pedir a planilha.
- **Repintar a lista à toa apaga o que está sendo digitado.** Uma sincronização
  em segundo plano redesenhava `#lista` e limpava o nome do novo ciclo no meio
  da digitação. Toda pintura passa por `pintar()`, que compara o HTML antes de
  tocar no DOM — e a animação de entrada só roda quando muda o contexto (dia,
  turno, busca ou aba), senão a tela inteira pisca a cada marcação.
- **Detecção de coluna precisa de duas passadas.** Numa só, o campo "Hora de
  fim" capturava a coluna **Visitas** (contém "as") e a meta de visitas se
  perdia calada. Primeiro igualdade exata para todos os campos, depois pedaço de
  palavra e só para pistas com 5+ caracteres.
- **Elemento com `display:flex`/`grid` ignora o atributo `hidden`.** Daí o
  `[hidden]{display:none !important}`.
- **`.tela{display:grid}` quebrou o celular.** Seletor de classe vence
  `main{display:block}` da consulta de mídia, então o app ficava em duas colunas
  no telefone e o painel de resultados saía da tela. Layout do app é
  responsabilidade de `main`, e só.
- **Reservar convite não pode usar `usado_por`**: essa coluna aponta para
  `auth.users` e, na hora de reservar, a conta ainda não existe — a chave
  estrangeira derrubava todo cadastro. A reserva tem coluna própria
  (`reservado_em`) e expira em 5 minutos, para que um erro de rede no meio do
  caminho não queime o convite.
- **`revoke ... from public` tira o execute do `service_role` também.** As
  funções de convite precisam de `grant execute ... to service_role` explícito,
  senão a função de borda toma 403 e a tela diz "não foi possível validar o
  convite agora".
- **Variável com o mesmo nome de uma coluna** (`codigo`) faz o Postgres recusar a
  comparação por ambiguidade. Dentro de PL/pgSQL, nome de variável é diferente
  do nome da coluna.
- **Três defeitos empilhados quebravam o seletor de arquivo no iPhone.** A área
  era um `<label>` E o JS ainda chamava `input.click()` — dupla ativação, que no
  Safari abre o seletor e descarta a escolha. O input estava `hidden`
  (`display:none`), que o Safari recusa ativar por label. E o `accept` só com
  extensões deixa `.xlsx` cinza no app Arquivos do iOS. Hoje: container `div`, o
  input cobre a área inteira (borda incluída) com `opacity:0`, sem nenhum clique
  programático, e o `accept` traz extensões **e** tipos MIME.
- **Limpar `input.value` depois de ler o arquivo** é o que permite escolher o
  mesmo arquivo de novo depois de corrigi-lo; sem isso o `change` não dispara.
- **Painel flutuante sobre uma tela = confusão.** O antigo painel de conta ficava
  visível por cima da tela de convites, com botões soltos no fundo escuro e sem
  caminho de volta. Regra: uma tela por vez, e todo caminho tem volta. O teste
  `teste-navegacao.mjs` confere em cada passo que **exatamente uma** `.tela`
  está visível.
- **Faixa escura de altura fixa corta cartão alto ao meio.** O fundo era um
  degradê com corte em 210px (350px no celular) e, numa tela de ajustes
  comprida, a linha atravessava a página e parecia defeito de renderização. Hoje
  o navy está atrás do cabeçalho e de mais nada, com o conteúdo centralizado
  pelo próprio padding (`max(24px, calc((100% - 1120px)/2))`) — nada de `100vw`,
  que traz rolagem lateral por causa da barra de rolagem.
- **Rótulo maior no cabeçalho = título quebrado.** Trocar "Conta" por "Ajustes"
  bastou para o título virar duas linhas no iPhone 13. No celular o botão é só
  o ícone.
- **Confirmação em vermelho parece erro.** O mesmo lugar mostra sucesso e falha,
  então o tipo precisa aparecer na cor (`.save-message.boa`).
- **`localStorage` e IndexedDB podem lançar exceção** (navegação privada). Tudo
  em `try/catch`; a tela desenha sem eles e avisa que nada será guardado.
- **Nome de médico com apóstrofo** (`Sant'anna`) vai para atributo HTML:
  escapar `& < > " '` sempre (`esc()`). E a busca compara também sem espaços,
  porque a base escreve o mesmo sobrenome de três jeitos.
- **O leitor de planilha (880 KB) não entra no precache** do service worker: é
  carregado só quando alguém importa um arquivo, e guardado a partir daí. O app
  precisa abrir leve.
- **`cache.addAll` usa o cache HTTP do navegador.** Foi o defeito mais caro
  desta fase: com `Cache-Control` longo nos arquivos, o service worker novo
  enchia o cache NOVO com os arquivos VELHOS que o navegador já tinha guardado.
  O número da versão subia, o cache antigo era apagado, tudo parecia certo — e o
  app continuava exatamente o mesmo. Reproduzido num navegador de verdade
  (perfil persistente, servidor com os mesmos cabeçalhos da Vercel): **sem a
  correção o cache se chama `medicos-v7` e entrega o `app.js` de `medicos-v4`**.
  A correção é `new Request(caminho, { cache: "reload" })` em cada item da casca.
- **`caches.match(pedido)` sem `cacheName` varre TODOS os caches da origem**, e
  podia servir um arquivo de uma versão anterior. Passou a ser
  `caches.open(VERSAO).then((c) => c.match(pedido))`.
- **Resposta do Supabase nunca entra no cache do service worker** — só a própria
  origem. Uma resposta de API guardada seria dado velho fingindo ser novo.

## Testes

`teste-v2.mjs` (fora do repositório, no diretório de trabalho da sessão) roda 51
asserções; `teste-navegacao.mjs` mais 57 (uma tela por vez, todo caminho com
volta); `teste-editar.mjs` mais 22 (alterar dia/horário/sala, turno seguindo o
horário, acrescentar horário, acrescentar médico, excluir, e tudo sobrevivendo ao
recarregamento); `teste-todos.mjs` mais 21, `teste-arquivo.mjs` 18,
`teste-convites.mjs` 13 e `teste-especialidade.mjs` 8. São no Chromium com um Supabase simulado: cadastro por convite, importação
do Word real (755 disponibilidades, 314 médicos), planilha longa com cabeçalhos
estranhos, planilha larga, mesclagem, contador de visitas com meta, roteiro do
dia com os dois turnos, conclusão de ciclo, histórico, funcionamento offline com
marcação pendente e sincronização ao voltar o sinal, sair e entrar de novo, e
iPhone sem rolagem horizontal.

O RLS foi verificado direto no banco (conta A vê só a dela, `anon` vê nada,
convites invisíveis, escrita no nome de outra conta recusada).

**O que não foi testado desta sessão:** a ida real ao Supabase. O ambiente onde
o app foi construído não tem saída para a internet, então a primeira execução
contra o servidor de verdade é a da Beatriz.
