// O relógio do sistema. Um serviço de cron externo bate aqui a cada minuto
// (o plano Hobby da Vercel só permite cron uma vez por dia, o que é inútil
// para lembretes — o README explica o arranjo).
//
// Ordem das operações: tira o aviso da fila ANTES de disparar. Se o processo
// morrer no meio, o pior caso é um lembrete perdido em vez de um aparelho
// recebendo a mesma notificação em loop. Entrega que não chega a ninguém é
// reenfileirada até 3 vezes — silêncio aqui é exatamente o que quebra a confiança
// no sistema.
import { json, erro, autorizadoCron, comErros } from './_lib/http.js';
import { textoDoAviso } from './_lib/lembrete.js';
import { despachar, canaisAtivos } from './_lib/canais.js';
import {
  avisosVencidos, tirarDaFila, obter, gravarAvisos, reenfileirar,
  armazenamentoConfigurado,
} from './_lib/store.js';

const MAX_TENTATIVAS = 3;
const ESPERA_RETENTATIVA_MS = 5 * 60000;
const COBRANCA_ATRASO_MS = 2 * 3600000;

export default comErros(async (req, res) => {
  if (!autorizadoCron(req)) return erro(res, 401, 'Segredo do cron inválido.');
  if (!armazenamentoConfigurado()) return erro(res, 503, 'Banco não configurado.');

  const agora = Date.now();
  const vencidos = await avisosVencidos(agora);
  if (vencidos.length === 0) {
    return json(res, 200, { agora: new Date(agora).toISOString(), disparados: 0, canais: canaisAtivos().map((c) => c.nome) });
  }

  // Sai da fila primeiro: evita que dois ticks sobrepostos notifiquem duas vezes.
  await tirarDaFila(vencidos.map((v) => v.membro));

  const relatorio = [];
  for (const vencido of vencidos) {
    const lembrete = await obter(vencido.id);
    if (!lembrete) { relatorio.push({ id: vencido.id, resultado: 'lembrete inexistente' }); continue; }
    if (lembrete.status !== 'pendente') { relatorio.push({ id: vencido.id, resultado: 'já concluído' }); continue; }

    const aviso = lembrete.avisos.find((a) => a.chave === vencido.chave);
    if (!aviso) { relatorio.push({ id: vencido.id, resultado: 'aviso desconhecido' }); continue; }
    if (aviso.enviadoEm) { relatorio.push({ id: vencido.id, resultado: 'já enviado' }); continue; }

    const resultados = await despachar(textoDoAviso(lembrete, aviso));
    const entregues = resultados.reduce((total, r) => total + (r.enviados || 0), 0);
    const tentativas = (aviso.tentativas || 0) + 1;

    if (entregues === 0 && tentativas < MAX_TENTATIVAS) {
      // Ninguém recebeu. Tenta de novo em 5 minutos em vez de engolir o lembrete.
      await gravarAvisos(lembrete, lembrete.avisos.map((a) =>
        a.chave === aviso.chave ? { ...a, tentativas } : a));
      await reenfileirar(lembrete.id, aviso.chave, agora + ESPERA_RETENTATIVA_MS);
      relatorio.push({ id: lembrete.id, chave: aviso.chave, resultado: 'sem entrega, retentativa agendada', tentativas });
      continue;
    }

    const avisos = lembrete.avisos.map((a) => a.chave === aviso.chave
      ? { ...a, tentativas, enviadoEm: new Date(agora).toISOString(), entregues }
      : a);

    // Prazo estourado e ainda pendente: cobra uma vez, duas horas depois.
    let cobranca = null;
    if (aviso.chave === 'prazo' && entregues > 0) {
      cobranca = {
        chave: 'atraso',
        em: new Date(agora + COBRANCA_ATRASO_MS).toISOString(),
        rotulo: 'Passou do prazo e ainda está pendente',
      };
      avisos.push(cobranca);
    }

    await gravarAvisos(lembrete, avisos);
    if (cobranca) await reenfileirar(lembrete.id, cobranca.chave, Date.parse(cobranca.em));

    relatorio.push({
      id: lembrete.id, chave: aviso.chave, titulo: lembrete.titulo,
      resultado: entregues > 0 ? 'entregue' : 'desistiu após 3 tentativas',
      entregues, detalhe: resultados,
    });
  }

  return json(res, 200, {
    agora: new Date(agora).toISOString(),
    disparados: relatorio.length,
    canais: canaisAtivos().map((c) => c.nome),
    relatorio,
  });
});
