import test from 'node:test';
import assert from 'node:assert/strict';
import { deLocalParaUTC, textoLocal, offsetMinutos, naMesmaDataLocal } from '../api/_lib/tempo.js';
import { montarAvisos, comoFalta, faixa, normalizarAntecedencias, avisoDeAtraso,
  ANTECEDENCIAS, ANTECEDENCIAS_PADRAO } from '../api/_lib/agenda.js';

const AGORA = Date.parse('2026-09-15T12:00:00-03:00');

test('tempo: converte relógio de parede de São Paulo para UTC', () => {
  assert.equal(deLocalParaUTC('2026-09-19T14:00').toISOString(), '2026-09-19T17:00:00.000Z');
  assert.equal(offsetMinutos(new Date(AGORA)), -180);
});

test('tempo: meia-noite local não escorrega de dia', () => {
  // O ICU devolve "24" para 00h em hour12:false; sem normalizar, o dia pula.
  assert.equal(deLocalParaUTC('2026-09-19T00:00').toISOString(), '2026-09-19T03:00:00.000Z');
  assert.equal(textoLocal(new Date('2026-09-19T03:00:00.000Z')), '2026-09-19T00:00');
});

test('tempo: ida e volta preserva o horário', () => {
  for (const alvo of ['2026-01-01T00:00', '2026-06-30T23:59', '2026-12-25T18:30']) {
    assert.equal(textoLocal(deLocalParaUTC(alvo)), alvo);
  }
  assert.equal(naMesmaDataLocal(deLocalParaUTC('2026-09-19T14:00'), 8).toISOString(), '2026-09-19T11:00:00.000Z');
});

test('agenda: o padrão é 1 dia + 1 hora + o momento exato', () => {
  const avisos = montarAvisos(Date.parse('2026-09-25T14:00:00-03:00'), AGORA);
  assert.deepEqual(avisos.map((a) => a.chave), [...ANTECEDENCIAS_PADRAO, 'prazo']);
});

test('agenda: respeita as antecedências escolhidas, em ordem', () => {
  const prazo = Date.parse('2026-09-25T14:00:00-03:00');
  const avisos = montarAvisos(prazo, AGORA, ['m5', 'd2', 'h1']);
  assert.deepEqual(avisos.map((a) => a.chave), ['d2', 'h1', 'm5', 'prazo']);
  for (let i = 1; i < avisos.length; i++) {
    assert.ok(Date.parse(avisos[i].em) > Date.parse(avisos[i - 1].em), 'avisos fora de ordem');
  }
  // cada aviso cai exatamente na antecedência pedida
  for (const a of avisos.filter((x) => x.chave !== 'prazo')) {
    const minutos = ANTECEDENCIAS.find((x) => x.chave === a.chave).minutos;
    assert.equal(Date.parse(a.em), prazo - minutos * 60000, `antecedência errada: ${a.chave}`);
  }
});

test('agenda: o aviso do momento exato existe mesmo sem antecedência nenhuma', () => {
  const avisos = montarAvisos(Date.parse('2026-09-25T14:00:00-03:00'), AGORA, []);
  assert.deepEqual(avisos.map((a) => a.chave), ['prazo']);
});

test('agenda: chave desconhecida e repetida são descartadas', () => {
  assert.deepEqual(normalizarAntecedencias(['m5', 'inexistente', 'd1', 'm5']), ['d1', 'm5']);
  assert.deepEqual(normalizarAntecedencias(undefined), ANTECEDENCIAS_PADRAO);
  assert.deepEqual(normalizarAntecedencias('nada disso'), ANTECEDENCIAS_PADRAO);
});

test('agenda: nenhum aviso cai no passado nem depois do prazo', () => {
  const prazo = Date.parse('2026-09-17T18:00:00-03:00');
  for (const a of montarAvisos(prazo, AGORA, ['d2', 'd1', 'h1', 'm15', 'm5'])) {
    assert.ok(Date.parse(a.em) > AGORA, `aviso no passado: ${a.chave}`);
    assert.ok(Date.parse(a.em) <= prazo, `aviso depois do prazo: ${a.chave}`);
  }
});

test('agenda: prazo em cima da hora ainda avisa uma vez', () => {
  const avisos = montarAvisos(AGORA + 10 * 60000, AGORA);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].chave, 'prazo');
});

test('agenda: prazo já vencido avisa imediatamente, nunca fica mudo', () => {
  const avisos = montarAvisos(Date.parse('2026-09-14T18:00:00-03:00'), AGORA);
  assert.equal(avisos.length, 1);
  assert.ok(Date.parse(avisos[0].em) > AGORA, 'lembrete vencido nasceu sem aviso futuro');
});

test('agenda: faixas e texto relativo em pt-BR', () => {
  assert.equal(faixa(Date.parse('2026-09-14T18:00:00-03:00'), AGORA), 'atrasado');
  assert.equal(faixa(Date.parse('2026-09-15T23:00:00-03:00'), AGORA), 'hoje');
  assert.equal(faixa(Date.parse('2026-09-16T10:00:00-03:00'), AGORA), 'amanha');
  assert.equal(faixa(Date.parse('2026-09-20T10:00:00-03:00'), AGORA), 'semana');
  assert.equal(faixa(Date.parse('2026-10-20T10:00:00-03:00'), AGORA), 'depois');

  assert.equal(comoFalta(AGORA + 2 * 86400000, AGORA), 'em 2 dias');
  assert.equal(comoFalta(AGORA + 3600000, AGORA), 'em 1 hora');
  assert.equal(comoFalta(AGORA - 3 * 3600000, AGORA), 'atrasado há 3 horas');
});

test('agenda: aviso de atraso repete a cada dia e conta os dias certos', () => {
  const prazo = Date.parse('2026-09-14T17:00:00.000Z');
  const DIA = 24 * 3600000;

  // Antes do prazo não existe atraso nenhum.
  assert.equal(avisoDeAtraso(prazo, prazo - 1), null);

  // Na hora exata do prazo já aponta para o dia seguinte.
  const d1 = avisoDeAtraso(prazo, prazo);
  assert.equal(d1.chave, 'atraso-d1');
  assert.equal(d1.rotulo, 'Em atraso há 1 dia');       // singular, não "1 dias"
  assert.equal(Date.parse(d1.em), prazo + DIA);

  // No próprio dia, antes de completar 24h, continua sendo o primeiro.
  assert.equal(avisoDeAtraso(prazo, prazo + 5 * 3600000).chave, 'atraso-d1');

  // Passadas as 24h, o próximo é o segundo dia — e no plural.
  const d2 = avisoDeAtraso(prazo, prazo + DIA);
  assert.equal(d2.chave, 'atraso-d2');
  assert.equal(d2.rotulo, 'Em atraso há 2 dias');

  // Tick parado três dias não dispara a fila atrasada de uma vez: volta no dia
  // correto, sem despejar três notificações no mesmo minuto.
  const atrasado = avisoDeAtraso(prazo, prazo + 3 * DIA + 60000);
  assert.equal(atrasado.chave, 'atraso-d4');
  assert.ok(Date.parse(atrasado.em) > prazo + 3 * DIA);
});
