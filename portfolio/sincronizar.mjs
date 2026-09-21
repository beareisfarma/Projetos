/* =========================================================
   sincronizar.mjs — reescreve o texto em PORTUGUÊS dentro do
   index.html a partir de js/conteudo.js.

   Por que isto existe
   -------------------
   O site tem o português escrito direto no HTML, para funcionar
   sem JavaScript e para o buscador ler sem precisar renderizar.
   Mas a fonte da verdade do texto é o js/conteudo.js.

   Duas cópias do mesmo texto divergem — é só questão de tempo.
   Este script fecha essa brecha: rode depois de mexer no texto
   em português e o HTML volta a bater com o dicionário.

       node sincronizar.mjs          confere e reescreve
       node sincronizar.mjs --check  só confere (devolve 1 se divergiu)

   Ele também GERA o `en.html`, que é a página em inglês servida
   em /en. Esse arquivo é derivado: não edite à mão, edite o
   dicionário e rode este script.

   Por que /en é um arquivo e não uma reescrita
   --------------------------------------------
   Era `{"source": "/en", "destination": "/index.html"}` e dava 404
   no ar. Com `cleanUrls: true` a Vercel para de servir
   `/index.html` — esse caminho passa a existir só como `/` — então
   a reescrita apontava para um destino inexistente. Com um arquivo
   de verdade, o `cleanUrls` serve `en.html` em `/en` e não há
   sutileza de roteamento nenhuma para dar errado.

   De quebra, o inglês passa a sair pronto do servidor: sem lampejo
   de português, legível sem JavaScript, e indexável sem depender
   de o buscador renderizar a página.

   NÃO é etapa de build obrigatória para o site subir, mas é
   obrigatória depois de mexer em texto: sem rodar, o `en.html`
   fica velho.
   ========================================================= */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const CAMINHO_HTML = join(aqui, 'index.html');
const CAMINHO_EN   = join(aqui, 'en.html');
const CAMINHO_DIC  = join(aqui, 'js', 'conteudo.js');

const soConferir = process.argv.includes('--check');

/* conteudo.js é um script clássico (declara consts no escopo global),
   não um módulo. Em vez de importar, avaliamos e pedimos o objeto. */
const fonte = readFileSync(CAMINHO_DIC, 'utf8');
const { pt, en } = new Function(`${fonte}; return CONTEUDO;`)();
const BASE = new Function(`${fonte}; return BASE_URL;`)();

let html = readFileSync(CAMINHO_HTML, 'utf8');
const original = html;

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Texto puro precisa virar entidade ao entrar no HTML. Repare que
   aspas NÃO são escapadas: estes valores vão para dentro de um
   elemento, nunca para dentro de um atributo. */
const escaparTexto = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const faltando = [];

/* Casa <tag ...data-ATRIBUTO="chave"...>conteúdo</tag>, sem exigir que o
   atributo seja o último. O conteúdo é não-guloso até o fechamento da
   MESMA tag — o que é seguro aqui porque nenhuma chave aninha a própria
   tag (um <p> traduzido nunca contém outro <p>). */
function trocar(atributo, transformar, dic = pt, alvo = null) {
  const re = new RegExp(
    `(<([a-z0-9]+)\\b[^>]*\\b${escaparRegex(atributo)}="([^"]+)"[^>]*>)([\\s\\S]*?)(</\\2>)`,
    'gi'
  );
  const aplicar = (texto) => texto.replace(re, (todo, abre, _tag, chave, _dentro, fecha) => {
    if (!Object.prototype.hasOwnProperty.call(dic, chave)) {
      faltando.push(chave);
      return todo;
    }
    return abre + transformar(dic[chave]) + fecha;
  });
  if (alvo) return aplicar(alvo);
  html = aplicar(html);
}

/* Os quatro moldes de conteúdo, para o português e o inglês usarem os
   mesmos. Mudou um, muda nos dois. */
const MOLDES = [
  ['data-i18n',       (v) => escaparTexto(v)],
  ['data-i18n-html',  (v) => v],
  ['data-i18n-ficha', (v) =>
    '\n            ' +
    v.split('|').map((linha) => {
      const [o_que, por_que = ''] = linha.split('::');
      return `<dt>${escaparTexto(o_que)}</dt><dd>${escaparTexto(por_que)}</dd>`;
    }).join('\n            ') +
    '\n          '],
  ['data-i18n-lista', (v) =>
    '\n          ' +
    v.split('|').map((i) => `<li>${escaparTexto(i)}</li>`).join('\n          ') +
    '\n        '],
];

for (const [atributo, molde] of MOLDES) trocar(atributo, molde);

if (faltando.length) {
  console.error('Chaves usadas no HTML e ausentes em CONTEUDO.pt:');
  for (const c of [...new Set(faltando)]) console.error('  ' + c);
  process.exit(2);
}

/* O caminho inverso: chave no dicionário que ninguém usa na página.
   Não é erro — pode ser texto de meta ou de atributo — mas vale o aviso. */
const usadas = new Set([...original.matchAll(/data-i18n(?:-html|-lista|-ficha|-alt|-rotulo)?="([^"]+)"/g)].map((m) => m[1]));
const soltas = Object.keys(pt).filter((c) => !usadas.has(c) && !c.startsWith('meta.'));
if (soltas.length) console.warn('Aviso — chaves sem uso na página: ' + soltas.join(', '));

/* As duas línguas têm que ter exatamente o mesmo conjunto de chaves.
   É o que impede uma frase nova entrar só em português. */
const soPt = Object.keys(pt).filter((c) => !(c in en));
const soEn = Object.keys(en).filter((c) => !(c in pt));
if (soPt.length || soEn.length) {
  if (soPt.length) console.error('Só existe em português: ' + soPt.join(', '));
  if (soEn.length) console.error('Só existe em inglês: '    + soEn.join(', '));
  process.exit(3);
}

/* ---------------------------------------------------------------
   en.html — a página em inglês, gerada a partir da portuguesa.

   Os caminhos dos arquivos (css/, js/, img/, fonts/) continuam
   relativos e continuam certos: para a URL /en o navegador resolve
   "css/site.css" contra a pasta "/", que é onde eles estão.
   --------------------------------------------------------------- */
const escaparAtributo = (s) => escaparTexto(s).replace(/"/g, '&quot;');

function gerarIngles(fontePt) {
  let ing = fontePt;
  for (const [atributo, molde] of MOLDES) ing = trocar(atributo, molde, en, ing);

  /* A cabeça do documento não tem data-i18n: os valores moram em
     atributos, então cada um é trocado pelo seu par em inglês. */
  const trocas = [
    [/<html lang="[^"]*"/, `<html lang="en"`],
    [/(<title>)[\s\S]*?(<\/title>)/, `$1${escaparTexto(en['meta.titulo'])}$2`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${escaparAtributo(en['meta.descricao'])}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${BASE}/en$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${BASE}/en$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${escaparAtributo(en['meta.titulo'])}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${escaparAtributo(en['meta.descricao'])}$2`],
    [/(<meta property="og:locale" content=")[^"]*(")/, `$1en_US$2`],
    [/(<meta property="og:locale:alternate" content=")[^"]*(")/, `$1pt_BR$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escaparAtributo(en['meta.titulo'])}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escaparAtributo(en['meta.descricao'])}$2`],
    [/(<a href="\/"   data-idioma="pt" hreflang="pt-BR") aria-current="true"/, `$1`],
    [/(<a href="\/en" data-idioma="en" hreflang="en")/, `$1 aria-current="true"`],
  ];
  for (const [de, para] of trocas) {
    if (!de.test(ing)) { console.error('en.html: não encontrei ' + de); process.exit(4); }
    ing = ing.replace(de, para);
  }
  return ing.replace('<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- GERADO por sincronizar.mjs a partir de index.html + js/conteudo.js.\n'
    + '     Não edite à mão: edite o dicionário e rode `node sincronizar.mjs`. -->');
}

const ingles = gerarIngles(html);
const inglesAntes = existsSync(CAMINHO_EN) ? readFileSync(CAMINHO_EN, 'utf8') : null;

const mudouPt = html !== original;
const mudouEn = ingles !== inglesAntes;

if (!mudouPt && !mudouEn) {
  console.log('index.html e en.html já estão em dia com js/conteudo.js.');
  process.exit(0);
}

if (soConferir) {
  if (mudouPt) console.error('index.html divergiu de js/conteudo.js.');
  if (mudouEn) console.error('en.html divergiu de js/conteudo.js.');
  console.error('Rode: node sincronizar.mjs');
  process.exit(1);
}

if (mudouPt) { writeFileSync(CAMINHO_HTML, html);   console.log('index.html atualizado.'); }
if (mudouEn) { writeFileSync(CAMINHO_EN, ingles);   console.log('en.html gerado.'); }
