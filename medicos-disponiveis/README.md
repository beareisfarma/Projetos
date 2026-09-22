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

## O importador

Não existe layout fixo: **o app lê o cabeçalho da planilha, chuta o mapeamento e
mostra o que entendeu** antes de aplicar. Chutar em silêncio seria pior que não
importar — daria um roteiro errado com cara de certo.

Formatos aceitos:

- **`.xlsx` / `.csv` / `.tsv`** em formato longo (uma linha por disponibilidade)
  **ou largo** (uma coluna por dia da semana, com o horário na célula).
- **`.docx`** no formato do roteiro semanal da Beatriz
  (`SEGUNDA-FEIRA` / `MANHÃ — n médicos` / `📍 Bairro` / endereço /
  `• 08:00–12:00 — Nome — sala/complemento 101 ⚠`).
- **`.json`**: base do próprio app ou a lista achatada da v1 (em inglês).

Dois modos:

- **Nova base** substitui tudo.
- **Atualizar médicos** (merge): quem vier no arquivo é substituído por inteiro
  (dados e horários); quem não vier fica intacto. É o que permite mandar um
  arquivo com três linhas para corrigir três médicos. Campo vazio no arquivo não
  apaga o que já havia.

**O importador nunca inventa horário.** Linha sem hora reconhecível entra na
lista de problemas, visível na tela, e fica de fora.

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
- A meta vive na **base** (segue para o ciclo seguinte); a contagem vive no
  **ciclo** (zera no ciclo novo).

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `index.html` | As quatro telas: entrar, nova senha, base e app. |
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
- **`localStorage` e IndexedDB podem lançar exceção** (navegação privada). Tudo
  em `try/catch`; a tela desenha sem eles e avisa que nada será guardado.
- **Nome de médico com apóstrofo** (`Sant'anna`) vai para atributo HTML:
  escapar `& < > " '` sempre (`esc()`). E a busca compara também sem espaços,
  porque a base escreve o mesmo sobrenome de três jeitos.
- **O leitor de planilha (880 KB) não entra no precache** do service worker: é
  carregado só quando alguém importa um arquivo, e guardado a partir daí. O app
  precisa abrir leve.
- **Resposta do Supabase nunca entra no cache do service worker** — só a própria
  origem. Uma resposta de API guardada seria dado velho fingindo ser novo.

## Testes

`teste-v2.mjs` (fora do repositório, no diretório de trabalho da sessão) roda 51
asserções no Chromium com um Supabase simulado: cadastro por convite, importação
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
