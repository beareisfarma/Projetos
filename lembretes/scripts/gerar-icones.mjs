// Gera os ícones do PWA a partir de logo-assistente.svg.
// O SVG é a fonte da verdade: para mudar o desenho, edite lá e rode
//   npm run gen:icons
// Os PNGs ficam commitados porque a tela de início do iPhone precisa deles.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raiz = new URL('../', import.meta.url).pathname;
const FUNDO = '#16233f';   // mesmo azul-marinho do texto do app
const NEON  = '#d7ff1a';

const svg = readFileSync(raiz + 'logo-assistente.svg', 'utf8');

/** O SVG usa currentColor; aqui a cor é fixada e o desenho é centralizado. */
function desenho(tamanho, ocupacao) {
  const lado = Math.round(tamanho * ocupacao);
  // replaceAll, não replace: um desenho com traço E preenchimento tem
  // currentColor em vários lugares, e só o primeiro sairia colorido — o resto
  // viria preto sobre o fundo azul, ou seja, invisível.
  return Buffer.from(svg.replaceAll('currentColor', NEON)
    .replace('width="100" height="100"', `width="${lado}" height="${lado}"`));
}

async function gerar(nome, tamanho, ocupacao, raioCanto) {
  const lado = Math.round(tamanho * ocupacao);
  const margem = Math.round((tamanho - lado) / 2);

  // Fundo: quadrado com cantos arredondados (ou cheio, no maskable, que o
  // próprio sistema recorta).
  const fundo = raioCanto > 0
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">
         <rect width="${tamanho}" height="${tamanho}" rx="${raioCanto}" fill="${FUNDO}"/></svg>`)
    : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">
         <rect width="${tamanho}" height="${tamanho}" fill="${FUNDO}"/></svg>`);

  const png = await sharp(fundo)
    .composite([{ input: await sharp(desenho(tamanho, ocupacao)).png().toBuffer(),
                  top: margem, left: margem }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(raiz + nome, png);
  console.log('gerado', nome, tamanho + 'px');
}

mkdirSync(raiz + 'icons', { recursive: true });
// maskable ocupa menos e tem fundo cheio: o sistema recorta um círculo por cima.
await gerar('icons/icon-192.png',           192, 0.70, 0);
await gerar('icons/icon-512.png',           512, 0.70, 0);
await gerar('icons/icon-maskable-512.png',  512, 0.52, 0);
await gerar('icons/apple-touch-icon.png',   180, 0.70, 0);
