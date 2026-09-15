// CRUD dos lembretes.
//   GET    /api/reminders            → pendentes (+ feitos recentes)
//   POST   /api/reminders            → cria a partir de recado solto ou de campos já prontos
//   PATCH  /api/reminders?id=...     → concluir | adiar | reabrir | editar
//   DELETE /api/reminders?id=...     → apaga de vez
import { json, erro, autenticarRequisicao, lerJson, comErros } from './_lib/http.js';
import { criarLembrete } from './_lib/lembrete.js';
import { montarAvisos, comoFalta, faixa, normalizarAntecedencias } from './_lib/agenda.js';
import { interpretar } from './_lib/interpretar.js';
import {
  salvar, obter, reagendar, listarPendentes, listarFeitosRecentes,
  concluir, remover, armazenamentoConfigurado,
} from './_lib/store.js';

const enriquecer = (l, agora) => ({
  ...l,
  falta: comoFalta(Date.parse(l.prazo), agora),
  faixa: faixa(Date.parse(l.prazo), agora),
  proximoAviso: l.avisos.filter((a) => !a.enviadoEm && Date.parse(a.em) > agora)
    .sort((a, b) => Date.parse(a.em) - Date.parse(b.em))[0] || null,
});

async function listar(req, res, usuario) {
  const agora = Date.now();
  const [pendentes, feitos] = await Promise.all([
    listarPendentes(usuario), listarFeitosRecentes(usuario, 20)]);
  json(res, 200, {
    agora: new Date(agora).toISOString(),
    pendentes: pendentes.map((l) => enriquecer(l, agora)),
    feitos: feitos.map((l) => enriquecer(l, agora)),
  });
}

async function criar(req, res, usuario) {
  const corpo = await lerJson(req);
  const agora = new Date();
  let lembrete;
  // Ela disse dia E hora? Então a tela não precisa pedir confirmação nenhuma.
  // Estes dois campos só existem na resposta da criação; não são guardados.
  let explicito = { dataExplicita: true, horaExplicita: true };

  if (corpo.recado) {
    // Caminho normal: texto solto ou transcrição de áudio.
    const lido = await interpretar(corpo.recado, agora);
    explicito = { dataExplicita: Boolean(lido.dataExplicita), horaExplicita: Boolean(lido.horaExplicita) };
    // A observação que ela escreveu vence a que o interpretador deduziu.
    lembrete = criarLembrete({ ...lido,
      detalhes: corpo.detalhes !== undefined ? String(corpo.detalhes).slice(0, 500) : lido.detalhes,
      origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora });
  } else if (corpo.titulo && corpo.prazo) {
    // Caminho do formulário, quando ela corrige o que foi interpretado.
    const prazo = new Date(corpo.prazo);
    if (Number.isNaN(prazo.getTime())) return erro(res, 400, 'Prazo inválido.');
    lembrete = criarLembrete({
      titulo: String(corpo.titulo).slice(0, 120),
      detalhes: String(corpo.detalhes || '').slice(0, 500),
      prazo, origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora,
    });
  } else {
    return erro(res, 400, 'Envie "recado" (texto livre) ou "titulo" + "prazo".');
  }

  await salvar({ ...lembrete, usuario });
  json(res, 201, { lembrete: { ...enriquecer(lembrete, agora.getTime()), ...explicito },
                   recadoOriginal: corpo.recado || null });
}

async function alterar(req, res, id, usuario) {
  const corpo = await lerJson(req);
  // Escopado pela conta: o lembrete de outra pessoa responde como inexistente.
  const lembrete = await obter(id, usuario);
  if (!lembrete) return erro(res, 404, 'Lembrete não encontrado.');
  const agora = Date.now();

  switch (corpo.acao) {
    case 'concluir':
      return json(res, 200, { lembrete: enriquecer(await concluir(lembrete), agora) });

    case 'adiar': {
      // Adiar move o AVISO, nunca o prazo. O prazo é um fato do mundo;
      // adiar o prazo junto com o aviso é como o sistema começa a mentir.
      const minutos = Number(corpo.minutos);
      if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 60 * 24 * 30) {
        return erro(res, 400, 'Informe "minutos" entre 1 e 43200.');
      }
      const soneca = {
        chave: `soneca-${agora.toString(36)}`,
        em: new Date(agora + minutos * 60000).toISOString(),
        rotulo: 'Você pediu para lembrar de novo',
      };
      const atualizado = await reagendar(lembrete, [...lembrete.avisos, soneca]);
      return json(res, 200, { lembrete: enriquecer(atualizado, agora) });
    }

    case 'reabrir': {
      const reaberto = { ...lembrete, status: 'pendente', concluidoEm: undefined };
      const atualizado = await reagendar(reaberto,
        montarAvisos(Date.parse(reaberto.prazo), agora, reaberto.antecedencias));
      return json(res, 200, { lembrete: enriquecer(atualizado, agora) });
    }

    case 'editar': {
      const titulo = corpo.titulo !== undefined ? String(corpo.titulo).slice(0, 120) : lembrete.titulo;
      const detalhes = corpo.detalhes !== undefined ? String(corpo.detalhes).slice(0, 500) : lembrete.detalhes;
      if (!titulo.trim()) return erro(res, 400, 'O título não pode ficar vazio.');

      let prazo = lembrete.prazo;
      if (corpo.prazo) {
        const novo = new Date(corpo.prazo);
        if (Number.isNaN(novo.getTime())) return erro(res, 400, 'Prazo inválido.');
        prazo = novo.toISOString();
      }
      const antecedencias = corpo.antecedencias !== undefined
        ? normalizarAntecedencias(corpo.antecedencias) : lembrete.antecedencias;
      // Mudou prazo ou antecedência? A escada antiga deixou de fazer sentido.
      const mudou = corpo.prazo !== undefined || corpo.antecedencias !== undefined;
      const avisos = mudou ? montarAvisos(Date.parse(prazo), agora, antecedencias) : lembrete.avisos;
      const atualizado = await reagendar(
        { ...lembrete, titulo, detalhes, prazo, antecedencias, confianca: 'alta', observacao: '' }, avisos);
      return json(res, 200, { lembrete: enriquecer(atualizado, agora) });
    }

    default:
      return erro(res, 400, 'Ação desconhecida. Use concluir, adiar, reabrir ou editar.');
  }
}

export default comErros(async (req, res) => {
  if (!armazenamentoConfigurado()) return erro(res, 503, 'Banco não configurado — veja o README.');
  const { usuario, negado } = await autenticarRequisicao(req);
  if (negado) return erro(res, negado.status, negado.mensagem);

  const id = new URL(req.url, 'http://x').searchParams.get('id');

  if (req.method === 'GET') return listar(req, res, usuario);
  if (req.method === 'POST') return criar(req, res, usuario);
  if (req.method === 'PATCH') {
    if (!id) return erro(res, 400, 'Informe ?id=');
    return alterar(req, res, id, usuario);
  }
  if (req.method === 'DELETE') {
    if (!id) return erro(res, 400, 'Informe ?id=');
    const lembrete = await obter(id, usuario);
    if (!lembrete) return erro(res, 404, 'Lembrete não encontrado.');
    await remover(lembrete);
    return json(res, 200, { removido: id });
  }
  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return erro(res, 405, 'Método não permitido.');
});
