/**
 * Etapa 3 — indicadores do produto ao longo do plano.
 *
 * Duas coisas separadas: QUAIS indicadores acompanhar (Market Share, Índice de
 * Evolução, e o que mais ela quiser) e os VALORES de cada mês.
 *
 * **O app não calcula nem estima indicador nenhum.** Os números são digitados
 * por ela, vindos do relatório oficial da empresa. O que a ferramenta faz é
 * guardar, comparar com a referência e desenhar — nada mais. Não inventar um
 * valor num documento que vai para a gerente é regra, não preferência.
 *
 * A tabela é editável mês a mês de propósito: no começo do plano ela só tem a
 * referência, e vai preenchendo conforme os meses fecham.
 */

import { estado, mudou, periodoVazio, novoId, leituraDoIndicador, serieDoIndicador } from '../estado.js';
import { $, $$, esc, valorFmt, variacaoFmt, recado, confirmar } from '../ui.js';
import { linhaEvolucao } from '../graficos.js';
import { irPara } from '../app.js';

const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function desenhar(raiz) {
  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Indicadores do produto</h2>
          <p class="secao__desc">Registre a referência do início do plano e vá preenchendo mês a mês.</p>
        </div>
      </div>

      <div class="aviso aviso--info" style="margin-bottom:16px">
        <span>ℹ️</span>
        <span>Os valores são <strong>seus</strong>. O app não calcula, não estima e não completa
        indicador nenhum — ele guarda, compara com a referência e desenha a evolução.</span>
      </div>

      <div class="cartao">
        <div class="secao__cab" style="margin-bottom:12px">
          <div>
            <h3 class="secao__titulo" style="font-size:17px">Quais indicadores acompanhar</h3>
            <p class="secao__desc">Deixe a unidade em branco quando for número índice.</p>
          </div>
          <button class="btn btn--fantasma" type="button" id="b-add-ind">+ Indicador</button>
        </div>
        <div id="defs"></div>
      </div>

      <div class="cartao" style="margin-top:14px">
        <div class="secao__cab" style="margin-bottom:12px">
          <div>
            <h3 class="secao__titulo" style="font-size:17px">Valores mês a mês</h3>
            <p class="secao__desc">Marque qual linha é a referência do início do R2D.</p>
          </div>
          <button class="btn btn--fantasma" type="button" id="b-add-per">+ Mês</button>
        </div>
        <div style="overflow-x:auto"><table class="tabela" id="tab"><thead></thead><tbody></tbody></table></div>
        <div class="dica" style="margin-top:10px">Use vírgula ou ponto: <strong>28,2</strong> ou 28.2. Deixe vazio o que ainda não fechou.</div>
      </div>

      <div id="preview"></div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal btn--grande" type="button" id="b-seguir">Ver o relatório →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#b-add-ind', raiz).addEventListener('click', () => {
    estado.projeto.indicadores.definicoes.push({ id: novoId('ind'), nome: '', unidade: '' });
    mudou(); definicoes(raiz); tabela(raiz); previa(raiz);
    const campos = $$('input[data-nome]', raiz);
    campos[campos.length - 1]?.focus();
  });

  $('#b-add-per', raiz).addEventListener('click', () => {
    const periodos = estado.projeto.indicadores.periodos;
    periodos.push(periodoVazio(proximoRotulo(periodos), periodos.length === 0));
    mudou(); tabela(raiz); previa(raiz);
  });

  $('#b-seguir', raiz).addEventListener('click', () => irPara('relatorio'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('acoes'));

  definicoes(raiz);
  tabela(raiz);
  previa(raiz);
}

/** Sugere o mês seguinte ao último cadastrado; no primeiro, o mês corrente. */
function proximoRotulo(periodos) {
  const ultimo = periodos[periodos.length - 1]?.rotulo || '';
  const i = MES.findIndex((m) => m.toLowerCase() === ultimo.trim().toLowerCase());
  if (i >= 0) return MES[(i + 1) % 12];
  return MES[new Date().getMonth()];
}

/* --- quais indicadores ------------------------------------------------- */

function definicoes(raiz) {
  const defs = estado.projeto.indicadores.definicoes;
  const caixa = $('#defs', raiz);

  caixa.innerHTML = `<ul class="itens">${defs.map((d, i) => `
    <li class="item">
      <span class="item__txt" style="display:flex;gap:8px">
        <input type="text" value="${esc(d.nome)}" data-nome="${i}" placeholder="Nome do indicador"
               aria-label="Nome do indicador ${i + 1}" style="flex:1">
        <input type="text" value="${esc(d.unidade)}" data-uni="${i}" placeholder="unidade" maxlength="6"
               aria-label="Unidade do indicador ${i + 1}" style="width:92px;text-align:center">
      </span>
      <button class="item__x" type="button" data-x="${i}" aria-label="Remover indicador ${i + 1}">&times;</button>
    </li>`).join('')}</ul>`;

  $$('input[data-nome]', caixa).forEach((c) => c.addEventListener('input', () => {
    defs[Number(c.dataset.nome)].nome = c.value;
    mudou(); tabela(raiz, { sóCabecalho: true }); previa(raiz);
  }));
  $$('input[data-uni]', caixa).forEach((c) => c.addEventListener('input', () => {
    defs[Number(c.dataset.uni)].unidade = c.value.trim();
    mudou(); previa(raiz);
  }));

  $$('[data-x]', caixa).forEach((b) => b.addEventListener('click', async () => {
    const def = defs[Number(b.dataset.x)];
    const temValor = estado.projeto.indicadores.periodos.some((p) => p.valores[def.id] != null);
    if (temValor) {
      const ok = await confirmar({
        titulo: `Remover "${def.nome || 'indicador'}"?`,
        texto: 'Os valores já digitados para ele em todos os meses são apagados.',
        confirmar: 'Remover', perigo: true,
      });
      if (!ok) return;
    }
    defs.splice(Number(b.dataset.x), 1);
    estado.projeto.indicadores.periodos.forEach((p) => { delete p.valores[def.id]; });
    mudou(); definicoes(raiz); tabela(raiz); previa(raiz);
  }));
}

/* --- valores mês a mês -------------------------------------------------- */

function tabela(raiz, { sóCabecalho = false } = {}) {
  const { definicoes: defs, periodos } = estado.projeto.indicadores;

  $('#tab thead', raiz).innerHTML = `<tr>
    <th style="min-width:120px">Período</th>
    <th style="width:92px">Referência</th>
    ${defs.map((d) => `<th class="num" style="min-width:118px">${esc(d.nome || '—')}</th>`).join('')}
    <th style="width:40px"></th>
  </tr>`;
  if (sóCabecalho) return;

  const corpo = $('#tab tbody', raiz);
  if (!periodos.length) {
    corpo.innerHTML = `<tr><td colspan="${defs.length + 3}" style="padding:24px 0;color:#5c6b7a">
      Nenhum período ainda. Comece pela referência do início do R2D em <strong>+ Mês</strong>.</td></tr>`;
    return;
  }

  corpo.innerHTML = periodos.map((linha, i) => `
    <tr>
      <td><input type="text" data-rot="${i}" value="${esc(linha.rotulo)}" placeholder="Ex.: Agosto"
                 aria-label="Nome do período ${i + 1}"></td>
      <td style="text-align:center">
        <input type="radio" name="referencia" data-ref="${i}" ${linha.referencia ? 'checked' : ''}
               aria-label="Marcar ${esc(linha.rotulo || 'período ' + (i + 1))} como referência"
               style="width:auto;margin:0">
      </td>
      ${defs.map((d) => `<td class="num">
        <input type="text" inputmode="decimal" data-v="${i}" data-d="${esc(d.id)}"
               value="${esc(linha.valores[d.id] ?? '')}" placeholder="—" style="text-align:right"
               aria-label="${esc(d.nome)} em ${esc(linha.rotulo || 'período ' + (i + 1))}"></td>`).join('')}
      <td><button class="item__x" type="button" data-x="${i}" aria-label="Remover período ${i + 1}">&times;</button></td>
    </tr>`).join('');

  $$('input[data-rot]', corpo).forEach((c) => c.addEventListener('input', () => {
    periodos[Number(c.dataset.rot)].rotulo = c.value;
    mudou(); previa(raiz);
  }));

  $$('input[data-ref]', corpo).forEach((c) => c.addEventListener('change', () => {
    periodos.forEach((p, i) => { p.referencia = i === Number(c.dataset.ref); });
    mudou(); previa(raiz);
  }));

  $$('input[data-v]', corpo).forEach((c) => c.addEventListener('input', () => {
    const bruto = c.value.replace(/\s|%/g, '').replace(',', '.');
    const alvo = periodos[Number(c.dataset.v)].valores;
    if (bruto === '' || Number.isNaN(Number(bruto))) delete alvo[c.dataset.d];
    else alvo[c.dataset.d] = Number(bruto);
    mudou(); previa(raiz);
  }));

  $$('[data-x]', corpo).forEach((b) => b.addEventListener('click', () => {
    const era = periodos[Number(b.dataset.x)].referencia;
    periodos.splice(Number(b.dataset.x), 1);
    if (era && periodos.length) periodos[0].referencia = true;
    mudou(); tabela(raiz); previa(raiz);
    recado('Período removido.');
  }));
}

/* --- como fica no relatório -------------------------------------------- */

function previa(raiz) {
  const caixa = $('#preview', raiz);
  const defs = estado.projeto.indicadores.definicoes.filter((d) => d.nome.trim());
  const cartoes = defs.map((d) => {
    const l = leituraDoIndicador(d);
    if (!l) return '';
    const svg = linhaEvolucao(serieDoIndicador(d), { unidade: d.unidade, nome: d.nome });
    const v = variacaoFmt(l.variacao, d.unidade);
    return `<div class="numero" style="flex-basis:33.333%"><div class="numero__caixa">
      <div class="numero__rot">${esc(d.nome)}</div>
      <div class="numero__val">${esc(valorFmt(l.atual.valor, d.unidade))}</div>
      <div class="numero__pe">${esc(l.atual.rotulo)}
        ${v ? `· <span style="color:${v.cor};font-weight:600">${esc(v.texto)}</span> vs. ${esc(l.referencia.rotulo)}` : ''}</div>
      ${svg ? `<div style="margin-top:12px">${svg}</div>` : ''}
    </div></div>`;
  }).filter(Boolean).join('');

  caixa.innerHTML = cartoes ? `
    <h3 class="secao__titulo" style="font-size:17px;margin:26px 0 4px">Como vai ficar no relatório</h3>
    <p class="secao__desc" style="margin-bottom:12px">Com dois períodos ou mais, entra o gráfico de evolução.</p>
    <div class="numeros">${cartoes}</div>` : '';
}
