/**
 * Gera os PNGs de ícone a partir do MESMO símbolo usado no app (js/marca.js).
 *
 * Extrair o SVG do módulo, em vez de manter uma cópia aqui, é o que impede
 * que o ícone e a marca da tela divirjam com o tempo.
 *
 *   npm run gen:icons
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');

const NAVY = '#004080';
const FUNDO = '#ffffff';

const fonte = await readFile(path.join(raiz, 'js', 'marca.js'), 'utf8');
const simbolo = fonte.slice(fonte.indexOf('<svg viewBox="0 0 148 74"'), fonte.indexOf('</svg>') + 6)
  .replace('currentColor', NAVY);

/** Símbolo centrado num quadrado, com folga. */
function quadrado(lado, folga) {
  const largura = lado * (1 - folga * 2);
  const altura = largura * (74 / 148);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" fill="${FUNDO}"/>
  <g transform="translate(${(lado - largura) / 2} ${(lado - altura) / 2}) scale(${largura / 148})">
    ${simbolo.replace(/<svg[^>]*>|<\/svg>/g, '')}
  </g>
</svg>`;
}

await mkdir(path.join(raiz, 'icons'), { recursive: true });

const saidas = [
  ['icone-192.png', 192, 0.14],
  ['icone-512.png', 512, 0.14],
  ['icone-180.png', 180, 0.13],
  // maskable: o sistema recorta as bordas, então a folga é maior
  ['icone-512-mascarado.png', 512, 0.24],
];

for (const [nome, lado, folga] of saidas) {
  const png = await sharp(Buffer.from(quadrado(lado, folga))).png().toBuffer();
  await writeFile(path.join(raiz, 'icons', nome), png);
  console.log('gerado', nome, `${lado}px`);
}

// versão vetorial avulsa da marca, para quem precisar do arquivo
await writeFile(path.join(raiz, 'marca', 'apsen-simbolo.svg'),
  simbolo.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ') + '\n');
console.log('gerado marca/apsen-simbolo.svg');
