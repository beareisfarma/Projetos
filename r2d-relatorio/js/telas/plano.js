/**
 * Etapa 2 — o plano lido do R2D.
 *
 * Tudo aqui é editável, e isso não contradiz "o R2D não é alterado": o que
 * se edita é a LEITURA do plano guardada neste app, para servir de referência
 * às ações. O PDF original segue intacto e é citado como fonte no relatório.
 *
 * Cada item ganha uma sigla (OBJ1, EST2…) porque é por ela que as ações se
 * amarram ao plano — é o que faz o relatório mostrar planejado → executado.
 */

import { estado, mudou, itemDePlano, renumerar } from '../estado.js';
import { $, esc } from '../ui.js';
import { listaEditavel } from '../componentes.js';
import { irPara } from '../app.js';

const LISTAS = [
  { chave: 'objetivos', titulo: 'Objetivos do R2D', desc: 'O que o plano queria alcançar.', ph: 'Ex.: Ampliar a conversão nos médicos de maior potencial' },
  { chave: 'estrategias', titulo: 'Estratégias', desc: 'Como o plano previa chegar lá.', ph: 'Ex.: Ações de baixo custo e abordagem promocional direcionada' },
  { chave: 'desafios', titulo: 'Desafios e causa raiz', desc: 'O que o plano apontou como barreira.', ph: 'Ex.: Percepção de valor frente à barreira de custo' },
  { chave: 'acoesPlanejadas', titulo: 'Ações planejadas', desc: 'O que o R2D previa executar.', ph: 'Ex.: Visitas a médicos de alto potencial' },
  { chave: 'metas', titulo: 'Indicadores e metas do plano', desc: 'Opcional. Aparece como referência.', ph: 'Ex.: Market share de 32% até dezembro' },
];

export function desenhar(raiz) {
  const p = estado.projeto;

  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">O que o R2D previa</h2>
          <p class="secao__desc">Confira e ajuste a leitura do plano. É essa lista que as suas ações vão referenciar.</p>
        </div>
      </div>

      <div class="aviso aviso--info" style="margin-bottom:18px">
        <span>ℹ️</span>
        <span>Editar aqui <strong>não muda o R2D</strong>. O PDF original continua como foi emitido
        e é citado como fonte no relatório — isto é só a leitura que o app guarda para referência.</span>
      </div>

      <div class="cartao">
        <label class="rotulo" for="f-ctx">Contexto do plano</label>
        <textarea id="f-ctx" rows="3"
          placeholder="Uma ou duas frases sobre o cenário do produto no período.">${esc(p.plano.contexto)}</textarea>
        <div class="dica">Abre a página de contexto do relatório. Se ficar em branco, entra o primeiro objetivo.</div>
      </div>

      <div id="listas"></div>

      <div class="cartao" style="margin-top:14px">
        <div class="campos">
          <div class="campo campo--meio">
            <label for="f-total">Total de ações previstas no R2D</label>
            <input id="f-total" type="number" min="0" step="1" value="${p.plano.totalPlanejadas ?? ''}"
                   placeholder="Ex.: 30">
            <div class="dica">É o denominador do percentual de execução. Em branco, o relatório mostra só
              o número de ações realizadas, sem inventar percentual.</div>
          </div>
        </div>
      </div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal btn--grande" type="button" id="b-seguir">Continuar para as ações →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#f-ctx', raiz).addEventListener('input', (e) => { p.plano.contexto = e.target.value; mudou(); });
  $('#f-total', raiz).addEventListener('input', (e) => {
    const v = e.target.value.trim();
    p.plano.totalPlanejadas = v === '' ? null : Math.max(0, Number(v));
    mudou();
  });

  const caixa = $('#listas', raiz);
  LISTAS.forEach(({ chave, titulo, desc, ph }) => {
    const cartao = document.createElement('div');
    cartao.className = 'cartao';
    cartao.style.marginTop = '14px';
    cartao.innerHTML = `
      <h3 class="secao__titulo" style="font-size:17px;margin-bottom:2px">${esc(titulo)}</h3>
      <p class="secao__desc" style="margin-bottom:12px">${esc(desc)}</p>
      <div data-lista></div>`;
    caixa.appendChild(cartao);

    listaEditavel({
      raiz: $('[data-lista]', cartao),
      itens: p.plano[chave],
      comSigla: true,
      placeholder: ph,
      rotuloNovo: 'Adicionar',
      criar: () => itemDePlano(chave, ''),
      aoMudar: () => { renumerar(chave); mudou(); },
    });
  });

  $('#b-seguir', raiz).addEventListener('click', () => irPara('acoes'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('inicio'));
}
