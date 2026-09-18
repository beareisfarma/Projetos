/**
 * Gera os PNGs do ícone a partir de `logo-quadra.svg`.
 * Os arquivos ficam commitados porque a tela de início do iPhone precisa deles
 * e o app tem que instalar sem passo de build.
 *
 *   npm run gen:icons
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const raiz = new URL('../', import.meta.url).pathname;
const svg = readFileSync(raiz + 'logo-quadra.svg');
mkdirSync(raiz + 'icons', { recursive: true });

/** O ícone sobre ladrilho claro: no iOS não existe transparência na tela de início. */
async function gerar(nome, tamanho, { margem = 0.12, fundo = '#ffffff' } = {}) {
  const bola = Math.round(tamanho * (1 - margem * 2));
  const bufferBola = await sharp(svg, { density: 384 }).resize(bola, bola).png().toBuffer();

  await sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: fundo } })
    .composite([{ input: bufferBola, top: Math.round((tamanho - bola) / 2), left: Math.round((tamanho - bola) / 2) }])
    .png()
    .toFile(raiz + 'icons/' + nome);
  console.log('  ' + nome, tamanho + 'px');
}

console.log('ícones do Quadra:');
await gerar('icone-192.png', 192);
await gerar('icone-512.png', 512);
await gerar('icone-180.png', 180);
// Maskable: o Android recorta em círculo, então a bola precisa de folga maior.
await gerar('icone-512-maskable.png', 512, { margem: 0.2 });
