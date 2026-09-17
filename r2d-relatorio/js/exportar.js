/**
 * Exportação: PDF, imagens e impressão.
 *
 * A captura NUNCA sai da prévia que está na tela. A prévia é reduzida por
 * transform para caber no monitor (e mais ainda no celular), e o html2canvas
 * captura o que está desenhado — sairia um PDF na escala da tela. Por isso a
 * exportação monta um palco próprio, em tamanho natural, fora da vista.
 *
 * No celular, o caminho que importa é o compartilhamento: `navigator.share`
 * com arquivos abre a folha do sistema e o PDF/as imagens vão direto para o
 * WhatsApp. Baixar vários arquivos em sequência é bloqueado no Safari do iOS,
 * então isso é só a saída de último caso.
 */

import { montarRelatorio } from './relatorio.js';
import { estado } from './estado.js';
import { baixar, nomeLimpo, mostrarTrabalho, recado } from './ui.js';

let carregadas = null;

/** Carrega jsPDF e html2canvas só quando alguém exporta de fato. */
function carregarBibliotecas() {
  if (carregadas) return carregadas;
  const um = (src) => new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não carregou ' + src));
    document.head.appendChild(s);
  });
  carregadas = Promise.all([um('vendor/html2canvas.min.js'), um('vendor/jspdf.umd.min.js')]);
  return carregadas;
}

function abrirPalco() {
  const palco = document.createElement('div');
  palco.className = 'doc';
  // fora da vista, mas com layout: `display:none` zera as medidas e a
  // paginação do relatório depende de scrollHeight.
  palco.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1;background:#fff';
  document.body.appendChild(palco);
  return palco;
}

/** Desenha cada página num canvas em tamanho de impressão. */
async function capturar(aoAndar) {
  await carregarBibliotecas();
  await document.fonts.ready;

  const palco = abrirPalco();
  try {
    const paginas = await montarRelatorio(palco);
    // 2,5 num computador ≈ 230 dpi; 2 no celular, onde canvas grande estoura a memória
    const escala = Math.min(window.devicePixelRatio > 1 && navigator.maxTouchPoints > 0 ? 2 : 2.5, 3);
    const telas = [];

    for (let i = 0; i < paginas.length; i++) {
      aoAndar?.(i, paginas.length);
      // eslint-disable-next-line no-undef
      telas.push(await html2canvas(paginas[i], {
        scale: escala,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        imageTimeout: 20000,
      }));
      await respirar();   // devolve o fio ao navegador para a barra andar
    }
    aoAndar?.(paginas.length, paginas.length);
    return telas;
  } finally {
    palco.remove();
  }
}

const respirar = () => new Promise((r) => setTimeout(r, 0));

function nomeBase() {
  const p = estado.projeto;
  return `relatorio-acoes-r2d-${nomeLimpo(p.produto || 'produto')}`;
}

/* --- PDF --------------------------------------------------------------- */

export async function exportarPdf({ compartilhar = false } = {}) {
  const t = mostrarTrabalho('Gerando o PDF…', 'Montando as páginas');
  try {
    const telas = await capturar((i, n) => t.passo(`Página ${Math.min(i + 1, n)} de ${n}`, i / n));
    t.passo('Fechando o arquivo', 0.95);

    // eslint-disable-next-line no-undef
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

    telas.forEach((tela, i) => {
      if (i) pdf.addPage();
      pdf.addImage(tela.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      tela.width = tela.height = 0;   // libera a memória do canvas na hora
    });

    pdf.setProperties({
      title: `Relatório de Ações do R2D — ${estado.projeto.produto || ''}`.trim(),
      subject: 'Relatório de ações realizadas para execução do R2D',
      author: estado.projeto.representante || '',
      creator: 'Relatório de Ações do R2D',
    });

    const blob = pdf.output('blob');
    const nome = `${nomeBase()}.pdf`;
    t.fim();

    if (compartilhar && (await tentarCompartilhar([new File([blob], nome, { type: 'application/pdf' })]))) return;
    baixar(blob, nome);
    recado('PDF gerado.');
  } catch (e) {
    t.fim();
    console.error(e);
    recado('Não consegui gerar o PDF. Tente de novo.', 'erro');
  }
}

/* --- imagens ----------------------------------------------------------- */

export async function exportarImagens({ compartilhar = true } = {}) {
  const t = mostrarTrabalho('Gerando as imagens…', 'Montando as páginas');
  try {
    const telas = await capturar((i, n) => t.passo(`Página ${Math.min(i + 1, n)} de ${n}`, i / n));
    const base = nomeBase();

    const arquivos = [];
    for (let i = 0; i < telas.length; i++) {
      const blob = await new Promise((ok) => telas[i].toBlob(ok, 'image/png'));
      const nome = `${base}-${String(i + 1).padStart(2, '0')}.png`;
      arquivos.push(new File([blob], nome, { type: 'image/png' }));
      telas[i].width = telas[i].height = 0;
    }
    t.fim();

    if (compartilhar && (await tentarCompartilhar(arquivos))) return;

    // uma de cada vez: alguns navegadores descartam downloads simultâneos
    for (const arquivo of arquivos) {
      baixar(arquivo, arquivo.name);
      await new Promise((r) => setTimeout(r, 350));
    }
    recado(`${arquivos.length} ${arquivos.length === 1 ? 'imagem gerada' : 'imagens geradas'}.`);
  } catch (e) {
    t.fim();
    console.error(e);
    recado('Não consegui gerar as imagens. Tente de novo.', 'erro');
  }
}

async function tentarCompartilhar(arquivos) {
  if (!navigator.canShare?.({ files: arquivos })) return false;
  try {
    await navigator.share({ files: arquivos, title: 'Relatório de Ações do R2D' });
    return true;
  } catch (e) {
    // a pessoa cancelou a folha de compartilhamento: não é erro, e não cai
    // para o download — ela decidiu não enviar
    if (e.name === 'AbortError') return true;
    return false;
  }
}

/** PDF vetorial pela impressão do navegador — texto selecionável, arquivo menor. */
export function imprimir() {
  window.print();
}
