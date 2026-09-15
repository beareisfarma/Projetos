// Verifica a montagem da requisição e a desserialização da resposta sem gastar
// chamada real: um fetch controlado devolve uma resposta canônica da API.
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { interpretar, HORA_PADRAO } from '../api/_lib/interpretar.js';

function clienteDeMentira(conteudoJson, capturar) {
  return new Anthropic({
    apiKey: 'chave-de-teste',
    maxRetries: 0,
    fetch: async (url, init) => {
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
}

test('interpretar monta a requisição no formato esperado pela API', async () => {
  const capturar = {};
  await interpretar('enviar o relatório sexta às 14h', new Date('2026-09-15T15:00:00Z'),
    clienteDeMentira({
      titulo: 'Enviar relatório', detalhes: '', prazo_local: '2026-09-18T14:00',
      hora_explicita: true, confianca: 'alta', observacao: '',
    }, capturar));

  assert.match(capturar.url, /\/v1\/messages$/);
  assert.equal(capturar.corpo.model, 'claude-opus-5');
  assert.equal(capturar.corpo.output_config.effort, 'low');
  assert.equal(capturar.corpo.output_config.format.type, 'json_schema');
  assert.ok(capturar.corpo.output_config.format.schema.properties.prazo_local, 'schema sem prazo_local');
  assert.ok(capturar.corpo.system.includes(String(HORA_PADRAO).padStart(2, '0')),
    'instruções não trazem a hora padrão');
  // O instante de referência precisa ir junto, senão "sexta" não tem contra o quê resolver.
  assert.match(capturar.corpo.messages[0].content, /Agora são 2026-09-15T12:00/);
});

test('interpretar converte o horário local devolvido em instante UTC', async () => {
  const lido = await interpretar('relatório sexta às 14h', new Date('2026-09-15T15:00:00Z'),
    clienteDeMentira({
      titulo: 'Enviar relatório da Pharma', detalhes: 'versão final',
      prazo_local: '2026-09-18T14:00', hora_explicita: true, confianca: 'alta', observacao: '',
    }, {}));

  assert.equal(lido.titulo, 'Enviar relatório da Pharma');
  assert.equal(lido.detalhes, 'versão final');
  assert.equal(lido.prazo.toISOString(), '2026-09-18T17:00:00.000Z'); // 14h em Brasília
  assert.equal(lido.confianca, 'alta');
});

test('interpretar propaga baixa confiança para a tela conferir', async () => {
  const lido = await interpretar('depois eu vejo isso', new Date('2026-09-15T15:00:00Z'),
    clienteDeMentira({
      titulo: 'Rever assunto pendente', detalhes: '', prazo_local: '2026-09-16T18:00',
      hora_explicita: false, confianca: 'baixa', observacao: 'Nenhuma data foi dita.',
    }, {}));

  assert.equal(lido.confianca, 'baixa');
  assert.equal(lido.observacao, 'Nenhuma data foi dita.');
  assert.equal(lido.horaExplicita, false);
});

test('interpretar recusa recado vazio antes de chamar a API', async () => {
  await assert.rejects(() => interpretar('   ', new Date()), /Recado vazio/);
});
