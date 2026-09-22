// Gera os PNGs do ícone a partir de icone.svg.
// Rodar com: node gerar-icones.mjs  (precisa de sharp instalado)
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("./icone.svg", import.meta.url));
const tamanhos = [180, 192, 512];

for (const tamanho of tamanhos) {
  const png = await sharp(svg).resize(tamanho, tamanho).png().toBuffer();
  await writeFile(new URL(`./icone-${tamanho}.png`, import.meta.url), png);
  console.log(`icone-${tamanho}.png`);
}

// Favicon pequeno: o mesmo desenho, sem perder o traço da cruz.
const favicon = await sharp(svg).resize(64, 64).png().toBuffer();
await writeFile(new URL("./favicon.png", import.meta.url), favicon);
console.log("favicon.png");
