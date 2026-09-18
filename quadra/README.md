# Quadra — gestão de escolinha de esportes

App para o dono de uma escolinha cuidar das duas coisas que consomem o tempo
dele: **o dinheiro** (mensalidades, inadimplência, caixa) e **os times**
(escalação de jogo, chamada de treino).

Feito para a **RG Sports**, que treina **vôlei e handebol** — e o app trata as
duas modalidades com a regra de cada uma.

Abre no navegador, instala na tela de início, **funciona offline** e não pede
cadastro nem login.

---

## O que ele faz

**Dinheiro**
- Times com mensalidade própria; atleta pode ter valor diferente (bolsa, desconto de irmão).
- Geração das mensalidades do mês, **idempotente**: clicar duas vezes não cria cobrança repetida.
- Baixa de pagamento com valor, data e forma — e a **entrada entra no caixa sozinha**.
- Caixa com entradas e saídas por categoria, saldo do mês e acumulado.
- Painel com quanto entrou, quanto falta entrar e quem está devendo.

**Cobrança**
- Fila ordenada do mais atrasado para o menos.
- Mensagem pronta para o WhatsApp, com os meses em aberto e o **Pix copia e cola**
  já no valor certo — gerado aqui dentro, sem API e sem custo.
- Tom diferente antes e depois do vencimento: lembrete não é cobrança.
- **Menor de idade: a mensagem vai para o responsável**, nunca para o atleta.
- Recibo quando o pagamento entra.

**O atleta**
- **Link compartilhável, sem login e sem app instalado.** O técnico gera o link da
  escalação ou da chamada e cola no grupo do time; o atleta abre no celular e vê
  time, adversário, local, hora de chegada e quem está em quadra.
- Na chamada, o atleta acha o próprio nome e toca em **Vou** / **Não vou** — abre
  o WhatsApp com a resposta pronta para o técnico (ou copia, se a escolinha ainda
  não cadastrou o número).

**Times**
- **Modalidade por time.** Vôlei fecha com seis em quadra mais o líbero; handebol
  com seis de linha mais o goleiro. Posições, rótulos da escalação e placar
  (sets × gols) saem da modalidade.
- Escalação por toque. Avisa quando a escalação não fecha, mas não impede de salvar.
- Convocação individual pelo WhatsApp, com local, hora e horário de chegada.
- Chamada de treino separando **quem confirmou** (antes) de **quem veio** (depois).
- Frequência por atleta, contando só treino em que a chamada foi feita.

---

## Decisões, e por quê

**A modalidade mora no time, não no app.** A primeira versão tinha a regra do
vôlei cravada no código: num time de handebol ela diria "faltam 2 para fechar os
seis", o que é errado — handebol são seis de linha mais o goleiro, e as posições
são outras. Regra de esporte em constante (`MODALIDADES`), não em `if`.

**Paleta monocromática.** A marca da RG Sports é preto e branco, e isso virou
vantagem: num app de dinheiro, cor precisa significar alguma coisa. Verde é
entrada, vermelho é atraso, âmbar é a vencer — nada mais disputa atenção. Um
laranja de marca no botão brigaria com o vermelho do inadimplente.

**Dinheiro em centavos inteiros, nunca float.** Um `0,01` de diferença numa
mensalidade não aparece no teste e aparece na conversa com o cliente.

**Mensalidade paga vira entrada no caixa automaticamente**, com o id do
lançamento *derivado* do id da mensalidade (`mens_<id>`). É isso que impede o
caixa de contar a mesma receita duas vezes quando o dono toca no botão de novo —
e desfazer a baixa tira a entrada junto, para a cobrança e o caixa nunca se
contradizerem.

**WhatsApp em vez de notificação push.** Push exige que cada atleta instale o app
e autorize. Numa escolinha com adolescentes isso não acontece, e cobrança que não
chega não é cobrança. O link `wa.me` abre a conversa com o texto pronto: zero
custo, zero API, zero risco de bloqueio por disparo em massa — porque quem aperta
enviar é uma pessoa. **O preço:** é um toque por atleta, não um botão que dispara
para trinta. Automatizar exige a [API oficial do WhatsApp Business][wa], que é
paga e exige modelo de mensagem aprovado pela Meta.

**Pix estático, gerado localmente.** O payload segue o padrão EMV-QRCPS do Banco
Central ([Manual do BR Code][brcode], [Manual de Padrões para Iniciação do
Pix][pix]) — campos `IDLLVALOR` fechados por um CRC-16/CCITT-FALSE. **O que ele
não faz:** BR Code estático não avisa quando o dinheiro cai; a baixa continua
manual. Confirmação automática exigiria integração com API de banco/PSP, que é
paga.

**Os dados do atleta viajam DENTRO do link, no fragmento da URL.** Fragmento
(o que vem depois do `#`) não é enviado ao servidor por nenhum navegador: a
escalação sai do celular do técnico, passa pelo WhatsApp e chega ao celular do
atleta sem tocar em servidor nenhum. Num app que lida com menores de idade isso
é o tratamento mais enxuto possível — não existe base de dados a vazar. Só vai
primeiro nome + inicial do sobrenome, que é menos do que uma escalação colada no
grupo. **O que isso não faz:** link é um retrato (mudou a escalação, reenvia) e a
confirmação do atleta não grava sozinha — para ele escrever no sistema é preciso
servidor.

**Exportar em CSV, sempre.** O cliente controla o caixa numa planilha à mão hoje.
Trocar planilha por app só funciona se o app devolver a planilha quando ele
quiser — para o contador, para conferir, ou para ir embora. Ferramenta que prende
dado é ferramenta que ele recusa, e com razão.

**Sem CDN.** Nada carregado de fora: fonte do sistema, ícones do sistema, tudo no
cache do service worker. O cenário real é ginásio e quadra de praia, onde o 4G cai.

**Os dados vivem no navegador (IndexedDB).** É o que permite entregar hoje, sem
servidor, sem custo e sem cadastro. **A contrapartida é séria e está escrita na
própria tela:** limpar os dados do site, trocar de celular ou usar outro navegador
começa do zero. Por isso Backup e Restaurar não são enfeite.

---

## Dados pessoais — o que precisa ser resolvido antes de virar produção

A maior parte do elenco de uma escolinha é **menor de idade**, e o app guarda
nome, data de nascimento, telefone do responsável e situação financeira.

A LGPD trata disso no [art. 14][lgpd]: dados de crianças e adolescentes são
tratados **no melhor interesse** deles, e dados de criança exigem consentimento
específico e destacado de ao menos um dos pais ou responsável legal. A
[ANPD publicou enunciado][anpd] admitindo outras bases legais além do
consentimento — execução de contrato, obrigação legal, legítimo interesse — desde
que o melhor interesse prevaleça e o controlador consiga demonstrá-lo.

O que já está no desenho do app:
- **Minimização**: não pede CPF, RG, endereço nem foto. Só o necessário para
  cobrar e escalar.
- **Cobrança de menor vai para o responsável**, por regra de código, não por
  disciplina de quem usa.
- Nada sai do aparelho: não há servidor, não há terceiro, não há analytics.

O que **ainda falta**, e é do dono da escolinha, não do app:
- Termo de matrícula com a autorização do responsável para o tratamento dos dados.
- Aviso de privacidade dizendo quais dados são guardados, para quê e por quanto tempo.
- Um caminho para o responsável pedir correção ou exclusão.

---

## Rodando

```bash
npm install     # só o sharp, usado para gerar os ícones
npm test        # 63 testes: Pix, dinheiro, datas, cobrança, caixa, modalidades, link e CSV
npm run dev     # serve em http://localhost:8080
npm run gen:icons
```

O fluxo de tela é conferido com Playwright: carregar o exemplo → cobrar → dar
baixa → conferir a entrada no caixa → cadastrar atleta → escalar jogo → fazer a
chamada → trocar de tema → recarregar e ver se os dados sobreviveram.

## Estrutura

```
js/pix.js        BR Code (EMV + CRC-16), puro e testado
js/formato.js    centavos, datas locais, telefone
js/modelo.js     as regras: mensalidade, caixa, escalação, presença
js/cobranca.js   os textos que vão para o WhatsApp
js/partilha.js   empacota escalação e chamada dentro da URL
js/planilha.js   exportação em CSV (`;` e decimal com vírgula, para o Excel pt-BR)
js/ver.js        a página que o ATLETA abre (ver.html), só leitura
js/estado.js     estado + migração + backup
js/db.js         IndexedDB
js/telas/        painel, atletas, dinheiro, times, jogos, treinos, ajustes
```

## Pendências com a Beatriz

- **A logo.** O ícone é uma bola neutra na cor da marca, **provisória**. A logo da
  RG Sports é um monograma preto, e traçar isso de um print de Instagram daria um
  desenho errado com cara de certo. Precisa do arquivo oficial (SVG, ou PNG em
  alta com fundo transparente) — mesmo caminho da marca da APSEN no `r2d-relatorio`.
- **Os dados reais**: nome do responsável, WhatsApp, chave Pix e cidade do
  recebedor. Tudo em Ajustes; sem a chave, a cobrança sai sem o copia e cola.
- **Handebol foi inferido do perfil** ("Treinamentos de Vôlei e Handball").
  Se houver outra modalidade, acrescentar é um objeto em `MODALIDADES`.

## O que ficou de fora da v1, de propósito

- **A confirmação do atleta gravar sozinha no sistema.** Precisa de servidor, e a
  conta gratuita de banco usada nos outros projetos já está no limite de dois
  projetos ativos. Hoje o atleta responde pelo link e o técnico marca na chamada —
  um toque, contra o trabalho de perguntar um por um.
- **Importar a planilha atual dele.** A exportação já existe; a importação exige
  adivinhar o formato de uma planilha que eu nunca vi. Precisa do arquivo real.
- **Baixa automática do Pix.** Exige API de banco. É o primeiro item que deixa o
  projeto de ser custo zero.
- **Vários usuários / várias escolinhas.** O modelo de dados já carrega `escolaId`
  em tudo — acrescentar isso depois, num banco com dados dentro, é migração
  dolorosa; deixar o campo pronto agora custou um campo.

[brcode]: https://www.bcb.gov.br/content/config/Documents/BR_Code_MANUAL_Version_2_May_2020.pdf
[pix]: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
[wa]: https://developers.facebook.com/docs/whatsapp/pricing
[lgpd]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
[anpd]: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes
