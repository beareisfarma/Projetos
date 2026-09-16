// O resumo diário é a única notificação que sai sem um lembrete pedindo. Se ele
// repetir, vira spam; se ele calar, ela não sabe que existe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataLocal, momentoDoResumo, textoDoResumo, JANELA_HORAS } from '../api/_lib/resumo.js';

// 10:00Z = 07:00 em Brasília.
const emBrasilia = (dia, horaUTC, min = 0) =>
  new Date(Date.UTC(2026, 8, dia, horaUTC, min));

const pendentes = (hoje, atrasadas) => [
  ...Array(hoje).fill({ faixa: 'hoje' }),
  ...Array(atrasadas).fill({ faixa: 'atrasado' }),
  { faixa: 'semana' }, { faixa: 'depois' },   // ruído: não pode entrar na conta
];

test('a janela do resumo abre na hora e fecha algumas horas depois', () => {
  const HORA = 7;
  assert.equal(momentoDoResumo(HORA, emBrasilia(17, 9, 59)), 'cedo');   // 06:59
  assert.equal(momentoDoResumo(HORA, emBrasilia(17, 10, 0)), 'agora');  // 07:00
  assert.equal(momentoDoResumo(HORA, emBrasilia(17, 13, 59)), 'agora'); // 10:59
  // Passou da janela: melhor nenhum "bom dia" do que um às 22h.
  assert.equal(momentoDoResumo(HORA, emBrasilia(17, 14, 0)), 'tarde');  // 11:00
  assert.equal(JANELA_HORAS, 4);
});

test('resumo desligado nunca entra na janela', () => {
  for (const h of [9, 12, 20, 23]) {
    assert.equal(momentoDoResumo(null, emBrasilia(17, h)), 'cedo');
  }
});

test('a data local é a chave de "já mandei hoje", e vira à meia-noite local', () => {
  // 02:59Z do dia 18 ainda é dia 17 em Brasília (23:59 local).
  assert.equal(dataLocal(emBrasilia(18, 2, 59)), '2026-09-17');
  assert.equal(dataLocal(emBrasilia(18, 3, 0)), '2026-09-18');
});

test('o texto conta certo, no singular e no plural', () => {
  const manha = emBrasilia(17, 10);
  assert.equal(textoDoResumo(pendentes(3, 1), manha).corpo,
    'Você tem 3 tarefas para hoje e 1 atrasada.');
  assert.equal(textoDoResumo(pendentes(1, 0), manha).corpo,
    'Você tem 1 tarefa para hoje.');
  assert.equal(textoDoResumo(pendentes(0, 2), manha).corpo,
    'Você tem 2 tarefas atrasadas.');
  assert.equal(textoDoResumo(pendentes(0, 1), manha).corpo,
    'Você tem 1 tarefa atrasada.');
  assert.equal(textoDoResumo(pendentes(0, 0), manha).corpo,
    'Nenhum prazo para hoje e nada em atraso. Dia limpo.');
});

test('a saudação segue a hora, e o nome do assistente assina', () => {
  assert.match(textoDoResumo([], emBrasilia(17, 10)).titulo, /^Bom dia!$/);
  assert.match(textoDoResumo([], emBrasilia(17, 18)).titulo, /^Boa tarde!$/);   // 15h
  assert.match(textoDoResumo([], emBrasilia(17, 23)).titulo, /^Boa noite!$/);   // 20h
  assert.equal(textoDoResumo([], emBrasilia(17, 10), 'Jarvis').titulo, 'Bom dia! — Jarvis');
});

test('os dados vão junto, para a tela poder usar depois', () => {
  const { dados } = textoDoResumo(pendentes(2, 5), emBrasilia(17, 10));
  assert.deepEqual(dados, { tipo: 'resumo', hoje: 2, atrasadas: 5 });
});
