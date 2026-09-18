/**
 * Link compartilhável: o atleta vê a escalação e confirma o treino SEM login,
 * sem app instalado e sem servidor.
 *
 * COMO FUNCIONA, E POR QUE ASSIM: os dados vão codificados no FRAGMENTO da URL
 * (depois do `#`). Fragmento não é enviado ao servidor por nenhum navegador —
 * então os nomes dos atletas viajam do celular do técnico para o celular do
 * atleta pelo WhatsApp e nunca passam por lugar nenhum no meio. Num app que
 * lida com menores de idade isso não é detalhe: é o tratamento de dados mais
 * enxuto possível, porque não existe base de dados a vazar.
 *
 * O QUE ISSO NÃO FAZ: link é um retrato. Mudou a escalação, manda o link de
 * novo. E a confirmação do atleta volta por WhatsApp, não grava sozinha — para
 * o atleta escrever no sistema é preciso servidor, e está dito no README.
 *
 * MINIMIZAÇÃO: só vai primeiro nome + inicial do sobrenome. É o que basta para
 * alguém se achar na lista, e é menos do que uma escalação colada no grupo.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64url: o `+`, `/` e `=` do base64 comum atrapalham dentro de uma URL. */
const paraBase64Url = (bytes) => {
  let bruto = '';
  for (const b of bytes) bruto += String.fromCharCode(b);
  return btoa(bruto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const deBase64Url = (texto) => {
  const base = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base + '='.repeat((4 - (base.length % 4)) % 4));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
};

async function encolher(bytes) {
  // CompressionStream não existe no Safari antigo; sem ele o link só fica maior.
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  } catch { return null; }
}

async function crescer(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** `z` = comprimido, `j` = JSON puro. O prefixo evita adivinhação na leitura. */
export async function empacotar(objeto) {
  const cru = enc.encode(JSON.stringify(objeto));
  const comprimido = await encolher(cru);
  return comprimido && comprimido.length < cru.length
    ? `z${paraBase64Url(comprimido)}`
    : `j${paraBase64Url(cru)}`;
}

export async function desempacotar(texto) {
  const corpo = String(texto || '').trim();
  if (!corpo) throw new Error('Link vazio.');
  const bytes = deBase64Url(corpo.slice(1));
  const cru = corpo[0] === 'z' ? await crescer(bytes) : bytes;
  return JSON.parse(dec.decode(cru));
}

/** "Ana Clara Ribeiro" → "Ana Clara R." — dá para se achar sem expor o nome inteiro. */
export function nomeCurto(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  if (partes.length < 2) return partes[0] || '';
  return `${partes.slice(0, -1).join(' ')} ${partes[partes.length - 1][0]}.`;
}

/** Chaves curtas de propósito: cada byte aqui vira caractere na URL. */
export const pacoteDaEscalacao = (jogo, time, escola, atletas) => ({
  v: 1,
  t: 'jogo',
  e: escola.nome || 'Escolinha',
  z: escola.telefone || '',
  m: time?.nome || '',
  d: jogo.data,
  h: jogo.hora || '',
  c: jogo.chegada || '',
  a: jogo.adversario || '',
  l: jogo.local || '',
  n: jogo.mandante ? 1 : 0,
  k: jogo.competicao || '',
  p: (jogo.escalados || []).map((e) => {
    const atleta = atletas.find((x) => x.id === e.atletaId);
    return atleta ? [nomeCurto(atleta.nome), atleta.numero || '', e.papel, atleta.posicao || ''] : null;
  }).filter(Boolean),
});

export const pacoteDoTreino = (treino, time, escola, elenco) => ({
  v: 1,
  t: 'treino',
  e: escola.nome || 'Escolinha',
  z: escola.telefone || '',
  m: time?.nome || '',
  d: treino.data,
  h: treino.hora || '',
  l: treino.local || '',
  f: treino.foco || '',
  p: elenco.map((a) => [nomeCurto(a.nome), a.numero || '']),
});

/** A URL inteira. `base` vem de location para funcionar em qualquer domínio. */
export const enderecoDoLink = (base, carga) => `${base.replace(/\/[^/]*$/, '')}/ver.html#${carga}`;
