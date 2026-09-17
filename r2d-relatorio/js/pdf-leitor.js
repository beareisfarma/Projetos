/**
 * Leitura do R2D em PDF.
 *
 * Só LÊ. O arquivo enviado não é alterado, nem reescrito, nem guardado por
 * cima: o que fica no app é o texto extraído, usado como contexto.
 *
 * O pdf.js entrega os pedaços de texto soltos, com coordenadas. Juntar por
 * linha (agrupando pelo y e ordenando pelo x) é o que faz um tópico de lista
 * sair como uma frase em vez de virar palavras avulsas — e o extrator depende
 * disso para reconhecer as seções.
 */

import * as pdfjs from '../vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

/**
 * @param {File|Blob} arquivo
 * @param {(feito:number, total:number)=>void} [aoAndar]
 * @returns {Promise<{texto:string, paginas:number}>}
 */
export async function lerPdf(arquivo, aoAndar) {
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise;

  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    paginas.push(juntarLinhas(conteudo.items));
    aoAndar?.(n, doc.numPages);
  }
  const total = doc.numPages;
  await doc.destroy();

  return { texto: paginas.join('\n\n'), paginas: total };
}

/** Pedaços soltos do pdf.js → texto com uma frase por linha. */
function juntarLinhas(itens) {
  const linhas = new Map();

  for (const item of itens) {
    const texto = item.str;
    if (!texto || !texto.trim()) continue;
    const x = item.transform[4];
    const y = Math.round(item.transform[5] / 2) * 2;  // tolera meio ponto de diferença
    if (!linhas.has(y)) linhas.set(y, []);
    linhas.get(y).push({ x, texto });
  }

  return [...linhas.entries()]
    .sort((a, b) => b[0] - a[0])                       // do topo para o pé
    .map(([, pedacos]) => pedacos
      .sort((a, b) => a.x - b.x)
      .map((p) => p.texto)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}
