import test from 'node:test';
import assert from 'node:assert/strict';
import { deLocalParaUTC, textoLocal, offsetMinutos, naMesmaDataLocal } from '../api/_lib/tempo.js';
import { montarAvisos, comoFalta, faixa } from '../api/_lib/agenda.js';

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

test('agenda: prazo distante ganha a escada inteira, em ordem', () => {
  const avisos = montarAvisos(Date.parse('2026-09-25T14:00:00-03:00'), AGORA);
  assert.deepEqual(avisos.map((a) => a.chave), ['d7', 'd3', 'd1', 'dia', 'h3', 'm30', 'prazo']);
  for (let i = 1; i < avisos.length; i++) {
    assert.ok(Date.parse(avisos[i].em) > Date.parse(avisos[i - 1].em), 'avisos fora de ordem');
  }
});

test('agenda: nenhum aviso cai no passado nem depois do prazo', () => {
  const prazo = Date.parse('2026-09-17T18:00:00-03:00');
  for (const a of montarAvisos(prazo, AGORA)) {
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
