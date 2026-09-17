/** Peças de tela reaproveitadas entre as etapas. */

import { esc, $, $$ } from './ui.js';

/**
 * Lista editável em linha (objetivos, entregas, próximos passos…).
 * Escreve direto no array recebido e avisa quem chamou.
 *
 * O input é editado no lugar, sem botão "salvar": a pessoa está montando um
 * rascunho de relatório, não preenchendo um formulário de cadastro.
 *
 * @param {object} cfg
 * @param {HTMLElement} cfg.raiz
 * @param {Array} cfg.itens          array de strings OU de {id, sigla, texto}
 * @param {boolean} [cfg.comSigla]   true quando os itens são do plano do R2D
 * @param {string} [cfg.placeholder]
 * @param {string} [cfg.rotuloNovo]
 * @param {() => void} cfg.aoMudar
 * @param {() => object|string} [cfg.criar]
 */
export function listaEditavel({ raiz, itens, comSigla = false, placeholder = '', rotuloNovo = 'Adicionar item', aoMudar, criar }) {
  const texto = (i) => (comSigla ? i.texto : i);

  function desenhar() {
    raiz.innerHTML = `
      <ul class="itens">
        ${itens.map((item, i) => `
          <li class="item">
            ${comSigla ? `<span class="item__sig">${esc(item.sigla)}</span>` : ''}
            <span class="item__txt">
              <input type="text" value="${esc(texto(item))}" data-i="${i}"
                     placeholder="${esc(placeholder)}" aria-label="Item ${i + 1}">
            </span>
            <button class="item__x" type="button" data-x="${i}" aria-label="Remover item ${i + 1}">&times;</button>
          </li>`).join('')}
      </ul>
      <button class="btn btn--fantasma" type="button" data-novo style="margin-top:6px">+ ${esc(rotuloNovo)}</button>`;

    $$('input[data-i]', raiz).forEach((campo) => {
      campo.addEventListener('input', () => {
        const i = Number(campo.dataset.i);
        if (comSigla) itens[i].texto = campo.value;
        else itens[i] = campo.value;
        aoMudar();
      });
    });

    $$('[data-x]', raiz).forEach((btn) => {
      btn.addEventListener('click', () => {
        itens.splice(Number(btn.dataset.x), 1);
        aoMudar();
        desenhar();
      });
    });

    $('[data-novo]', raiz).addEventListener('click', () => {
      itens.push(criar ? criar() : '');
      aoMudar();
      desenhar();
      const campos = $$('input[data-i]', raiz);
      campos[campos.length - 1]?.focus();
    });
  }

  desenhar();
  return { redesenhar: desenhar };
}
