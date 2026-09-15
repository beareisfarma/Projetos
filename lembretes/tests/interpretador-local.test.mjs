// O interpretador gratuito é o caminho padrão do app: se ele errar, o prazo erra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarLocal } from '../api/_lib/interpretador-local.js';

// Terça-feira, 15/09/2026, 12:00 em Brasília.
const TERCA = new Date('2026-09-15T15:00:00Z');

const local = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});
const quando = (d) => local.format(d).replace(', ', ' ');

function confere(recado, esperado, agora = TERCA) {
  const r = interpretarLocal(recado, agora);
  assert.ok(r, `não interpretou: ${recado}`);
  assert.equal(quando(r.prazo), esperado, `data errada em: ${recado}`);
  return r;
}

test('dias relativos', () => {
  confere('enviar nota fiscal hoje', '15/09/2026 18:00');
  confere('enviar nota fiscal amanhã', '16/09/2026 18:00');
  confere('enviar nota fiscal depois de amanhã', '17/09/2026 18:00');
});

test('dias da semana caem sempre na próxima ocorrência futura', () => {
  confere('entregar o orçamento sexta', '18/09/2026 18:00');
  confere('entregar o orçamento na quinta', '17/09/2026 18:00');
  confere('entregar o orçamento no domingo', '20/09/2026 18:00');
  // Hoje é terça: "terça" sem qualificador é hoje mesmo.
  confere('entregar o orçamento terça', '15/09/2026 18:00');
});

test('"que vem" escolhe a data mais cedo e pede conferência', () => {
  // Erro assimétrico: adiantar incomoda, atrasar faz perder o prazo.
  const r = confere('entregar sexta que vem', '18/09/2026 18:00');
  assert.equal(r.confianca, 'media');
  // Mas "hoje que vem" não existe: cai na semana seguinte.
  confere('entregar terça que vem', '22/09/2026 18:00');
});

test('datas numéricas e por extenso', () => {
  confere('pagar o INSS dia 07/10', '07/10/2026 18:00');
  confere('pagar o INSS 07/10/2027', '07/10/2027 18:00');
  confere('consulta 23 de outubro', '23/10/2026 18:00');
  confere('consulta 23 de out', '23/10/2026 18:00');
  confere('boleto do contador dia 20', '20/09/2026 18:00');
  // "dia 3" no dia 15 já passou neste mês, então é o mês que vem.
  confere('boleto do contador dia 3', '03/10/2026 18:00');
  // Data sem ano que já passou vira o ano seguinte.
  confere('renovar seguro 10/03', '10/03/2027 18:00');
});

test('contagens relativas', () => {
  confere('renovar o domínio em 2 semanas', '29/09/2026 18:00');
  confere('renovar o domínio daqui a 3 dias', '18/09/2026 18:00');
  confere('renovar o domínio em um mês', '15/10/2026 18:00');
  confere('renovar o domínio dentro de 10 dias', '25/09/2026 18:00');
});

test('horas explícitas e períodos do dia', () => {
  confere('reunião amanhã às 14h', '16/09/2026 14:00');
  confere('reunião amanhã às 9h30', '16/09/2026 09:30');
  confere('reunião amanhã 16:45', '16/09/2026 16:45');
  confere('reunião amanhã de manhã', '16/09/2026 09:00');
  confere('reunião amanhã à tarde', '16/09/2026 14:00');
  confere('reunião amanhã à noite', '16/09/2026 20:00');
  confere('reunião amanhã às 8 da noite', '16/09/2026 20:00');
  confere('reunião amanhã ao meio-dia', '16/09/2026 12:00');
  confere('reunião amanhã no fim do dia', '16/09/2026 18:00');
});

test('só hora, sem dia: hoje se der tempo, senão amanhã', () => {
  confere('fechar o caixa às 18h', '15/09/2026 18:00');
  const passado = interpretarLocal('fechar o caixa às 9h', TERCA);
  assert.equal(quando(passado.prazo), '16/09/2026 09:00');
  assert.match(passado.observacao, /amanhã/);
});

test('o título sai limpo, sem a data nem o preâmbulo', () => {
  const casos = [
    ['preciso enviar o relatório da Pharma sexta às 14h', 'Enviar o relatório da Pharma'],
    ['não posso perder o prazo do boleto do contador dia 20', 'Boleto do contador'],
    ['me lembra de responder a proposta amanhã de manhã', 'Responder a proposta'],
    ['tenho que revisar o contrato hoje às 18h', 'Revisar o contrato'],
    ['entregar o orçamento até sexta que vem', 'Entregar o orçamento'],
    ['pagar o INSS dia 07/10', 'Pagar o INSS'],
  ];
  for (const [recado, titulo] of casos) {
    assert.equal(interpretarLocal(recado, TERCA).titulo, titulo, `título errado em: ${recado}`);
  }
});

test('acentuação não quebra os padrões', () => {
  // O \\b do JavaScript é ASCII e falha depois de ã/ç/ê; as bordas são Unicode.
  for (const recado of ['enviar amanhã', 'enviar amanha', 'enviar terça', 'enviar terca',
    'enviar em um mês', 'enviar em um mes', 'enviar sábado', 'enviar sabado']) {
    assert.ok(interpretarLocal(recado, TERCA), `não interpretou: ${recado}`);
  }
});

test('devolve null quando não há data — aí a IA ou a tela decidem', () => {
  assert.equal(interpretarLocal('só um lembrete qualquer sem data nenhuma', TERCA), null);
  assert.equal(interpretarLocal('', TERCA), null);
  // Sobrou só a data, sem nada para nomear o lembrete.
  assert.equal(interpretarLocal('sexta', TERCA), null);
});

test('nenhum prazo interpretado nasce no passado sem ser sinalizado', () => {
  const r = interpretarLocal('terminar a apresentação hoje às 9h', TERCA);
  assert.equal(r.confianca, 'baixa');
  assert.match(r.observacao, /passou/);
});
