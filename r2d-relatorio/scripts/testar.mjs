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
import { linhaEvolucao } from '../js/graficos.js';
import { dataCurta, dataLonga, num, valorFmt, variacaoFmt, nomeLimpo, esc, periodoPorExtenso } from '../js/ui.js';

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

test('lê produto, período, objetivo, gap e ações previstas', () => {
  const r = lerR2D(R2D);
  assert.equal(r.produto, 'LOGNIS');
  assert.equal(r.periodoRotulo, 'Ciclo 7 · Setembro de 2026');
  assert.equal(r.periodoInicio, '2026-09-01');
  assert.equal(r.periodoFim, '2026-09-30');
  assert.match(r.objetivo, /Ampliar a conversão/);
  assert.match(r.gap, /perfil do paciente/);
  assert.equal(r.acoesPrevistas.length, 2);
  assert.match(r.acoesPrevistas[0], /^Realizar ações de PDV/);
});

test('reconhece faixa de datas explícita', () => {
  const r = lerR2D('PLANO\nPeríodo: 01/09/2026 a 30/09/2026\nOBJETIVO: crescer');
  assert.equal(r.periodoInicio, '2026-09-01');
  assert.equal(r.periodoFim, '2026-09-30');
});

test('aceita título com o conteúdo na mesma linha', () => {
  const r = lerR2D('OBJETIVO: Ampliar a conversão nos médicos de alto potencial.');
  assert.match(r.objetivo, /Ampliar a conversão/);
});

test('junta linhas quebradas numa frase só', () => {
  const r = lerR2D('GAP\nA conversão nos médicos de alto potencial\nainda está abaixo do esperado.');
  assert.match(r.gap, /médicos de alto potencial ainda está/);
});

test('a seção de indicadores é descartada, não vira ação prevista', () => {
  // os números de indicador são digitados pela pessoa; ler do PDF seria inventar
  const r = lerR2D('AÇÕES PLANEJADAS\n1. Visitar o painel.\nINDICADORES\n• Market share de 32% até dezembro.');
  assert.equal(r.acoesPrevistas.length, 1);
  assert.equal(JSON.stringify(r).includes('32%'), false);
});

test('estratégia só entra quando não há lista de ações', () => {
  const comAcoes = lerR2D('ESTRATÉGIA\n• Painel.\nAÇÕES PLANEJADAS\n1. Visitar o painel.');
  assert.equal(comAcoes.acoesPrevistas.length, 1);
  const semAcoes = lerR2D('ESTRATÉGIA\n• Ações de baixo custo.\n• Aumento da visitação.');
  assert.equal(semAcoes.acoesPrevistas.length, 2);
});

test('não inventa campo que o documento não tem', () => {
  const r = lerR2D('R2D\nProduto: LOGNIS\nOBJETIVO: crescer');
  assert.equal(r.gap, '');
  assert.deepEqual(r.acoesPrevistas, []);
});

test('texto vazio devolve tudo vazio, sem estourar', () => {
  const r = lerR2D('');
  assert.equal(r.produto, '');
  assert.equal(r.objetivo, '');
  assert.deepEqual(r.acoesPrevistas, []);
});

test('bordas Unicode: "ações" não casa dentro de outra palavra', () => {
  // "Reações adversas" não pode virar título da seção "ações"
  const r = lerR2D('Reações adversas relatadas no ciclo anterior foram poucas.\nOBJETIVO: crescer');
  assert.deepEqual(r.acoesPrevistas, []);
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
    { rotulo: 'Agosto', valor: 24.5, referencia: true },
    { rotulo: 'Setembro', valor: 28.2 },
    { rotulo: 'Outubro', valor: 32.5 },
  ], { unidade: '%' });
  assert.match(svg, /<svg/);
  assert.equal((svg.match(/<circle/g) || []).length, 4, 'três pontos mais o anel da referência');
  assert.match(svg, /24,5%/);
  assert.match(svg, /32,5%/);
  assert.equal(svg.includes('>28,2%<'), false, 'o ponto do meio não leva rótulo');
});

test('número índice sai sem símbolo de porcentagem', () => {
  const svg = linhaEvolucao([{ rotulo: 'Ago', valor: 100 }, { rotulo: 'Set', valor: 108 }], { unidade: '' });
  assert.match(svg, />100</);
  assert.match(svg, />108</);
  assert.equal(svg.includes('%'), false);
});

test('a referência ganha um anel para a gerente achar o ponto de partida', () => {
  const comRef = linhaEvolucao([{ rotulo: 'Ago', valor: 1, referencia: true }, { rotulo: 'Set', valor: 2 }]);
  const semRef = linhaEvolucao([{ rotulo: 'Ago', valor: 1 }, { rotulo: 'Set', valor: 2 }]);
  assert.match(comRef, /referência/);
  assert.equal((comRef.match(/<circle/g) || []).length, (semRef.match(/<circle/g) || []).length + 1);
});

test('rótulo de período é escapado no SVG', () => {
  const svg = linhaEvolucao([
    { rotulo: '<script>x</script>', valor: 1 },
    { rotulo: 'Set', valor: 2 },
  ]);
  assert.equal(svg.includes('<script>'), false);
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
});

test('valor sai com a unidade que a pessoa escolheu', () => {
  assert.equal(valorFmt(28.2, '%'), '28,2%');
  assert.equal(valorFmt(94, '%'), '94,0%');
  assert.equal(valorFmt(108, ''), '108');        // número índice: sem sufixo
  assert.equal(valorFmt(108.4, ''), '108,4');
  assert.equal(valorFmt(12, 'un'), '12 un');
  assert.equal(valorFmt(''), '—');
  assert.equal(valorFmt(null), '—');
});

test('variação é comparação, não cálculo de indicador', () => {
  // percentual compara em pontos percentuais; índice, só a diferença
  assert.equal(variacaoFmt(3.7, '%').texto, '▲ 3,7 p.p.');
  assert.equal(variacaoFmt(8, '').texto, '▲ 8');
  assert.equal(variacaoFmt(-2, '%').sentido, 'desce');
  assert.equal(variacaoFmt(0, '').sentido, 'igual');
  assert.equal(variacaoFmt(null), null);
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
