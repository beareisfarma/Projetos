// Gera os ícones do PWA sem nenhuma dependência: encoder PNG mínimo em cima do zlib
// do próprio Node. O desenho é o mesmo motivo de listras inclinadas (-18°) que a
// marca já usa no cabeçalho do Cronômetro de Jogos.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const FUNDO = [0x0a, 0x0a, 0x0a];
const NEON = [0xd7, 0xff, 0x1a];
const INCLINACAO = Math.tan((18 * Math.PI) / 180);

function crc32(buf) {
  let c, tabela = crc32.tabela;
  if (!tabela) {
    tabela = crc32.tabela = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = tabela[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(largura, altura, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;   // 8 bits por canal
  ihdr[9] = 6;   // RGBA
  // linhas com byte de filtro 0 na frente, como o formato exige
  const bruto = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    bruto[y * (1 + largura * 4)] = 0;
    rgba.copy(bruto, y * (1 + largura * 4) + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// `escala` reduz o desenho para caber na zona segura dos ícones maskable (80%).
function desenhar(tamanho, escala = 1) {
  const px = Buffer.alloc(tamanho * tamanho * 4);
  const centro = tamanho / 2;
  const alturaMax = tamanho * 0.52 * escala;
  const larguraBarra = tamanho * 0.115 * escala;
  const vao = tamanho * 0.055 * escala;
  const proporcoes = [0.55, 0.78, 1.0];
  const larguraTotal = proporcoes.length * larguraBarra + (proporcoes.length - 1) * vao;
  const base = centro + alturaMax / 2;
  const inicioX = centro - larguraTotal / 2;

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let cor = FUNDO;
      // desinclina a coordenada e testa contra cada barra reta
      const sx = x - (y - base) * INCLINACAO;
      for (let i = 0; i < proporcoes.length; i++) {
        const bx = inicioX + i * (larguraBarra + vao);
        const topo = base - alturaMax * proporcoes[i];
        if (sx >= bx && sx < bx + larguraBarra && y >= topo && y < base) { cor = NEON; break; }
      }
      const off = (y * tamanho + x) * 4;
      px[off] = cor[0]; px[off + 1] = cor[1]; px[off + 2] = cor[2]; px[off + 3] = 255;
    }
  }
  return png(tamanho, tamanho, px);
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
const saidas = [
  ['icons/icon-192.png', 192, 1],
  ['icons/icon-512.png', 512, 1],
  ['icons/icon-maskable-512.png', 512, 0.72],
  ['icons/apple-touch-icon.png', 180, 1],
];
for (const [nome, tamanho, escala] of saidas) {
  writeFileSync(new URL('../' + nome, import.meta.url), desenhar(tamanho, escala));
  console.log('gerado', nome, tamanho + 'px');
}
