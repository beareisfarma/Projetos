/**
 * Testes dos módulos que não dependem do navegador.
 * O fluxo de tela é conferido com o roteiro do Playwright descrito no README.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { copiaECola, crc16, crcConfere, ascii, txidLimpo, campo } from '../js/pix.js';
import {
  emCentavos, reais, vencimentoEm, diasEntre, idade, somarMeses,
  competenciaPorExtenso, telefoneInternacional, telefoneBonito, diaLocal,
} from '../js/formato.js';
import {
  gerarMensalidades, situacaoFinanceira, pagarMensalidade, desfazerPagamento,
  idDoLancamento, previsaoDoMes, resumoDoMes, saldoAcumulado, filaDeCobranca,
  conferirEscalacao, frequencia, valorDaMensalidade, destinatarioDaCobranca,
  ehMenor, estaAtrasada, resumoDePresenca, proximoCompromisso,
} from '../js/modelo.js';
import { mensagemDeCobranca, mensagemDeRecibo, mensagemDeConvocacao, linkWhatsApp } from '../js/cobranca.js';
import { migrar, lerBackup, estadoVazio } from '../js/estado.js';

/* ------------------------------------------------------------------ */
/* Pix                                                                 */
/* ------------------------------------------------------------------ */

test('CRC-16/CCITT-FALSE bate com o valor de referência do padrão', () => {
  // "123456789" → 0x29B1 é o vetor de teste publicado para esta variante.
  assert.equal(crc16('123456789'), '29B1');
});

test('o payload do Pix tem os campos obrigatórios e o CRC confere', () => {
  const codigo = copiaECola({
    chave: 'escola@exemplo.com', nome: 'Escolinha Volei', cidade: 'Niteroi',
    centavos: 15000, txid: 'AT01202609',
  });
  assert.ok(codigo.startsWith('000201'));          // versão do payload
  assert.ok(codigo.includes('010211'));            // estático
  assert.ok(codigo.includes('br.gov.bcb.pix'));
  assert.ok(codigo.includes('5303986'));           // real
  assert.ok(codigo.includes('54061') && codigo.includes('150.00'));
  assert.ok(codigo.includes('5802BR'));
  assert.ok(crcConfere(codigo));
});

test('sem valor o campo 54 não entra — o pagador digita quanto quiser', () => {
  const codigo = copiaECola({ chave: 'x@y.com', nome: 'A', cidade: 'B' });
  assert.ok(!codigo.includes('5406'));
  assert.ok(crcConfere(codigo));
});

test('o valor vai para o payload em reais, vindo de centavos e sem float', () => {
  assert.ok(copiaECola({ chave: 'a@b.c', nome: 'N', cidade: 'C', centavos: 1 }).includes('54040.01'));
  assert.ok(copiaECola({ chave: 'a@b.c', nome: 'N', cidade: 'C', centavos: 123456 }).includes('54071234.56'));
});

test('acento sai do payload e o identificador fica só com letras e números', () => {
  assert.equal(ascii('São Gonçalo'), 'Sao Goncalo');
  assert.equal(txidLimpo('MENS/2026-09 #12'), 'MENS20260912');
  assert.equal(txidLimpo('###'), '***');           // vazio vira o coringa do padrão
});

test('um CRC adulterado é recusado', () => {
  const codigo = copiaECola({ chave: 'a@b.c', nome: 'N', cidade: 'C', centavos: 100 });
  assert.ok(!crcConfere(`${codigo.slice(0, -1)}0`));
});

test('o campo carrega o tamanho com dois dígitos', () => {
  assert.equal(campo('00', '01'), '00020 1'.replace(' ', ''));
  assert.equal(campo('59', 'ABC'), '5903ABC');
});

/* ------------------------------------------------------------------ */
/* Dinheiro e datas                                                    */
/* ------------------------------------------------------------------ */

test('o valor digitado vira centavos na convenção brasileira', () => {
  assert.equal(emCentavos('150'), 15000);
  assert.equal(emCentavos('150,50'), 15050);
  assert.equal(emCentavos('R$ 1.500,00'), 150000);
  assert.equal(emCentavos('1.500'), 150000);      // ponto sozinho é milhar
  assert.equal(emCentavos('1500.50'), 150050);    // com duas casas, é decimal
  assert.equal(emCentavos(''), 0);
  assert.equal(emCentavos('abc'), 0);
});

test('reais formata em pt-BR', () => {
  assert.match(reais(150000), /1\.500,00/);
  assert.match(reais(0), /0,00/);
});

test('dia 31 num mês curto cai no último dia, em vez de virar o mês', () => {
  assert.equal(vencimentoEm('2026-02', 31), '2026-02-28');
  assert.equal(vencimentoEm('2024-02', 31), '2024-02-29');   // bissexto
  assert.equal(vencimentoEm('2026-04', 31), '2026-04-30');
  assert.equal(vencimentoEm('2026-09', 10), '2026-09-10');
});

test('somarMeses atravessa a virada do ano', () => {
  assert.equal(somarMeses('2026-12', 1), '2027-01');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.equal(somarMeses('2026-09', 0), '2026-09');
});

test('a idade só vira no dia do aniversário', () => {
  assert.equal(idade('2010-09-18', '2026-09-18'), 16);
  assert.equal(idade('2010-09-19', '2026-09-18'), 15);
  assert.equal(idade('', '2026-09-18'), null);
});

test('diasEntre conta pelo calendário, sem fuso no meio', () => {
  assert.equal(diasEntre('2026-09-10', '2026-09-18'), 8);
  assert.equal(diasEntre('2026-09-18', '2026-09-10'), -8);
  assert.equal(diasEntre('2026-02-28', '2026-03-01'), 1);
});

test('diaLocal usa a data local, não o UTC', () => {
  // 23h do dia 18 no Brasil já é dia 19 em UTC; toISOString() erraria aqui.
  const noite = new Date(2026, 8, 18, 23, 30);
  assert.equal(diaLocal(noite), '2026-09-18');
});

test('telefone sai no formato do WhatsApp e volta bonito na tela', () => {
  assert.equal(telefoneInternacional('(21) 98888-7777'), '5521988887777');
  assert.equal(telefoneInternacional('5521988887777'), '5521988887777');
  assert.equal(telefoneInternacional('123'), '');
  assert.equal(telefoneBonito('5521988887777'), '(21) 98888-7777');
});

test('competência por extenso', () => {
  assert.equal(competenciaPorExtenso('2026-03'), 'março de 2026');
});

/* ------------------------------------------------------------------ */
/* Mensalidades                                                        */
/* ------------------------------------------------------------------ */

const times = [{ id: 't1', nome: 'Sub-15', mensalidade: 15000 }];
const base = (extra = {}) => ({
  id: 'a1', nome: 'Ana Souza', status: 'ativo', timeIds: ['t1'], vencimentoDia: 10, ...extra,
});

test('o valor do atleta vence o do time; bolsista não paga', () => {
  assert.equal(valorDaMensalidade(base(), times), 15000);
  assert.equal(valorDaMensalidade(base({ mensalidade: 12000 }), times), 12000);
  assert.equal(valorDaMensalidade(base({ isento: true, mensalidade: 12000 }), times), 0);
});

test('gerar mensalidades pula inativo e bolsista', () => {
  const atletas = [
    base(), base({ id: 'a2', isento: true }), base({ id: 'a3', status: 'inativo' }),
  ];
  const novas = gerarMensalidades({ atletas, times, competencia: '2026-09' });
  assert.equal(novas.length, 1);
  assert.equal(novas[0].atletaId, 'a1');
  assert.equal(novas[0].valor, 15000);
  assert.equal(novas[0].vencimento, '2026-09-10');
  assert.equal(novas[0].status, 'pendente');
});

test('gerar duas vezes no mesmo mês não duplica cobrança', () => {
  const atletas = [base()];
  const primeira = gerarMensalidades({ atletas, times, competencia: '2026-09' });
  const segunda = gerarMensalidades({ atletas, times, competencia: '2026-09', existentes: primeira });
  assert.equal(segunda.length, 0);
});

test('atleta sem valor definido não gera cobrança de zero', () => {
  const novas = gerarMensalidades({
    atletas: [base({ timeIds: ['inexistente'] })], times, competencia: '2026-09',
  });
  assert.equal(novas.length, 0);
});

test('a situação distingue em dia, a vencer e em atraso', () => {
  const m = (competencia, vencimento, status = 'pendente') =>
    ({ id: `m${competencia}`, atletaId: 'a1', competencia, vencimento, valor: 15000, status });

  assert.equal(situacaoFinanceira('a1', [m('2026-09', '2026-09-10', 'pago')], '2026-09-18').status, 'dia');
  assert.equal(situacaoFinanceira('a1', [m('2026-09', '2026-09-25')], '2026-09-18').status, 'aberto');

  const atrasada = situacaoFinanceira('a1', [m('2026-08', '2026-08-10'), m('2026-09', '2026-09-10')], '2026-09-18');
  assert.equal(atrasada.status, 'atraso');
  assert.equal(atrasada.pendentes, 2);
  assert.equal(atrasada.devido, 30000);
  assert.equal(atrasada.diasDoMaisAntigo, 39);
});

test('estaAtrasada só vale depois do vencimento, não no próprio dia', () => {
  const m = { status: 'pendente', vencimento: '2026-09-10' };
  assert.equal(estaAtrasada(m, '2026-09-10'), false);
  assert.equal(estaAtrasada(m, '2026-09-11'), true);
  assert.equal(estaAtrasada({ ...m, status: 'pago' }, '2026-09-30'), false);
});

/* ------------------------------------------------------------------ */
/* A ponte entre mensalidade e caixa                                   */
/* ------------------------------------------------------------------ */

test('dar baixa lança a entrada no caixa com id derivado da mensalidade', () => {
  const m = { id: 'm1', escolaId: 'e', atletaId: 'a1', competencia: '2026-09', valor: 15000,
    vencimento: '2026-09-10', status: 'pendente' };
  const { mensalidade, lancamento } = pagarMensalidade(m, base(), { pagoEm: '2026-09-12', forma: 'Pix' });

  assert.equal(mensalidade.status, 'pago');
  assert.equal(mensalidade.pagoEm, '2026-09-12');
  assert.equal(lancamento.id, idDoLancamento('m1'));
  assert.equal(lancamento.tipo, 'entrada');
  assert.equal(lancamento.categoria, 'Mensalidade');
  assert.equal(lancamento.valor, 15000);
  assert.equal(lancamento.refId, 'm1');
  assert.match(lancamento.descricao, /Ana Souza/);
});

test('dar baixa duas vezes produz o MESMO id — o caixa não conta em dobro', () => {
  const m = { id: 'm1', escolaId: 'e', atletaId: 'a1', competencia: '2026-09', valor: 15000, status: 'pendente' };
  const a = pagarMensalidade(m, base()).lancamento;
  const b = pagarMensalidade(m, base()).lancamento;
  assert.equal(a.id, b.id);
});

test('pagamento com desconto grava o valor recebido nos dois lados', () => {
  const m = { id: 'm1', escolaId: 'e', atletaId: 'a1', competencia: '2026-09', valor: 15000, status: 'pendente' };
  const { mensalidade, lancamento } = pagarMensalidade(m, base(), { valorPago: 12000 });
  assert.equal(mensalidade.valor, 12000);
  assert.equal(lancamento.valor, 12000);
});

test('desfazer a baixa devolve a pendência e aponta a entrada a remover', () => {
  const paga = { id: 'm1', atletaId: 'a1', competencia: '2026-09', valor: 15000, status: 'pago',
    pagoEm: '2026-09-12', forma: 'Pix' };
  const { mensalidade, lancamentoRemovido } = desfazerPagamento(paga);
  assert.equal(mensalidade.status, 'pendente');
  assert.equal(mensalidade.pagoEm, null);
  assert.equal(lancamentoRemovido, idDoLancamento('m1'));
});

/* ------------------------------------------------------------------ */
/* Caixa                                                               */
/* ------------------------------------------------------------------ */

const lancamentos = [
  { id: 'l1', data: '2026-09-05', tipo: 'entrada', categoria: 'Mensalidade', valor: 15000 },
  { id: 'l2', data: '2026-09-07', tipo: 'entrada', categoria: 'Mensalidade', valor: 12000 },
  { id: 'l3', data: '2026-09-08', tipo: 'saida', categoria: 'Aluguel de quadra', valor: 60000 },
  { id: 'l4', data: '2026-08-08', tipo: 'saida', categoria: 'Aluguel de quadra', valor: 60000 },
  { id: 'l5', data: '2026-10-01', tipo: 'entrada', categoria: 'Matrícula', valor: 8000 },
];

test('o resumo do mês soma só o mês e agrupa por categoria', () => {
  const r = resumoDoMes(lancamentos, '2026-09');
  assert.equal(r.entradas, 27000);
  assert.equal(r.saidas, 60000);
  assert.equal(r.saldo, -33000);
  assert.equal(r.lancamentos, 3);
  assert.equal(r.porCategoria['entrada|Mensalidade'], 27000);
  assert.equal(r.porCategoria['saida|Aluguel de quadra'], 60000);
});

test('o acumulado inclui os meses anteriores e exclui o futuro', () => {
  assert.equal(saldoAcumulado(lancamentos, '2026-09'), -93000);
  assert.equal(saldoAcumulado(lancamentos, '2026-08'), -60000);
});

test('a previsão do mês separa emitido, recebido e vencido', () => {
  const ms = [
    { atletaId: 'a1', competencia: '2026-09', valor: 15000, vencimento: '2026-09-10', status: 'pago' },
    { atletaId: 'a2', competencia: '2026-09', valor: 15000, vencimento: '2026-09-10', status: 'pendente' },
    { atletaId: 'a3', competencia: '2026-09', valor: 10000, vencimento: '2026-09-25', status: 'pendente' },
    { atletaId: 'a4', competencia: '2026-09', valor: 99900, vencimento: '2026-09-10', status: 'cancelado' },
  ];
  const p = previsaoDoMes(ms, '2026-09', '2026-09-18');
  assert.equal(p.emitido, 40000);      // o cancelado fica de fora
  assert.equal(p.recebido, 15000);
  assert.equal(p.aReceber, 25000);
  assert.equal(p.emAtraso, 15000);     // só o vencido
  assert.equal(p.atrasadas, 1);
  assert.equal(p.taxa, 0.375);
});

test('sem cobrança emitida a taxa é zero, não NaN', () => {
  assert.equal(previsaoDoMes([], '2026-09').taxa, 0);
});

test('a fila de cobrança vem do mais atrasado para o menos', () => {
  const atletas = [base({ id: 'a1', nome: 'Ana' }), base({ id: 'a2', nome: 'Bruno' }), base({ id: 'a3', nome: 'Caio' })];
  const ms = [
    { atletaId: 'a1', competencia: '2026-09', valor: 15000, vencimento: '2026-09-15', status: 'pendente' },
    { atletaId: 'a2', competencia: '2026-07', valor: 15000, vencimento: '2026-07-10', status: 'pendente' },
    { atletaId: 'a3', competencia: '2026-09', valor: 15000, vencimento: '2026-09-10', status: 'pago' },
  ];
  const fila = filaDeCobranca(atletas, ms, '2026-09-18');
  assert.deepEqual(fila.map((l) => l.atleta.nome), ['Bruno', 'Ana']);   // Caio pagou
});

/* ------------------------------------------------------------------ */
/* Times, escalação e presença                                         */
/* ------------------------------------------------------------------ */

test('a escalação avisa quando não há seis em quadra, mas não barra', () => {
  const cheia = Array.from({ length: 6 }, (_, i) => ({ atletaId: `a${i}`, papel: 'titular' }));
  assert.equal(conferirEscalacao([...cheia, { atletaId: 'l', papel: 'líbero' }]).avisos.length, 0);
  assert.match(conferirEscalacao(cheia.slice(0, 4)).avisos[0], /Faltam 2/);
  assert.match(conferirEscalacao([...cheia, { atletaId: 'x', papel: 'titular' }]).avisos[0], /7 titulares/);
  assert.match(conferirEscalacao([...cheia,
    { atletaId: 'l1', papel: 'líbero' }, { atletaId: 'l2', papel: 'líbero' }]).avisos[0], /líbero/);
});

test('a frequência ignora treino que só teve confirmação, não chamada', () => {
  const treinos = [
    { presencas: [{ atletaId: 'a1', status: 'confirmado' }] },          // ainda não aconteceu
    { presencas: [{ atletaId: 'a1', status: 'presente' }] },
    { presencas: [{ atletaId: 'a1', status: 'falta' }] },
  ];
  const f = frequencia('a1', treinos);
  assert.equal(f.treinos, 2);
  assert.equal(f.presencas, 1);
  assert.equal(f.taxa, 0.5);
  assert.equal(frequencia('a1', []).taxa, null);
});

test('o resumo de presença conta quem não respondeu', () => {
  const atletas = [base({ id: 'a1' }), base({ id: 'a2' }), base({ id: 'a3' })];
  const r = resumoDePresenca({ timeId: 't1', presencas: [{ atletaId: 'a1', status: 'presente' }] }, atletas);
  assert.equal(r.elenco, 3);
  assert.equal(r.presentes, 1);
  assert.equal(r.semResposta, 2);
});

test('o próximo compromisso ignora o que já passou', () => {
  const jogos = [{ id: 'j1', data: '2026-09-10', hora: '10:00' }, { id: 'j2', data: '2026-09-25', hora: '10:00' }];
  const treinos = [{ id: 't1', data: '2026-09-20', hora: '18:00' }];
  const p = proximoCompromisso(jogos, treinos, '2026-09-18');
  assert.equal(p.tipo, 'treino');
  assert.equal(p.item.id, 't1');
  assert.equal(proximoCompromisso([], [], '2026-09-18'), null);
});

/* ------------------------------------------------------------------ */
/* Para quem a mensagem vai                                            */
/* ------------------------------------------------------------------ */

test('cobrança de menor de idade vai para o responsável', () => {
  const menor = base({
    nascimento: `${new Date().getFullYear() - 13}-01-01`,
    telefone: '21911111111', responsavelNome: 'Marcia', responsavelTelefone: '21922222222',
  });
  assert.equal(ehMenor(menor), true);
  const destino = destinatarioDaCobranca(menor);
  assert.equal(destino.telefone, '21922222222');
  assert.equal(destino.paraResponsavel, true);
});

test('atleta adulto recebe a própria cobrança', () => {
  const adulto = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const destino = destinatarioDaCobranca(adulto);
  assert.equal(destino.telefone, '21911111111');
  assert.equal(destino.paraResponsavel, false);
});

test('menor sem telefone de responsável cai no do próprio, e sem nenhum não há destino', () => {
  const semResp = base({ nascimento: `${new Date().getFullYear() - 13}-01-01`, telefone: '21911111111' });
  assert.equal(destinatarioDaCobranca(semResp).telefone, '21911111111');
  assert.equal(destinatarioDaCobranca(base()), null);
});

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */

const escola = { nome: 'Escolinha X', pixChave: 'x@y.com', pixNome: 'Escolinha X', pixCidade: 'Niteroi' };
const pendente = (competencia, vencimento) =>
  ({ id: `m${competencia}`, atletaId: 'a1', competencia, valor: 15000, vencimento, status: 'pendente' });

test('uma mensalidade no singular, duas no plural', () => {
  const a = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const uma = mensagemDeCobranca(a, [pendente('2026-08', '2026-08-10')], escola, '2026-09-18').texto;
  const duas = mensagemDeCobranca(a,
    [pendente('2026-08', '2026-08-10'), pendente('2026-09', '2026-09-10')], escola, '2026-09-18').texto;

  assert.match(uma, /A mensalidade de agosto de 2026 está em aberto/);
  assert.match(duas, /As mensalidades de agosto de 2026 e setembro de 2026 estão em aberto/);
  assert.match(duas, /a mais antiga venceu/);
});

test('antes do vencimento é lembrete, depois é cobrança', () => {
  const a = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const antes = mensagemDeCobranca(a, [pendente('2026-10', '2026-10-10')], escola, '2026-09-18').texto;
  assert.match(antes, /Passando para lembrar/);
  assert.ok(!antes.includes('em aberto'));
});

test('a cobrança carrega o Pix com a soma dos meses em aberto', () => {
  const a = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const r = mensagemDeCobranca(a,
    [pendente('2026-08', '2026-08-10'), pendente('2026-09', '2026-09-10')], escola, '2026-09-18');
  assert.equal(r.total, 30000);
  const codigo = r.texto.split('\n').find((l) => l.startsWith('000201'));
  assert.ok(codigo && crcConfere(codigo));
  assert.ok(codigo.includes('300.00'));
});

test('sem chave Pix a mensagem sai sem código, e não quebrada', () => {
  const a = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const texto = mensagemDeCobranca(a, [pendente('2026-09', '2026-09-10')], { nome: 'Escolinha X' }, '2026-09-18').texto;
  assert.ok(!texto.includes('000201'));
  assert.match(texto, /Escolinha X/);
});

test('quem não deve nada não gera cobrança', () => {
  assert.equal(mensagemDeCobranca(base(), [], escola, '2026-09-18'), null);
});

test('recibo e convocação saem com os dados do compromisso', () => {
  const a = base({ nascimento: '1995-01-01', telefone: '21911111111' });
  const recibo = mensagemDeRecibo(a, { competencia: '2026-09', valor: 15000, pagoEm: '2026-09-12' }, escola);
  assert.match(recibo.texto, /setembro de 2026/);
  assert.match(recibo.texto, /12\/09\/2026/);

  const jogo = { data: '2026-09-25', hora: '10:00', chegada: '09:15', adversario: 'AABB',
    local: 'Ginásio', escalados: [{ atletaId: 'a1', papel: 'titular' }] };
  const convocacao = mensagemDeConvocacao(a, jogo, { nome: 'Sub-15' }, escola);
  assert.match(convocacao.texto, /titular/);
  assert.match(convocacao.texto, /AABB/);
  assert.match(convocacao.texto, /09:15/);
});

test('link do WhatsApp exige telefone — sem número devolve nulo', () => {
  assert.equal(linkWhatsApp('', 'oi'), null);
  assert.equal(linkWhatsApp('123', 'oi'), null);
  const link = linkWhatsApp('(21) 98888-7777', 'oi, tudo bem?');
  assert.ok(link.startsWith('https://wa.me/5521988887777?text='));
  assert.ok(link.includes('%20'));
});

/* ------------------------------------------------------------------ */
/* Estado e backup                                                     */
/* ------------------------------------------------------------------ */

test('migrar preenche o que falta sem perder o que veio', () => {
  const migrado = migrar({ atletas: [{ id: 'a1' }], escola: { nome: 'X' } });
  assert.equal(migrado.atletas.length, 1);
  assert.equal(migrado.escola.nome, 'X');
  assert.equal(migrado.escola.vencimentoPadrao, 10);   // veio do padrão
  assert.deepEqual(migrado.jogos, []);
  assert.deepEqual(migrar(null), estadoVazio());
});

test('restaurar recusa um JSON que não é backup deste app', () => {
  assert.throws(() => lerBackup('{"qualquer":1}'), /não parece um backup/);
  assert.throws(() => lerBackup('não é json'));
  const bom = lerBackup(JSON.stringify({ escola: { nome: 'X' }, atletas: [] }));
  assert.equal(bom.escola.nome, 'X');
});
