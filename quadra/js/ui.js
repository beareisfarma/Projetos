/** Ajudantes de tela: escape, criação de nós, recado curto e a folha de edição. */

export const esc = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Monta um nó a partir de HTML. Usado para as listas, que são redesenhadas inteiras. */
export function no(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const iniciais = (nome) => String(nome || '?')
  .trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';

let recadoTempo = null;
export function recado(texto) {
  const caixa = $('#recado');
  caixa.textContent = texto;
  caixa.hidden = false;
  clearTimeout(recadoTempo);
  recadoTempo = setTimeout(() => { caixa.hidden = true; }, 2600);
}

// ── Folha de edição ─────────────────────────────────────────────────────────
// Uma só no documento inteiro, reaproveitada. Cada tela entrega o HTML do miolo
// e recebe o elemento para ligar os eventos.

let aoFechar = null;

export function abrirFolha(titulo, corpoHtml, { subtitulo = '' } = {}) {
  const folha = $('#folha');
  folha.querySelector('#folha-titulo').textContent = titulo;
  const sub = folha.querySelector('#folha-sub');
  sub.textContent = subtitulo;
  sub.hidden = !subtitulo;
  const miolo = folha.querySelector('#folha-corpo');
  miolo.innerHTML = corpoHtml;
  folha.hidden = false;
  document.body.style.overflow = 'hidden';
  // Foco no primeiro campo, mas nunca no celular: abrir o teclado por cima da
  // folha esconde justamente o que a pessoa acabou de mandar aparecer.
  if (window.matchMedia('(min-width: 640px)').matches) {
    miolo.querySelector('input, select, textarea')?.focus();
  }
  return miolo;
}

export function fecharFolha() {
  const folha = $('#folha');
  if (folha.hidden) return;
  folha.hidden = true;
  document.body.style.overflow = '';
  const callback = aoFechar; aoFechar = null;
  callback?.();
}

export const aoFecharFolha = (callback) => { aoFechar = callback; };

export function ligarFolha() {
  const folha = $('#folha');
  folha.addEventListener('click', (e) => { if (e.target === folha) fecharFolha(); });
  $('#folha-fechar').addEventListener('click', fecharFolha);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolha(); });
}

/** Confirmação destrutiva. `confirm` nativo basta e não some atrás do teclado. */
export const confirmar = (pergunta) => window.confirm(pergunta);

/** Opções de um <select>, já com a marcada. */
export const opcoes = (itens, selecionado) => itens
  .map((i) => {
    const [valor, rotulo] = Array.isArray(i) ? i : [i, i];
    return `<option value="${esc(valor)}"${String(valor) === String(selecionado) ? ' selected' : ''}>${esc(rotulo)}</option>`;
  }).join('');

/** Baixa um arquivo gerado na hora (backup, exportação). */
export function baixar(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copia para a área de transferência.
 * O `navigator.clipboard` exige contexto seguro e gesto do usuário; quando não
 * dá, cai no campo temporário, que funciona no Safari antigo.
 */
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.style.cssText = 'position:fixed;top:-1000px';
    document.body.appendChild(campo);
    campo.select();
    const deu = document.execCommand?.('copy');
    campo.remove();
    return Boolean(deu);
  }
}
