/**
 * Testes dos módulos que não dependem do navegador: o leitor do R2D, os
 * gráficos e a formatação. O fluxo de tela é coberto pelo roteiro do
 * Playwright descrito no README.
 *
 *   npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { lerR2D } from '../js/extrator.js';
import { linhaEvolucao, barrasCategoria } from '../js/graficos.js';
import { dataCurta, dataLonga, num, pct, pctSinal, nomeLimpo, esc, periodoPorExtenso } from '../js/ui.js';

/* ---------------------------------------------------------------- */
/* Leitor do R2D                                                     */
/* ---------------------------------------------------------------- */

const R2D = `R2D — PLANO DE AÇÃO
Produto: LOGNIS
Ciclo 7 | Setembro de 2026

CONTEXTO
O Lognis vem crescendo na categoria de suplementos para função cognitiva.

OBJETIVO DO PLANO
• Ampliar a conversão e a recorrência de Lognis nos médicos de maior potencial.
• Aumentar a presença do produto no PDV das redes prioritárias.

CAUSA RAIZ
• Proposta de valor precisa estar mais conectada ao perfil do paciente.

ESTRATÉGIA
• Ações de baixo custo e planejamento de painel.
• Aumento da frequência de visitação.

AÇÕES PLANEJADAS
1. Realizar ações de PDV nas lojas Pacheco, Venâncio e Raia.
2. Executar ação conjunta com o time de Merchandising.

INDICADORES
• Market share de 32% até dezembro.`;

test('lê produto, período e seções do R2D', () => {
  const r = lerR2D(R2D);
  assert.equal(r.produto, 'LOGNIS');
  assert.equal(r.periodoRotulo, 'Ciclo 7 · Setembro de 2026');
  assert.equal(r.periodoInicio, '2026-09-01');
  assert.equal(r.periodoFim, '2026-09-30');
  assert.equal(r.objetivos.length, 2);
  assert.match(r.objetivos[0], /^Ampliar a conversão/);
  assert.equal(r.estrategias.length, 2);
  assert.equal(r.desafios.length, 1);
  assert.equal(r.acoesPlanejadas.length, 2);
  assert.equal(r.metas.length, 1);
  assert.match(r.contexto, /suplementos para função cognitiva/);
});

test('reconhece faixa de datas explícita', () => {
  const r = lerR2D('PLANO\nPeríodo: 01/09/2026 a 30/09/2026\nOBJETIVO: crescer');
  assert.equal(r.periodoInicio, '2026-09-01');
  assert.equal(r.periodoFim, '2026-09-30');
});

test('aceita título com o conteúdo na mesma linha', () => {
  const r = lerR2D('OBJETIVO: Ampliar a conversão nos médicos de alto potencial.');
  assert.equal(r.objetivos.length, 1);
  assert.match(r.objetivos[0], /Ampliar a conversão/);
});

test('junta linhas quebradas num item só quando não há marcador', () => {
  const r = lerR2D('ESTRATÉGIA\nAumentar a frequência de visitação nos médicos\nde alto potencial do painel.');
  assert.equal(r.estrategias.length, 1);
  assert.match(r.estrategias[0], /médicos de alto potencial/);
});

test('não inventa seção que o documento não tem', () => {
  const r = lerR2D('R2D\nProduto: LOGNIS\nOBJETIVO: crescer');
  assert.deepEqual(r.estrategias, []);
  assert.deepEqual(r.acoesPlanejadas, []);
  assert.deepEqual(r.desafios, []);
  assert.equal(r.contexto, '');
});

test('texto vazio devolve tudo vazio, sem estourar', () => {
  const r = lerR2D('');
  assert.equal(r.produto, '');
  assert.deepEqual(r.objetivos, []);
});

test('bordas Unicode: "ações" não casa dentro de outra palavra', () => {
  // "Reações adversas" não pode virar título da seção "ações"
  const r = lerR2D('Reações adversas relatadas no ciclo anterior foram poucas.\nOBJETIVO: crescer');
  assert.deepEqual(r.acoesPlanejadas, []);
});

/* ---------------------------------------------------------------- */
/* Gráficos                                                          */
/* ---------------------------------------------------------------- */

test('não desenha linha com menos de dois pontos', () => {
  assert.equal(linhaEvolucao([]), '');
  assert.equal(linhaEvolucao([{ rotulo: 'Ago', valor: 24.5 }]), '');
  assert.equal(linhaEvolucao([{ rotulo: 'Ago', valor: 24.5 }, { rotulo: 'Set', valor: '' }]), '');
});

test('desenha a linha e rotula só o primeiro e o último ponto', () => {
  const svg = linhaEvolucao([
    { rotulo: 'Agosto', valor: 24.5 },
    { rotulo: 'Setembro', valor: 28.2 },
    { rotulo: 'Outubro', valor: 32.5 },
  ]);
  assert.match(svg, /<svg/);
  assert.equal((svg.match(/<circle/g) || []).length, 3);
  assert.match(svg, /24,5%/);
  assert.match(svg, /32,5%/);
  assert.equal(svg.includes('>28,2%<'), false, 'o ponto do meio não leva rótulo');
});

test('índice de evolução sai com sinal', () => {
  const svg = linhaEvolucao([{ rotulo: 'Ago', valor: 8 }, { rotulo: 'Set', valor: 15 }], { sinal: true });
  assert.match(svg, /\+8,0%/);
  assert.match(svg, /\+15,0%/);
});

test('rótulo de período é escapado no SVG', () => {
  const svg = linhaEvolucao([
    { rotulo: '<script>x</script>', valor: 1 },
    { rotulo: 'Set', valor: 2 },
  ]);
  assert.equal(svg.includes('<script>'), false);
});

test('barras por categoria trazem a maior em 100%', () => {
  const html = barrasCategoria([['Ação em PDV', 4], ['Visita médica', 2]], { total: 6 });
  assert.match(html, /width:100%/);
  assert.match(html, /width:50%/);
});

/* ---------------------------------------------------------------- */
/* Formatação                                                        */
/* ---------------------------------------------------------------- */

test('data ISO vira dd/mm/aaaa sem escorregar de fuso', () => {
  // new Date('2026-09-08') é lido como UTC e, em São Paulo, cai no dia 7
  assert.equal(dataCurta('2026-09-08'), '08/09/2026');
  assert.equal(dataLonga('2026-03-01'), '1 de março de 2026');
});

test('números em português', () => {
  assert.equal(num(28.25, 1), '28,3');
  assert.equal(pct(94), '94,0%');
  assert.equal(pctSinal(18.4), '+18,4%');
  assert.equal(pctSinal(-3), '-3,0%');
  assert.equal(pct(''), '—');
  assert.equal(pct(null), '—');
});

test('período por extenso aceita só uma das pontas', () => {
  assert.equal(periodoPorExtenso('2026-09-01', '2026-09-30'), '01/09/2026 a 30/09/2026');
  assert.equal(periodoPorExtenso('2026-09-01', ''), '01/09/2026');
  assert.equal(periodoPorExtenso('', ''), '');
});

test('nome de arquivo sai sem acento nem espaço', () => {
  assert.equal(nomeLimpo('Ação em PDV — Lognis'), 'acao-em-pdv-lognis');
  assert.equal(nomeLimpo(''), 'relatorio');
});

test('escapa HTML vindo do que a pessoa digitou', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc(null), '');
});
