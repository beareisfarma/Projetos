// O orquestrador decide QUEM interpreta o recado — e essa decisão é o que
// separa um app gratuito de um app que cobra por lembrete.
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { interpretar, HORA_PADRAO } from '../api/_lib/interpretar.js';

const AGORA = new Date('2026-09-15T15:00:00Z'); // terça, 12:00 em Brasília
const SEM_DATA = 'alinhar aquilo que combinamos com o pessoal do jurídico';

function clienteDeMentira(conteudoJson, capturar = {}) {
  capturar.chamadas = 0;
  const cliente = new Anthropic({
    apiKey: 'chave-de-teste',
    maxRetries: 0,
    fetch: async (url, init) => {
      capturar.chamadas++;
      capturar.url = String(url);
      capturar.corpo = JSON.parse(init.body);
      return new Response(JSON.stringify({
        id: 'msg_teste', type: 'message', role: 'assistant', model: 'claude-opus-5',
        content: [{ type: 'text', text: JSON.stringify(conteudoJson) }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  cliente.espiao = capturar;
  return cliente;
}

const RESPOSTA_PADRAO = {
  titulo: 'Alinhar com o jurídico', detalhes: 'assunto combinado',
  prazo_local: '2026-09-18T14:00', hora_explicita: true, confianca: 'alta', observacao: '',
};

test('recado com data é resolvido de graça, sem tocar na API', async () => {
  const cliente = clienteDeMentira(RESPOSTA_PADRAO);
  const lido = await interpretar('enviar o relatório da Pharma sexta às 14h', AGORA, cliente);

  assert.equal(lido.motor, 'local');
  assert.equal(cliente.espiao.chamadas, 0, 'gastou chamada de IA num recado que o parser local resolve');
  assert.equal(lido.titulo, 'Enviar o relatório da Pharma');
  assert.equal(lido.prazo.toISOString(), '2026-09-18T17:00:00.000Z');
});

test('recado sem data cai na IA e a requisição vai no formato esperado', async () => {
  const cliente = clienteDeMentira(RESPOSTA_PADRAO);
  const lido = await interpretar(SEM_DATA, AGORA, cliente);

  assert.equal(cliente.espiao.chamadas, 1);
  assert.equal(lido.motor, 'ia');
  assert.match(cliente.espiao.url, /\/v1\/messages$/);
  assert.equal(cliente.espiao.corpo.model, 'claude-opus-5');
  assert.equal(cliente.espiao.corpo.output_config.effort, 'low');
  assert.equal(cliente.espiao.corpo.output_config.format.type, 'json_schema');
  assert.ok(cliente.espiao.corpo.output_config.format.schema.properties.prazo_local);
  // O instante de referência precisa ir junto, senão "sexta" não tem contra o quê resolver.
  assert.match(cliente.espiao.corpo.messages[0].content, /Agora são 2026-09-15T12:00/);
  // 14h de Brasília vira 17h UTC.
  assert.equal(lido.prazo.toISOString(), '2026-09-18T17:00:00.000Z');
  assert.equal(lido.detalhes, 'assunto combinado');
});

test('MODO_INTERPRETACAO=local nunca chama a IA, nem sem data', async () => {
  const anterior = process.env.MODO_INTERPRETACAO;
  process.env.MODO_INTERPRETACAO = 'local';
  try {
    const cliente = clienteDeMentira(RESPOSTA_PADRAO);
    const lido = await interpretar(SEM_DATA, AGORA, cliente);
    assert.equal(cliente.espiao.chamadas, 0);
    assert.equal(lido.motor, 'palpite');
  } finally {
    if (anterior === undefined) delete process.env.MODO_INTERPRETACAO;
    else process.env.MODO_INTERPRETACAO = anterior;
  }
});

test('sem IA nenhuma, o recado ainda vira lembrete para amanhã', async () => {
  const lido = await interpretar(SEM_DATA, AGORA);  // sem cliente e sem chave
  assert.equal(lido.motor, 'palpite');
  assert.equal(lido.confianca, 'baixa');
  assert.match(lido.observacao, /Não identifiquei data/);
  // Amanhã (16/09) na hora padrão, em UTC.
  assert.equal(lido.prazo.toISOString(),
    `2026-09-16T${String(HORA_PADRAO + 3).padStart(2, '0')}:00:00.000Z`);
  assert.ok(lido.titulo.length > 0, 'ficou sem título');
});

test('falha da IA não perde o recado — cai no palpite', async () => {
  const cliente = new Anthropic({
    apiKey: 'chave-de-teste', maxRetries: 0,
    fetch: async () => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'fora do ar' } }),
      { status: 500, headers: { 'content-type': 'application/json' } }),
  });
  const lido = await interpretar(SEM_DATA, AGORA, cliente);
  assert.equal(lido.motor, 'palpite');
  assert.ok(lido.prazo instanceof Date);
});

test('recado vazio é recusado antes de qualquer trabalho', async () => {
  await assert.rejects(() => interpretar('   ', AGORA), /Recado vazio/);
});
