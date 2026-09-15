// Inscrição do aparelho no push.
//   GET  /api/subscribe → chave pública VAPID (o navegador precisa dela para se inscrever)
//   POST /api/subscribe → guarda a inscrição deste aparelho
import { json, erro, autenticarRequisicao, lerJson, comErros } from './_lib/http.js';
import { guardarInscricao, armazenamentoConfigurado } from './_lib/store.js';

export default comErros(async (req, res) => {
  if (req.method === 'GET') {
    const chave = process.env.VAPID_PUBLIC_KEY;
    if (!chave) return erro(res, 503, 'VAPID_PUBLIC_KEY não configurada — veja o README.');
    return json(res, 200, { chavePublica: chave });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return erro(res, 405, 'Método não permitido.');
  }

  if (!armazenamentoConfigurado()) return erro(res, 503, 'Banco não configurado — veja o README.');
  const { usuario, negado } = await autenticarRequisicao(req);
  if (negado) return erro(res, negado.status, negado.mensagem);

  const { inscricao, apelido } = await lerJson(req);
  if (!inscricao?.endpoint || !inscricao?.keys?.p256dh || !inscricao?.keys?.auth) {
    return erro(res, 400, 'Inscrição de push incompleta.');
  }
  await guardarInscricao(usuario, inscricao, String(apelido || '').slice(0, 60));
  return json(res, 201, { ok: true });
});
