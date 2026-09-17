/**
 * Etapa 4 — indicadores do produto por período.
 *
 * Três indicadores, vários períodos. O gráfico ao lado é o mesmo que vai para
 * o relatório, desenhado com os números que estão na tabela — assim não existe
 * "na tela era um, no PDF era outro".
 */

import { estado, mudou, INDICADORES, novoId, ultimoIndicador, penultimoIndicador } from '../estado.js';
import { $, $$, esc, num, pct, pctSinal, recado } from '../ui.js';
import { linhaEvolucao } from '../graficos.js';
import { irPara } from '../app.js';

export function desenhar(raiz) {
  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Indicadores do produto</h2>
          <p class="secao__desc">Um período por linha. Com dois ou mais, o relatório desenha a evolução.</p>
        </div>
        <button class="btn btn--principal" type="button" id="b-add">+ Adicionar período</button>
      </div>

      <div class="cartao">
        <div style="overflow-x:auto">
          <table class="tabela" id="tab">
            <thead>
              <tr>
                <th style="min-width:130px">Período</th>
                ${INDICADORES.map((d) => `<th class="num" style="min-width:130px">${esc(d.nome)}</th>`).join('')}
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="dica" style="margin-top:10px">
          Percentuais em número: <strong>28,2</strong> (ou 28.2). O índice de evolução aceita negativo.
        </div>
      </div>

      <div id="preview"></div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal" type="button" id="b-seguir">Continuar para o fechamento →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#b-add', raiz).addEventListener('click', () => {
    estado.projeto.indicadores.push(novoPeriodo());
    mudou();
    corpoDaTabela(raiz);
    previa(raiz);
    const campos = $$('input[data-rot]', raiz);
    campos[campos.length - 1]?.focus();
  });
  $('#b-seguir', raiz).addEventListener('click', () => irPara('fechamento'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('acoes'));

  corpoDaTabela(raiz);
  previa(raiz);
}

function novoPeriodo() {
  const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const usados = estado.projeto.indicadores.length;
  const base = new Date();
  base.setMonth(base.getMonth() - (2 - Math.min(usados, 2)));
  return { id: novoId('ind'), rotulo: MES[base.getMonth()], marketShare: '', evolucao: '', cota: '' };
}

function corpoDaTabela(raiz) {
  const corpo = $('#tab tbody', raiz);
  const linhas = estado.projeto.indicadores;

  if (!linhas.length) {
    corpo.innerHTML = `<tr><td colspan="${INDICADORES.length + 2}" style="padding:24px 0;color:#5c6b7a">
      Nenhum período ainda. Use <strong>+ Adicionar período</strong> — pode ser um só.</td></tr>`;
    return;
  }

  corpo.innerHTML = linhas.map((l, i) => `
    <tr>
      <td><input type="text" data-rot="${i}" value="${esc(l.rotulo)}" placeholder="Ex.: Setembro" aria-label="Nome do período ${i + 1}"></td>
      ${INDICADORES.map((d) => `<td class="num">
        <input type="text" inputmode="decimal" data-v="${i}" data-c="${d.chave}"
               value="${esc(l[d.chave] ?? '')}" placeholder="—" style="text-align:right"
               aria-label="${esc(d.nome)} em ${esc(l.rotulo || 'período ' + (i + 1))}"></td>`).join('')}
      <td><button class="item__x" type="button" data-x="${i}" aria-label="Remover período ${i + 1}">&times;</button></td>
    </tr>`).join('');

  $$('input[data-rot]', corpo).forEach((c) => c.addEventListener('input', () => {
    linhas[Number(c.dataset.rot)].rotulo = c.value;
    mudou(); previa(raiz);
  }));

  $$('input[data-v]', corpo).forEach((c) => c.addEventListener('input', () => {
    const bruto = c.value.replace(/\s|%/g, '').replace(',', '.');
    linhas[Number(c.dataset.v)][c.dataset.c] = bruto === '' ? '' : (Number.isNaN(Number(bruto)) ? '' : Number(bruto));
    mudou(); previa(raiz);
  }));

  $$('[data-x]', corpo).forEach((b) => b.addEventListener('click', () => {
    linhas.splice(Number(b.dataset.x), 1);
    mudou(); corpoDaTabela(raiz); previa(raiz);
    recado('Período removido.');
  }));
}

function previa(raiz) {
  const caixa = $('#preview', raiz);
  const ultimo = ultimoIndicador();
  const anterior = penultimoIndicador();
  if (!ultimo) { caixa.innerHTML = ''; return; }

  const cartoes = INDICADORES.map((d) => {
    const v = ultimo[d.chave];
    const a = anterior?.[d.chave];
    const temDelta = v !== '' && v != null && a !== '' && a != null;
    const delta = temDelta ? Number(v) - Number(a) : null;
    const cor = delta == null ? '#8c98a4' : delta > 0.05 ? '#1a7f5a' : delta < -0.05 ? '#b3261e' : '#8c98a4';
    const seta = delta == null ? '' : delta > 0.05 ? '▲ ' : delta < -0.05 ? '▼ ' : '● ';

    const svg = linhaEvolucao(
      estado.projeto.indicadores.map((i) => ({ rotulo: i.rotulo, valor: i[d.chave] })),
      { sinal: d.sinal, nome: d.nome },
    );

    return `<div class="numero" style="flex-basis:33.333%"><div class="numero__caixa">
      <div class="numero__rot">${esc(d.nome)}</div>
      <div class="numero__val">${d.sinal ? pctSinal(v) : pct(v)}</div>
      <div class="numero__pe" style="color:${cor};font-weight:600">
        ${temDelta ? `${seta}${num(Math.abs(delta), 1)} p.p. vs. ${esc(anterior.rotulo)}` : 'sem período anterior'}</div>
      ${svg ? `<div style="margin-top:12px">${svg}</div>` : ''}
    </div></div>`;
  }).join('');

  caixa.innerHTML = `
    <h3 class="secao__titulo" style="font-size:17px;margin:26px 0 4px">Como vai ficar no relatório</h3>
    <p class="secao__desc" style="margin-bottom:12px">Posição em <strong>${esc(ultimo.rotulo || 'último período')}</strong>.</p>
    <div class="numeros">${cartoes}</div>`;
}
