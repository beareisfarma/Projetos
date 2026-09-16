// O perfil é onde a pessoa batiza o assistente e troca a senha. A troca de
// senha é o ponto mais delicado do app: errar aqui tranca a dona do lado de fora.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bancoFalso, fingirRequisicao, fingirResposta } from './apoio.mjs';

const USUARIO = 'beatriz';
const SENHA = 'senha-de-teste-1';
const OUTRA = 'pam';
const SENHA_OUTRA = 'senha-da-outra-1';

const chamar = async (handler, req) => {
  const res = fingirResposta();
  await handler(req, res);
  return res;
};
const cabecalhos = (usuario = USUARIO, senha = SENHA) =>
  ({ 'x-lembretes-usuario': usuario, 'x-lembretes-pin': senha });

test('perfil: nome do assistente e troca de senha', async (t) => {
  const banco = bancoFalso({ [USUARIO]: SENHA, [OUTRA]: SENHA_OUTRA });
  const urlBanco = await banco.subir();
  t.after(() => banco.parar());

  // Ambiente montado ANTES do import: store.js lê process.env ao carregar.
  process.env.SUPABASE_URL = urlBanco;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
  const perfil = (await import('../api/perfil.js')).default;

  await t.test('nasce sem nome, para o app poder se apresentar', async () => {
    const r = await chamar(perfil, fingirRequisicao({ url: '/api/perfil', headers: cabecalhos() }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.perfil.usuario, USUARIO);
    assert.equal(r.corpo.perfil.assistente, '');
  });

  await t.test('o nome fica guardado na conta, não no aparelho', async () => {
    const r = await chamar(perfil, fingirRequisicao({
      method: 'PATCH', url: '/api/perfil', headers: cabecalhos(), body: { assistente: '  Jarvis  ' },
    }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.perfil.assistente, 'Jarvis', 'não aparou os espaços');

    const lido = await chamar(perfil, fingirRequisicao({ url: '/api/perfil', headers: cabecalhos() }));
    assert.equal(lido.corpo.perfil.assistente, 'Jarvis', 'não persistiu — o app perguntaria de novo');
  });

  await t.test('o nome de uma conta não vaza para a outra', async () => {
    const r = await chamar(perfil, fingirRequisicao({
      url: '/api/perfil', headers: cabecalhos(OUTRA, SENHA_OUTRA) }));
    assert.equal(r.corpo.perfil.assistente, '');
  });

  await t.test('nome gigante é cortado em vez de estourar o cabeçalho', async () => {
    const r = await chamar(perfil, fingirRequisicao({
      method: 'PATCH', url: '/api/perfil', headers: cabecalhos(),
      body: { assistente: 'a'.repeat(200) },
    }));
    assert.equal(r.corpo.perfil.assistente.length, 24);
  });

  await t.test('senha atual errada não troca nada', async () => {
    const r = await chamar(perfil, fingirRequisicao({
      method: 'PATCH', url: '/api/perfil', headers: cabecalhos(),
      body: { senhaAtual: 'chute', senhaNova: 'outra-senha-boa' },
    }));
    assert.equal(r.codigo, 400);
    assert.match(r.corpo.erro, /atual/i);

    // e a senha de verdade continua valendo
    const ainda = await chamar(perfil, fingirRequisicao({ url: '/api/perfil', headers: cabecalhos() }));
    assert.equal(ainda.codigo, 200);
  });

  await t.test('senha curta é recusada', async () => {
    const r = await chamar(perfil, fingirRequisicao({
      method: 'PATCH', url: '/api/perfil', headers: cabecalhos(),
      body: { senhaAtual: SENHA, senhaNova: 'abc' },
    }));
    assert.equal(r.codigo, 400);
    assert.match(r.corpo.erro, /6 caracteres/);
  });

  await t.test('troca válida: a nova passa a valer e a antiga para de valer', async () => {
    const NOVA = 'senha-nova-boa';
    // Capturado agora, não fixado no texto: subtestes anteriores mexeram no nome.
    const antes = (await chamar(perfil, fingirRequisicao({
      url: '/api/perfil', headers: cabecalhos() }))).corpo.perfil.assistente;
    const r = await chamar(perfil, fingirRequisicao({
      method: 'PATCH', url: '/api/perfil', headers: cabecalhos(),
      body: { senhaAtual: SENHA, senhaNova: NOVA },
    }));
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.trocada, true);

    const antiga = await chamar(perfil, fingirRequisicao({ url: '/api/perfil', headers: cabecalhos() }));
    assert.equal(antiga.codigo, 401, 'a senha antiga ainda abre a conta');

    const nova = await chamar(perfil, fingirRequisicao({
      url: '/api/perfil', headers: cabecalhos(USUARIO, NOVA) }));
    assert.equal(nova.codigo, 200);
    assert.equal(nova.corpo.perfil.assistente, antes, 'trocar a senha mexeu no nome do assistente');

    // a outra conta não foi afetada
    const outra = await chamar(perfil, fingirRequisicao({
      url: '/api/perfil', headers: cabecalhos(OUTRA, SENHA_OUTRA) }));
    assert.equal(outra.codigo, 200);
  });

  await t.test('sem credencial não lê nem escreve perfil', async () => {
    const r = await chamar(perfil, fingirRequisicao({ url: '/api/perfil', headers: {} }));
    assert.equal(r.codigo, 401);
  });
});
