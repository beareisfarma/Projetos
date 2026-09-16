// Perfil da conta: o nome que ela deu ao assistente, e a troca de senha.
//   GET   /api/perfil → { perfil: { usuario, assistente } }
//   PATCH /api/perfil → { assistente } ou { senhaAtual, senhaNova }
//
// Tudo escopado na conta autenticada: não existe "?usuario=" aqui, senão mexer
// no perfil alheio seria só um parâmetro.
import { json, erro, autenticarRequisicao, lerJson, comErros } from './_lib/http.js';
import { obterPerfil, definirAssistente, trocarSenha, armazenamentoConfigurado } from './_lib/store.js';

export default comErros(async (req, res) => {
  if (!armazenamentoConfigurado()) return erro(res, 503, 'Banco não configurado — veja o README.');
  const { usuario, negado } = await autenticarRequisicao(req);
  if (negado) return erro(res, negado.status, negado.mensagem);

  if (req.method === 'GET') return json(res, 200, { perfil: await obterPerfil(usuario) });

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return erro(res, 405, 'Método não permitido.');
  }

  const corpo = await lerJson(req);

  if (corpo.senhaNova !== undefined) {
    // A senha atual é pedida de novo mesmo com a sessão aberta: um celular
    // desbloqueado na mão de outra pessoa não deve virar troca de senha.
    const r = await trocarSenha(usuario, corpo.senhaAtual, corpo.senhaNova);
    if (!r.ok) {
      return erro(res, 400, r.motivo === 'curta'
        ? 'A senha nova precisa ter pelo menos 6 caracteres.'
        : 'Senha atual incorreta.');
    }
    return json(res, 200, { trocada: true });
  }

  if (corpo.assistente !== undefined) {
    const nome = String(corpo.assistente).trim().slice(0, 24);
    return json(res, 200, { perfil: await definirAssistente(usuario, nome) });
  }

  return erro(res, 400, 'Envie "assistente" ou "senhaAtual" + "senhaNova".');
});
