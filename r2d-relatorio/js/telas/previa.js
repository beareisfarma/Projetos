/**
 * Etapa 6 — prévia e exportação.
 *
 * A prévia é o documento de verdade, página por página, reduzido por
 * transform só para caber na tela. A exportação NÃO captura daqui — monta um
 * palco em tamanho natural (ver exportar.js), senão o PDF sairia na escala da
 * janela de quem clicou.
 */

import { estado, totalDeFotos } from '../estado.js';
import { $, $$, esc } from '../ui.js';
import { montarRelatorio } from '../relatorio.js';
import { exportarPdf, exportarImagens, imprimir } from '../exportar.js';
import { irPara } from '../app.js';

const LARGURA_A4 = 210 / 25.4 * 96;   // 210 mm em px CSS a 96 dpi
const ALTURA_A4 = 297 / 25.4 * 96;

let observador = null;

export async function desenhar(raiz) {
  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Relatório de Execução do R2D</h2>
          <p class="secao__desc">Confira antes de exportar. Para mudar alguma coisa, volte à etapa correspondente.</p>
        </div>
      </div>
      <div id="pendente"></div>
      <div class="previa" id="previa">
        <div class="previa__pilha" id="pilha">
          <div style="padding:40px;color:#5c6b7a">Montando o relatório…</div>
        </div>
      </div>
      <div class="previa__barra">
        <div class="previa__barra-int">
          <div class="btn-linha">
            <button class="btn btn--fantasma" type="button" id="b-voltar">← Editar</button>
            <span class="dica" id="conta-pg"></span>
          </div>
          <div class="btn-linha">
            <button class="btn" type="button" id="b-img">Exportar imagens</button>
            <button class="btn" type="button" id="b-print">Imprimir</button>
            <button class="btn btn--principal btn--grande" type="button" id="b-pdf">Exportar PDF</button>
          </div>
        </div>
      </div>
    </div>`;

  $('#b-voltar', raiz).addEventListener('click', () => irPara('indicadores'));
  $('#b-pdf', raiz).addEventListener('click', () => exportarPdf({ compartilhar: podeCompartilhar() }));
  $('#b-img', raiz).addEventListener('click', () => exportarImagens({ compartilhar: true }));
  $('#b-print', raiz).addEventListener('click', imprimir);

  avisoDoQueFalta(raiz);
  await montarPrevia(raiz);
}

/** No celular, compartilhar é o caminho útil (vai direto ao WhatsApp).
 *  No computador, baixar é o esperado. */
function podeCompartilhar() {
  return navigator.maxTouchPoints > 0 && typeof navigator.canShare === 'function';
}

function avisoDoQueFalta(raiz) {
  const p = estado.projeto;
  const falta = [];
  if (!p.representante) falta.push('nome do representante');
  if (!p.produto) falta.push('produto');
  if (!p.periodoRotulo && !p.periodoInicio) falta.push('período');
  if (!p.acoes.length) falta.push('nenhuma ação registrada');

  const caixa = $('#pendente', raiz);
  if (!falta.length) { caixa.innerHTML = ''; return; }
  caixa.innerHTML = `<div class="aviso aviso--atencao" style="margin-bottom:16px">
    <span>⚠️</span><span>Ainda falta: <strong>${falta.map(esc).join(', ')}</strong>.
    O relatório é gerado assim mesmo, mas fica incompleto para o gestor.</span></div>`;
}

async function montarPrevia(raiz) {
  const pilha = $('#pilha', raiz);
  const palco = document.createElement('div');
  palco.className = 'doc';
  palco.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1';
  document.body.appendChild(palco);

  let paginas;
  try {
    paginas = await montarRelatorio(palco);
  } catch (e) {
    console.error(e);
    palco.remove();
    pilha.innerHTML = '<div style="padding:40px;color:#b3261e">Não consegui montar o relatório.</div>';
    return;
  }

  pilha.innerHTML = '';
  pilha.classList.add('doc');
  paginas.forEach((pg) => {
    const moldura = document.createElement('div');
    moldura.className = 'previa__pag';
    moldura.appendChild(pg);
    pilha.appendChild(moldura);
  });
  palco.remove();

  const conta = $('#conta-pg', raiz);
  if (conta) {
    conta.textContent = `${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}`
      + ` · ${estado.projeto.acoes.length} ${estado.projeto.acoes.length === 1 ? 'ação' : 'ações'}`
      + ` · ${totalDeFotos()} ${totalDeFotos() === 1 ? 'evidência' : 'evidências'}`;
  }

  ajustarEscala(raiz);
  observador?.disconnect();
  observador = new ResizeObserver(() => ajustarEscala(raiz));
  observador.observe($('#previa', raiz));
}

/** Reduz as páginas para caber na largura disponível. */
function ajustarEscala(raiz) {
  const caixa = $('#previa', raiz);
  if (!caixa) return;
  const disponivel = caixa.clientWidth - 40;
  const escala = Math.min(1, disponivel / LARGURA_A4);

  $$('.previa__pag', raiz).forEach((moldura) => {
    const pg = moldura.firstElementChild;
    if (!pg) return;
    pg.style.transform = `scale(${escala})`;
    pg.style.transformOrigin = 'top left';
    moldura.style.width = `${LARGURA_A4 * escala}px`;
    moldura.style.height = `${ALTURA_A4 * escala}px`;
    moldura.style.overflow = 'hidden';
  });
}

export function sair() {
  observador?.disconnect();
  observador = null;
}
