/** Utilidades de tela: DOM, formatação e avisos. */

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Escapa texto para interpolar em template de HTML. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Texto multilinha → HTML com quebras preservadas. */
export function escLinhas(v) {
  return esc(v).replace(/\n/g, '<br>');
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-09-08' → '08/09/2026'. Monta a data na mão: `new Date('2026-09-08')`
 *  é lido como UTC e, em São Paulo, cai no dia 7. */
export function dataCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function dataLonga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function diaDaSemana(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return nomes[new Date(a, m - 1, d).getDay()];
}

export function horaDe(isoCompleto) {
  if (!isoCompleto) return '';
  const d = new Date(isoCompleto);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function periodoPorExtenso(inicio, fim) {
  if (!inicio && !fim) return '';
  if (inicio && fim) return `${dataCurta(inicio)} a ${dataCurta(fim)}`;
  return dataCurta(inicio || fim);
}

/** Número → '28,2' (vírgula decimal, como se escreve em português). */
export function num(v, casas = 1) {
  if (v === '' || v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Valor de indicador com a unidade que a pessoa escolheu.
 * Unidade em branco é número índice — sai sem sufixo nenhum.
 */
export function valorFmt(v, unidade = '') {
  if (v === '' || v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  // índice costuma ser inteiro (108); percentual costuma ter uma casa (28,2)
  const casas = unidade === '%' ? 1 : (Number.isInteger(n) ? 0 : 1);
  return num(n, casas) + (unidade ? (unidade === '%' ? '%' : ' ' + unidade) : '');
}

/**
 * Diferença entre a posição atual e a referência.
 *
 * É comparação, não cálculo de indicador: os dois números foram digitados por
 * ela. Em percentual a diferença é em pontos percentuais; em número índice é
 * só a diferença.
 */
export function variacaoFmt(variacao, unidade = '') {
  if (variacao == null || Number.isNaN(Number(variacao))) return null;
  const n = Number(variacao);
  const quase = Math.abs(n) < 0.05;
  const casas = Number.isInteger(n) ? 0 : 1;
  const sufixo = unidade === '%' ? ' p.p.' : (unidade ? ' ' + unidade : '');
  return {
    texto: (quase ? '● ' : n > 0 ? '▲ ' : '▼ ') + num(Math.abs(n), casas) + sufixo,
    cor: quase ? '#93a0ac' : n > 0 ? '#1a7f5a' : '#b3261e',
    sentido: quase ? 'igual' : n > 0 ? 'sobe' : 'desce',
  };
}

export function tamanhoArquivo(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/* --- recados ----------------------------------------------------------- */

let caixaRecados = null;

export function recado(texto, tipo = '') {
  if (!caixaRecados) {
    caixaRecados = document.createElement('div');
    caixaRecados.className = 'recados';
    caixaRecados.setAttribute('role', 'status');
    caixaRecados.setAttribute('aria-live', 'polite');
    document.body.appendChild(caixaRecados);
  }
  const el = document.createElement('div');
  el.className = 'recado' + (tipo ? ` recado--${tipo}` : '');
  el.textContent = texto;
  caixaRecados.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/* --- modal ------------------------------------------------------------- */

/**
 * Abre um modal. Devolve { caixa, fechar } — o conteúdo é montado por quem chama.
 * Fecha no Esc e no clique fora, porque num celular o X fica longe do polegar.
 */
export function abrirModal({ titulo, corpo, pe, largura }) {
  const fundo = document.createElement('div');
  fundo.className = 'modal';
  fundo.innerHTML = `
    <div class="modal__caixa" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"
         ${largura ? `style="max-width:${largura}"` : ''}>
      <div class="modal__topo">
        <h2 style="font-size:17px">${esc(titulo)}</h2>
        <button class="modal__x" type="button" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal__corpo"></div>
      ${pe ? '<div class="modal__pe"></div>' : ''}
    </div>`;
  $('.modal__corpo', fundo).append(corpo);
  if (pe) $('.modal__pe', fundo).append(pe);

  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', noEsc);
    document.body.style.overflow = '';
  };
  const noEsc = (e) => { if (e.key === 'Escape') fechar(); };

  $('.modal__x', fundo).addEventListener('click', fechar);
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  document.addEventListener('keydown', noEsc);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(fundo);
  return { fundo, caixa: $('.modal__caixa', fundo), fechar };
}

/** Confirmação. Nunca usar window.confirm: no iOS ele some atrás do teclado. */
export function confirmar({ titulo, texto, confirmar: rotulo = 'Confirmar', perigo = false }) {
  return new Promise((resolver) => {
    const corpo = document.createElement('p');
    corpo.textContent = texto;
    const pe = document.createElement('div');
    pe.style.display = 'flex'; pe.style.gap = '10px';
    pe.innerHTML = `
      <button class="btn" type="button" data-n>Cancelar</button>
      <button class="btn ${perigo ? 'btn--perigo' : 'btn--principal'}" type="button" data-s>${esc(rotulo)}</button>`;
    const m = abrirModal({ titulo, corpo, pe, largura: '440px' });
    $('[data-n]', pe).addEventListener('click', () => { m.fechar(); resolver(false); });
    $('[data-s]', pe).addEventListener('click', () => { m.fechar(); resolver(true); });
  });
}

/* --- trabalhando ------------------------------------------------------- */

export function mostrarTrabalho(titulo, sub = '') {
  const el = document.createElement('div');
  el.className = 'trabalhando';
  el.innerHTML = `
    <div class="trabalhando__tit"></div>
    <div class="trabalhando__sub"></div>
    <div class="barra"><div class="barra__int"></div></div>`;
  $('.trabalhando__tit', el).textContent = titulo;
  $('.trabalhando__sub', el).textContent = sub;
  document.body.appendChild(el);
  return {
    passo(t, fracao) {
      if (t != null) $('.trabalhando__sub', el).textContent = t;
      if (fracao != null) $('.barra__int', el).style.width = Math.round(fracao * 100) + '%';
    },
    fim() { el.remove(); },
  };
}

/** Descarrega um Blob como arquivo. */
export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Nome de arquivo sem acento nem caractere que atrapalhe no Windows/WhatsApp. */
export function nomeLimpo(t) {
  return String(t || 'relatorio')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'relatorio';
}
