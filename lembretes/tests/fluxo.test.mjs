// Percorre o caminho inteiro: inscrever aparelho → criar lembrete → disparar o
// aviso no tick (com criptografia real do web-push) → adiar → concluir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { bancoFalso, pushFalso, pushDisponivel, fingirRequisicao, fingirResposta } from './apoio.mjs';

const USUARIO = 'usuario-de-teste';
const PIN = 'pin-de-teste-123';
const OUTRA = 'outra-pessoa';
const OUTRA_SENHA = 'senha-da-outra';
const SEGREDO_CRON = 'segredo-cron-456';

// Cada aparelho tem seu próprio endpoint; a chave da inscrição deriva dele.
// Dois cadastros no MESMO endpoint são o mesmo aparelho e, de propósito, o
// último dono vence — é o que acontece quando alguém troca de conta no celular.
let seqAparelho = 0;
function inscricaoFalsa(endpoint) {
  endpoint = `${endpoint}/aparelho-${++seqAparelho}`;
  // Chave pública P-256 de verdade: o web-push faz ECDH com ela antes de enviar.
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const ponto = Buffer.concat([
    Buffer.from([0x04]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url'),
  ]);
  return {
    endpoint,
    keys: { p256dh: ponto.toString('base64url'), auth: randomBytes(16).toString('base64url') },
  };
}

async function chamar(handler, req) {
  const res = fingirResposta();
  await handler(req, res);
  return res;
}

const comPin = (extra = {}) => ({ 'x-lembretes-usuario': USUARIO, 'x-lembretes-pin': PIN, ...extra });
const comOutra = () => ({ 'x-lembretes-usuario': OUTRA, 'x-lembretes-pin': OUTRA_SENHA });

test('fluxo completo do lembrete', { skip: pushDisponivel() ? false : 'openssl indisponível para o push falso' }, async (t) => {
  const banco = bancoFalso({ [USUARIO]: PIN, [OUTRA]: OUTRA_SENHA });
  const push = pushFalso();
  const urlBanco = await banco.subir();
  const urlPush = await push.subir();
  t.after(async () => { await banco.parar(); await push.parar(); });

  // Ambiente montado ANTES do import: os módulos leem process.env ao carregar.
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwkPriv = privateKey.export({ format: 'jwk' });
  process.env.SUPABASE_URL = urlBanco;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
  process.env.CRON_SECRET = SEGREDO_CRON;
  process.env.VAPID_SUBJECT = 'mailto:teste@exemplo.com';
  process.env.VAPID_PUBLIC_KEY = Buffer.concat([
    Buffer.from([0x04]), Buffer.from(jwkPriv.x, 'base64url'), Buffer.from(jwkPriv.y, 'base64url'),
  ]).toString('base64url');
  process.env.VAPID_PRIVATE_KEY = jwkPriv.d;

  const reminders = (await import('../api/reminders.js')).default;
  const subscribe = (await import('../api/subscribe.js')).default;
  const tick = (await import('../api/tick.js')).default;
  const store = await import('../api/_lib/store.js');

  await t.test('usuário ou senha errados são barrados', async () => {
    const r = await chamar(reminders, fingirRequisicao({ url: '/api/reminders',
      headers: { 'x-lembretes-usuario': USUARIO, 'x-lembretes-pin': 'errado' } }));
    assert.equal(r.codigo, 401);
    // usuário errado com a senha certa também não passa
    const r2 = await chamar(reminders, fingirRequisicao({ url: '/api/reminders',
      headers: { 'x-lembretes-usuario': 'outra-pessoa', 'x-lembretes-pin': PIN } }));
    assert.equal(r2.codigo, 401);
  });

  await t.test('tick sem segredo é barrado', async () => {
    const r = await chamar(tick, fingirRequisicao({ url: '/api/tick' }));
    assert.equal(r.codigo, 401);
  });

  await t.test('inscreve o aparelho no push', async () => {
    const r = await chamar(subscribe, fingirRequisicao({
      method: 'POST', url: '/api/subscribe', headers: comPin(),
      body: { inscricao: inscricaoFalsa(urlPush), apelido: 'iPhone de teste' },
    }));
    assert.equal(r.codigo, 201);
    assert.equal((await store.listarInscricoes(USUARIO)).length, 1);
  });

  let id;
  await t.test('cria um lembrete e monta a escada de avisos', async () => {
    const prazo = new Date(Date.now() + 3 * 86400000).toISOString();
    const r = await chamar(reminders, fingirRequisicao({
      method: 'POST', url: '/api/reminders', headers: comPin(),
      body: { titulo: 'Enviar relatório da Pharma', detalhes: 'versão final', prazo,
               antecedencias: ['d1', 'h1', 'm15'] },
    }));
    assert.equal(r.codigo, 201);
    id = r.corpo.lembrete.id;
    assert.deepEqual(r.corpo.lembrete.antecedencias, ['d1', 'h1', 'm15']);
    assert.equal(r.corpo.lembrete.status, 'pendente');
    assert.ok(r.corpo.lembrete.avisos.length >= 3, 'esperava vários avisos');
    assert.ok(r.corpo.lembrete.proximoAviso, 'nasceu sem próximo aviso');
  });

  await t.test('prazo digitado no cartão vence a data lida da frase', async () => {
    // Ela olhou o calendário; o interpretador só deduz. E aí não sobra nada
    // para conferir: a tela pode marcar direto.
    const prazo = new Date(Date.now() + 10 * 86400000).toISOString();
    const r = await chamar(reminders, fingirRequisicao({
      method: 'POST', url: '/api/reminders', headers: comPin(),
      body: { recado: 'jogo do Fluminense amanhã às 14h', prazo, antecedencias: ['h1'] },
    }));
    assert.equal(r.codigo, 201);
    assert.equal(r.corpo.lembrete.prazo, prazo, 'ignorou o prazo que ela digitou');
    assert.equal(r.corpo.lembrete.confianca, 'alta');
    assert.equal(r.corpo.lembrete.observacao, '');
    assert.equal(r.corpo.lembrete.dataExplicita, true);
    assert.equal(r.corpo.lembrete.horaExplicita, true);
    await chamar(reminders, fingirRequisicao({
      method: 'DELETE', url: `/api/reminders?id=${r.corpo.lembrete.id}`, headers: comPin() }));
  });

  await t.test('prazo digitado inválido é recusado, não vira data torta', async () => {
    const r = await chamar(reminders, fingirRequisicao({
      method: 'POST', url: '/api/reminders', headers: comPin(),
      body: { recado: 'qualquer coisa amanhã', prazo: 'quinta-feira que vem' },
    }));
    assert.equal(r.codigo, 400);
  });

  await t.test('aparece na lista de pendentes com faixa e texto relativo', async () => {
    const r = await chamar(reminders, fingirRequisicao({ url: '/api/reminders', headers: comPin() }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.pendentes.length, 1);
    assert.equal(r.corpo.pendentes[0].faixa, 'semana');
    assert.match(r.corpo.pendentes[0].falta, /^em \d+ dias?$/);
  });

  await t.test('tick não dispara nada antes da hora', async () => {
    const r = await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.disparados, 0);
    assert.equal(push.recebidas.length, 0);
  });

  await t.test('tick entrega o aviso vencido e criptografa a carga', async () => {
    // Antecipa o aviso do prazo para agora, como se o tempo tivesse passado.
    await store.reenfileirar(id, 'prazo', Date.now() - 1000);
    const r = await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.disparados, 1);
    assert.equal(r.corpo.relatorio[0].resultado, 'entregue');
    assert.equal(r.corpo.relatorio[0].entregues, 1);
    assert.equal(push.recebidas.length, 1);
    assert.ok(push.recebidas[0].bytes > 0, 'carga do push chegou vazia');
    assert.equal(push.recebidas[0].headers['content-encoding'], 'aes128gcm');
  });

  await t.test('tick repetido não notifica de novo', async () => {
    const r = await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(r.corpo.disparados, 0);
    assert.equal(push.recebidas.length, 1, 'notificou duas vezes o mesmo aviso');
  });

  await t.test('prazo estourado gera uma cobrança de atraso', async () => {
    const lembrete = await store.obter(id);
    const cobranca = lembrete.avisos.find((a) => a.chave === 'atraso');
    assert.ok(cobranca, 'nenhuma cobrança de atraso foi agendada');
    assert.ok(Date.parse(cobranca.em) > Date.now());
  });

  await t.test('atraso vira uma corrente diária que diz quantos dias faz', async () => {
    // Precisa de um lembrete DE VERDADE vencido: o de cima ainda vence daqui a
    // três dias, e antecipar a fila não torna o prazo passado.
    const prazo = new Date(Date.now() - 36 * 3600000).toISOString();   // 1,5 dia atrás
    const criado = await chamar(reminders, fingirRequisicao({
      method: 'POST', url: '/api/reminders', headers: comPin(),
      body: { titulo: 'Entregar o laudo', prazo, antecedencias: [] },
    }));
    const atrasadoId = criado.corpo.lembrete.id;
    // finally: se uma asserção falhar aqui, o lembrete temporário não pode
    // sobrar e quebrar as contagens dos testes seguintes.
    try {

    // O aviso do prazo nasce para daqui a um minuto (prazo vencido não fica mudo).
    await store.reenfileirar(atrasadoId, 'prazo', Date.now() - 1000);
    const antesDoPush = push.recebidas.length;
    await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(push.recebidas.length, antesDoPush + 1, 'o aviso do prazo não saiu');

    // Vencido há 1,5 dia: o próximo "novo dia" é o segundo.
    const depois = await store.obter(atrasadoId);
    const d2 = depois.avisos.find((a) => a.chave === 'atraso-d2');
    assert.ok(d2, 'o prazo venceu e nenhum aviso diário foi agendado');
    assert.equal(d2.rotulo, 'Em atraso há 2 dias');
    assert.equal(Date.parse(d2.em) - Date.parse(prazo), 2 * 24 * 3600000);
    assert.ok(Date.parse(d2.em) > Date.now(), 'agendou um aviso no passado');

    // Disparar o do segundo dia agenda o do terceiro: a corrente anda sozinha.
    await store.reenfileirar(atrasadoId, 'atraso-d2', Date.now() - 1000);
    await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    const d3 = (await store.obter(atrasadoId)).avisos.find((a) => a.chave === 'atraso-d3');
    assert.ok(d3, 'a corrente parou no segundo dia');
    assert.equal(d3.rotulo, 'Em atraso há 3 dias');

    // Concluído, a corrente morre: o tick ignora quem não está mais pendente.
    await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${atrasadoId}`, headers: comPin(),
      body: { acao: 'concluir' } }));
    await store.reenfileirar(atrasadoId, 'atraso-d3', Date.now() - 1000);
    const marcaPush = push.recebidas.length;
    const r = await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(push.recebidas.length, marcaPush, 'notificou atraso de lembrete já concluído');
    assert.equal(r.corpo.relatorio[0].resultado, 'já concluído');

    } finally {
      await chamar(reminders, fingirRequisicao({
        method: 'DELETE', url: `/api/reminders?id=${atrasadoId}`, headers: comPin() }));
    }
  });

  await t.test('adiar mexe no aviso, nunca no prazo', async () => {
    const antes = await store.obter(id);
    const r = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(),
      body: { acao: 'adiar', minutos: 60 },
    }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.lembrete.prazo, antes.prazo, 'adiar mudou o prazo — não pode');
    const soneca = r.corpo.lembrete.avisos.find((a) => a.chave.startsWith('soneca-'));
    assert.ok(soneca);
    assert.ok(Math.abs(Date.parse(soneca.em) - (Date.now() + 3600000)) < 5000);
  });

  await t.test('aviso já enviado não volta para a fila ao reagendar', async () => {
    const lembrete = await store.obter(id);
    const enviado = lembrete.avisos.find((a) => a.enviadoEm);
    assert.ok(enviado);
    const fila = [...banco.espiar.avisos_fila.keys()];
    assert.ok(!fila.includes(`${id}#${enviado.chave}`), 'aviso já enviado voltou para a fila');
  });

  await t.test('sem aparelho inscrito, o aviso é reenfileirado em vez de sumir', async () => {
    for (const i of await store.listarInscricoes(USUARIO)) await store.descartarInscricao(i.id);
    const lembrete = await store.obter(id);
    const pendente = lembrete.avisos.find((a) => !a.enviadoEm);
    await store.reenfileirar(id, pendente.chave, Date.now() - 1000);

    const r = await chamar(tick, fingirRequisicao({ url: `/api/tick?chave=${SEGREDO_CRON}` }));
    assert.equal(r.corpo.relatorio[0].resultado, 'sem entrega, retentativa agendada');
    const naFila = banco.espiar.avisos_fila.get(`${id}#${pendente.chave}`);
    assert.ok(naFila, 'o aviso não entregue foi perdido');
    assert.ok(Date.parse(naFila.disparar_em) > Date.now(), 'retentativa não foi para o futuro');
  });

  await t.test('concluir tira dos pendentes, limpa a fila e guarda no histórico', async () => {
    const r = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(), body: { acao: 'concluir' },
    }));
    assert.equal(r.corpo.lembrete.status, 'feito');

    const lista = await chamar(reminders, fingirRequisicao({ url: '/api/reminders', headers: comPin() }));
    assert.equal(lista.corpo.pendentes.length, 0);
    assert.equal(lista.corpo.feitos.length, 1);
    assert.equal(lista.corpo.feitos[0].id, id);

    const fila = [...banco.espiar.avisos_fila.keys()];
    assert.equal(fila.filter((m) => m.startsWith(id + '#')).length, 0, 'sobrou aviso na fila de um lembrete concluído');
  });

  await t.test('editar o prazo remonta a escada e preserva as antecedências', async () => {
    await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(), body: { acao: 'reabrir' },
    }));
    const novoPrazo = new Date(Date.now() + 10 * 86400000).toISOString();
    const r = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(),
      body: { acao: 'editar', titulo: 'Relatório Pharma — revisado', prazo: novoPrazo },
    }));
    assert.equal(r.corpo.lembrete.titulo, 'Relatório Pharma — revisado');
    assert.equal(r.corpo.lembrete.prazo, novoPrazo);
    // As antecedências escolhidas na criação continuam valendo no prazo novo.
    assert.deepEqual(r.corpo.lembrete.antecedencias, ['d1', 'h1', 'm15']);
    assert.deepEqual(r.corpo.lembrete.avisos.map((a) => a.chave), ['d1', 'h1', 'm15', 'prazo']);
  });

  await t.test('trocar as antecedências remonta a escada sem mexer no prazo', async () => {
    const antes = await store.obter(id);
    const r = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(),
      body: { acao: 'editar', antecedencias: ['d2', 'm15', 'm5'] },
    }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.lembrete.prazo, antes.prazo, 'mudar o aviso mexeu no prazo');
    assert.deepEqual(r.corpo.lembrete.antecedencias, ['d2', 'm15', 'm5']);
    assert.deepEqual(r.corpo.lembrete.avisos.map((a) => a.chave), ['d2', 'm15', 'm5', 'prazo']);
  });

  await t.test('sem antecedência nenhuma, ainda avisa na hora do prazo', async () => {
    const r = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comPin(),
      body: { acao: 'editar', antecedencias: [] },
    }));
    assert.deepEqual(r.corpo.lembrete.avisos.map((a) => a.chave), ['prazo']);
  });

  await t.test('outra conta não enxerga nem alcança o lembrete', async () => {
    const lista = await chamar(reminders, fingirRequisicao({ url: '/api/reminders', headers: comOutra() }));
    assert.equal(lista.codigo, 200);
    assert.equal(lista.corpo.pendentes.length, 0, 'a outra conta viu lembrete alheio');
    assert.equal(lista.corpo.feitos.length, 0);

    // Pelo id direto também não: responde como se não existisse.
    const espiada = await chamar(reminders, fingirRequisicao({
      method: 'PATCH', url: `/api/reminders?id=${id}`, headers: comOutra(), body: { acao: 'concluir' },
    }));
    assert.equal(espiada.codigo, 404);

    const apagar = await chamar(reminders, fingirRequisicao({
      method: 'DELETE', url: `/api/reminders?id=${id}`, headers: comOutra(),
    }));
    assert.equal(apagar.codigo, 404);
    assert.ok(await store.obter(id), 'a outra conta conseguiu apagar');
  });

  await t.test('cada conta tem seus próprios aparelhos de push', async () => {
    // Um teste anterior descadastrou os aparelhos desta conta; recadastra para
    // que a comparação entre as duas seja feita com uma de cada lado.
    await chamar(subscribe, fingirRequisicao({
      method: 'POST', url: '/api/subscribe', headers: comPin(),
      body: { inscricao: inscricaoFalsa(urlPush), apelido: 'iPhone de teste' },
    }));
    await chamar(subscribe, fingirRequisicao({
      method: 'POST', url: '/api/subscribe', headers: comOutra(),
      body: { inscricao: inscricaoFalsa(urlPush), apelido: 'aparelho da outra' },
    }));
    assert.equal((await store.listarInscricoes(USUARIO)).length, 1);
    assert.equal((await store.listarInscricoes(OUTRA)).length, 1);
    assert.equal((await store.listarInscricoes()).length, 0, 'sem conta não pode devolver ninguém');
  });

  await t.test('apagar remove de vez', async () => {
    const r = await chamar(reminders, fingirRequisicao({
      method: 'DELETE', url: `/api/reminders?id=${id}`, headers: comPin(),
    }));
    assert.equal(r.codigo, 200);
    assert.equal(await store.obter(id), null);
  });
});
