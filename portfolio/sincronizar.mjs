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

   NÃO é etapa de build: o site publica sem rodar nada. É uma
   ferramenta de manutenção, e o site funciona mesmo se ninguém
   rodar — só o visitante sem JavaScript veria texto velho.
   ========================================================= */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const CAMINHO_HTML = join(aqui, 'index.html');
const CAMINHO_DIC  = join(aqui, 'js', 'conteudo.js');

const soConferir = process.argv.includes('--check');

/* conteudo.js é um script clássico (declara consts no escopo global),
   não um módulo. Em vez de importar, avaliamos e pedimos o objeto. */
const fonte = readFileSync(CAMINHO_DIC, 'utf8');
const { pt } = new Function(`${fonte}; return CONTEUDO;`)();

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
function trocar(atributo, transformar) {
  const re = new RegExp(
    `(<([a-z0-9]+)\\b[^>]*\\b${escaparRegex(atributo)}="([^"]+)"[^>]*>)([\\s\\S]*?)(</\\2>)`,
    'gi'
  );
  html = html.replace(re, (todo, abre, _tag, chave, _dentro, fecha) => {
    if (!Object.prototype.hasOwnProperty.call(pt, chave)) {
      faltando.push(chave);
      return todo;
    }
    return abre + transformar(pt[chave]) + fecha;
  });
}

trocar('data-i18n',       (v) => escaparTexto(v));
trocar('data-i18n-html',  (v) => v);
trocar('data-i18n-lista', (v) =>
  '\n          ' +
  v.split('|').map((i) => `<li>${escaparTexto(i)}</li>`).join('\n          ') +
  '\n        '
);

if (faltando.length) {
  console.error('Chaves usadas no HTML e ausentes em CONTEUDO.pt:');
  for (const c of [...new Set(faltando)]) console.error('  ' + c);
  process.exit(2);
}

/* O caminho inverso: chave no dicionário que ninguém usa na página.
   Não é erro — pode ser texto de meta ou de atributo — mas vale o aviso. */
const usadas = new Set([...original.matchAll(/data-i18n(?:-html|-lista|-alt|-rotulo)?="([^"]+)"/g)].map((m) => m[1]));
const soltas = Object.keys(pt).filter((c) => !usadas.has(c) && !c.startsWith('meta.'));
if (soltas.length) console.warn('Aviso — chaves sem uso na página: ' + soltas.join(', '));

/* As duas línguas têm que ter exatamente o mesmo conjunto de chaves.
   É o que impede uma frase nova entrar só em português. */
const { en } = new Function(`${fonte}; return CONTEUDO;`)();
const soPt = Object.keys(pt).filter((c) => !(c in en));
const soEn = Object.keys(en).filter((c) => !(c in pt));
if (soPt.length || soEn.length) {
  if (soPt.length) console.error('Só existe em português: ' + soPt.join(', '));
  if (soEn.length) console.error('Só existe em inglês: '    + soEn.join(', '));
  process.exit(3);
}

if (html === original) {
  console.log('index.html já está em dia com js/conteudo.js.');
  process.exit(0);
}

if (soConferir) {
  console.error('index.html divergiu de js/conteudo.js. Rode: node sincronizar.mjs');
  process.exit(1);
}

writeFileSync(CAMINHO_HTML, html);
console.log('index.html atualizado a partir de js/conteudo.js.');
