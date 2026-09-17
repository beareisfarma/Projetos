/**
 * Gera os PNGs de ícone a partir do MESMO símbolo usado no app.
 *
 * O módulo é importado, não recortado por texto: assim o ícone e a marca da
 * tela não têm como divergir. Entra só a montanha — o logotipo "APSEN" não se
 * lê num quadrado de 32 px na aba do navegador.
 *
 *   npm run gen:icons
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

import { SIMBOLO, MARCA } from '../js/marca.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNDO = '#ffffff';

const miolo = (svg) => svg.replace(/<svg[^>]*>|<\/svg>/g, '');
const caixa = (svg) => {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return { l: Number(m[1]), a: Number(m[2]) };
};

/** O símbolo centrado num quadrado, com folga. */
function quadrado(lado, folga) {
  const { l, a } = caixa(SIMBOLO);
  const largura = lado * (1 - folga * 2);
  const altura = largura * (a / l);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" fill="${FUNDO}"/>
  <g transform="translate(${(lado - largura) / 2} ${(lado - altura) / 2}) scale(${largura / l})">
    ${miolo(SIMBOLO)}
  </g>
</svg>`;
}

await mkdir(path.join(raiz, 'icons'), { recursive: true });

for (const [nome, lado, folga] of [
  ['icone-192.png', 192, 0.13],
  ['icone-512.png', 512, 0.13],
  ['icone-180.png', 180, 0.12],
  // maskable: o sistema recorta as bordas, então a folga é maior
  ['icone-512-mascarado.png', 512, 0.24],
]) {
  await writeFile(path.join(raiz, 'icons', nome),
    await sharp(Buffer.from(quadrado(lado, folga))).png().toBuffer());
  console.log('gerado', nome, `${lado}px`);
}

// versões vetoriais avulsas, para quem precisar dos arquivos
const comNs = (svg) => svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ') + '\n';
await writeFile(path.join(raiz, 'marca', 'apsen-simbolo.svg'), comNs(SIMBOLO));
await writeFile(path.join(raiz, 'marca', 'apsen-marca.svg'), comNs(MARCA));
console.log('gerado marca/apsen-simbolo.svg e marca/apsen-marca.svg');
