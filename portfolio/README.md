# Portfólio — Beatriz C. Reis

Página de apresentação profissional, em **português e inglês**.
HTML, CSS e JavaScript escritos à mão. Sem framework, sem etapa de build,
sem nenhuma requisição a terceiros.

- Português: `https://beatrizreis.vercel.app/`
- Inglês: `https://beatrizreis.vercel.app/en`

O público desta versão é **recrutador e empresa contratando**, não cliente
de serviço. É por isso que o texto fala de decisão técnica e resultado
verificável em vez de promessa de venda, e o contato é e-mail e LinkedIn
em vez de WhatsApp em primeiro lugar.

---

## Para mudar texto

Mexa **só** em `js/conteudo.js`. As duas línguas ficam na mesma chave, uma
embaixo da outra — assim é impossível mudar uma e esquecer da outra.

Depois de mexer no texto **em português**, rode:

```bash
node sincronizar.mjs
```

### Por que esse comando existe

O português está escrito direto dentro do `index.html`, e não só no
dicionário. Isso é de propósito: é o que faz a página ser legível **sem
JavaScript** e o que o buscador lê antes de renderizar qualquer coisa.

A consequência é que o mesmo texto existe em dois lugares, e dois lugares
divergem — é questão de tempo. O `sincronizar.mjs` fecha essa brecha:
reescreve o HTML a partir do dicionário e ainda reclama se uma chave
existir em um idioma e faltar no outro.

**Não é etapa de build.** O site publica sem rodar nada. Se ninguém rodar
o comando, só o visitante sem JavaScript vê texto velho.

```bash
node sincronizar.mjs --check    # só confere; devolve erro se divergiu
```

## Para mudar contato

Primeiras linhas de `js/conteudo.js`:

```js
const CONTATO = {
  email:    'beareisfarma@gmail.com',
  linkedin: '',       // ← preencher
  github:   '',       // ← preencher, ou deixar vazio
  whatsapp: 'https://wa.me/5521997235209',
};
```

**Canal vazio some da página inteira**, em vez de virar link quebrado. Um
link que não leva a lugar nenhum num site que recrutador vai abrir custa
mais caro do que um canal a menos.

---

## Como o bilíngue funciona

**Quem manda é a URL, não o botão.**

| Endereço | Idioma | De onde vem o texto |
|---|---|---|
| `/` | português | escrito no próprio `index.html` |
| `/en` | inglês | trocado pelo `js/site.js` a partir do dicionário |

O `vercel.json` faz `/en` servir o mesmo `index.html`; o `site.js` olha o
caminho e troca o texto, o `<html lang>`, o `<title>`, a description, o
canonical e as tags de Open Graph.

O seletor **PT | EN** são dois `<a href>`, não dois botões. Três ganhos:
funciona sem JavaScript, dá ao buscador um caminho para descobrir a versão
em inglês, e a URL é sempre honesta — dá para mandar o link em inglês
para alguém.

### O que isso custa, e é honesto dizer

Em `/en` o HTML que sai do servidor está em português e o inglês é
aplicado por JavaScript. O Google renderiza JavaScript e indexa isso sem
problema, mas buscadores menores e alguns robôs de pré-visualização de
link são menos confiáveis nesse caminho.

Se um dia o tráfego orgânico em inglês passar a importar de verdade, o
próximo passo é gerar um `en/index.html` estático de verdade a partir do
mesmo `js/conteudo.js` — o dicionário já está pronto para isso, e o
`sincronizar.mjs` já sabe percorrer o HTML trocando chave por texto.

Referências: [Google — sites multilíngues](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
· [hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)

---

## Decisões que não devem ser desfeitas

**As fontes são hospedadas aqui dentro** (`fonts/`, declaradas em
`css/fontes.css`), não puxadas do `fonts.googleapis.com`. Três motivos: o
colofão do rodapé afirma que o site não tem dependência externa; é a mesma
regra "nada de CDN" usada no app do R2D; e embutir Google Fonts entrega o
IP do visitante ao Google a cada carregamento, prática já considerada
violação do GDPR pelo
[Landgericht München em janeiro de 2022](https://rewis.io/urteile/urteil/lhm-20-01-2022-3-o-1749320/)
— o que importa quando quem abre o site é recrutador na Europa.
Ambas as famílias são SIL Open Font License 1.1, que permite hospedar.

**As seções só nascem invisíveis se houver JavaScript.** O CSS da animação
de entrada está atrás de `html.js`, classe posta pelo script do `<head>`.
Sem essa trava, quem estiver sem JavaScript vê uma capa e mais nada — e,
pior, **a impressão sai em branco**, que é exatamente o que acontece quando
um recrutador salva o portfólio em PDF.

**`.obra-fig img` precisa de `height: auto`.** Os `<img>` trazem
`width`/`height` reais no atributo, que reservam o espaço e evitam o pulo
do layout. Sem `height:auto` o navegador obedece o atributo ao pé da letra
e achata a imagem.

**O limite de tamanho das capturas vai no `<figure>`, nunca em
`width:auto` na `<img>`.** Com `loading="lazy"` o navegador ainda não
conhece o tamanho natural do arquivo, e a imagem colapsa para 2×2 pixels
antes de carregar. Já aconteceu.

**A paleta foi medida, não estimada.** As razões de contraste estão
anotadas no topo do `css/site.css`, par a par, nos dois temas. Mudou cor,
mede de novo — e nos **dois** temas, não só no claro.

**O neon `#d7ff1a` aparece uma vez só**: no losango da logo pessoal BCR no
rodapé. Aquilo é marca, não tema do site.

**O botão do hero leva para a seção de contato, não para um `mailto:`.**
Em máquina sem cliente de e-mail configurado o `mailto:` não faz nada, e
o visitante acha que o site quebrou.

**Os botões de tema têm largura fixa** (34px), não padding. Com padding o
glifo decide a largura e o bloco de controles pula ao trocar de tema.

---

## Conferir antes de publicar

Não há teste automatizado. O que existe é conferir no navegador de
verdade, nos dois idiomas e nos dois temas:

- `/` e `/en` abrem, com `<html lang>`, `<title>` e canonical certos
- o seletor PT|EN navega e muda o endereço
- o tema claro e o escuro, e o botão que alterna
- celular (390px de largura) sem rolagem horizontal
- **com o JavaScript desligado**, o conteúdo continua visível
- imprimir em PDF e ver se sai o site, não páginas em branco

---

## Publicar

Projeto Vercel estático, deploy automático da branch `main`.
Não há backend, variável de ambiente nem banco.
