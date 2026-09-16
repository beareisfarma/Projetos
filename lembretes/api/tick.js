// O relógio do sistema. Um serviço de cron externo bate aqui a cada minuto
// (o plano Hobby da Vercel só permite cron uma vez por dia, o que é inútil
// para lembretes — o README explica o arranjo).
//
// Ordem das operações: o aviso sai da fila ANTES de ser disparado. Se o processo
// morrer no meio, o pior caso é um lembrete perdido em vez de um aparelho
// recebendo a mesma notificação em loop. Essa retirada é atômica dentro do banco
// (função pegar_avisos_vencidos), então dois ticks sobrepostos nunca pegam o
// mesmo aviso. Entrega que não chega a ninguém é reenfileirada até 3 vezes —
// silêncio aqui é exatamente o que quebra a confiança no sistema.
import { json, erro, autorizadoCron, comErros } from './_lib/http.js';
import { textoDoAviso } from './_lib/lembrete.js';
import { avisoDeAtraso, faixa } from './_lib/agenda.js';
import { dataLocal, momentoDoResumo, textoDoResumo } from './_lib/resumo.js';
import { despachar, canaisAtivos } from './_lib/canais.js';
import {
  avisosVencidos, obter, gravarAvisos, reenfileirar, listarPendentes,
  contasComResumoPendente, marcarResumoEnviado, armazenamentoConfigurado,
} from './_lib/store.js';

const MAX_TENTATIVAS = 3;
const ESPERA_RETENTATIVA_MS = 5 * 60000;
const COBRANCA_ATRASO_MS = 2 * 3600000;

/**
 * O resumo diário de cada conta. Roda em TODO tick, inclusive nos que não têm
 * aviso vencido — foi por isso que o retorno antecipado daqui saiu.
 * A idempotência é da coluna `resumo_em` (data local do último resumo): o tick
 * bate a cada minuto e não pode mandar sessenta "bom dia".
 */
async function enviarResumos(agora) {
  const hoje = dataLocal(agora);
  const contas = await contasComResumoPendente(hoje);
  const feitos = [];

  for (const conta of contas) {
    const momento = momentoDoResumo(conta.resumo_hora, agora);
    if (momento === 'cedo') continue;
    if (momento === 'tarde') {
      // Tick parado a manhã inteira: dá o dia por perdido em vez de mandar um
      // "bom dia" às 22h. Marcar é o que impede a tentativa de voltar amanhã
      // com a data de hoje.
      await marcarResumoEnviado(conta.usuario, hoje);
      feitos.push({ usuario: conta.usuario, resultado: 'fora da janela' });
      continue;
    }

    const pendentes = (await listarPendentes(conta.usuario))
      .map((l) => ({ ...l, faixa: faixa(Date.parse(l.prazo), agora) }));
    const mensagem = textoDoResumo(pendentes, agora, conta.assistente || '');
    const resultados = await despachar(mensagem, conta.usuario);
    const entregues = resultados.reduce((total, r) => total + (r.enviados || 0), 0);

    // Só marca quando chegou em alguém. Sem aparelho inscrito às 7h, ela ainda
    // recebe o resumo se o celular voltar dentro da janela.
    if (entregues > 0) await marcarResumoEnviado(conta.usuario, hoje);
    feitos.push({ usuario: conta.usuario, resultado: entregues > 0 ? 'enviado' : 'sem entrega',
                  entregues, corpo: mensagem.corpo });
  }
  return feitos;
}


export default comErros(async (req, res) => {
  if (!autorizadoCron(req)) return erro(res, 401, 'Segredo do cron inválido.');
  if (!armazenamentoConfigurado()) return erro(res, 503, 'Banco não configurado.');

  const agora = Date.now();
  // O resumo diário vem primeiro e não depende de haver aviso vencido.
  const resumos = await enviarResumos(agora);
  const vencidos = await avisosVencidos(agora);
  if (vencidos.length === 0) {
    return json(res, 200, { agora: new Date(agora).toISOString(), disparados: 0,
      resumos, canais: canaisAtivos().map((c) => c.nome) });
  }

  const relatorio = [];
  for (const vencido of vencidos) {
    const lembrete = await obter(vencido.id);
    if (!lembrete) { relatorio.push({ id: vencido.id, resultado: 'lembrete inexistente' }); continue; }
    if (lembrete.status !== 'pendente') { relatorio.push({ id: vencido.id, resultado: 'já concluído' }); continue; }

    const aviso = lembrete.avisos.find((a) => a.chave === vencido.chave);
    if (!aviso) { relatorio.push({ id: vencido.id, resultado: 'aviso desconhecido' }); continue; }
    if (aviso.enviadoEm) { relatorio.push({ id: vencido.id, resultado: 'já enviado' }); continue; }

    const resultados = await despachar(textoDoAviso(lembrete, aviso), lembrete.usuario);
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

    // Enquanto o prazo estiver vencido e o lembrete pendente, sempre existe o
    // aviso do dia seguinte na fila. Cada disparo agenda o próximo, então a
    // corrente anda sozinha e para no dia em que ela conclui — o tick ignora
    // lembrete que não está mais pendente, e a linha da fila morre com ele.
    const aAgendar = [];

    // Cobrança do mesmo dia: uma vez, duas horas depois do prazo.
    if (aviso.chave === 'prazo' && entregues > 0) {
      aAgendar.push({ chave: 'atraso', em: new Date(agora + COBRANCA_ATRASO_MS).toISOString(),
        rotulo: 'Passou do prazo e ainda está pendente' });
    }

    // O aviso diário não depende de a entrega ter dado certo: se ela ficou sem
    // aparelho inscrito por uns dias, a corrente precisa estar viva quando
    // voltar. Agendar duas vezes a mesma chave é o que o `some` evita.
    // A referência é a hora MARCADA do aviso que acabou de sair, não o relógio.
    // Disparando adiantado (tick fora de hora, retentativa), o relógio ainda
    // apontaria para o mesmo dia e a corrente travaria repetindo a mesma chave.
    const referencia = Math.max(agora, Date.parse(aviso.em) || 0);
    const diario = avisoDeAtraso(Date.parse(lembrete.prazo), referencia);
    if (diario && !avisos.some((a) => a.chave === diario.chave)) aAgendar.push(diario);

    avisos.push(...aAgendar);
    await gravarAvisos(lembrete, avisos);
    for (const novo of aAgendar) await reenfileirar(lembrete.id, novo.chave, Date.parse(novo.em));

    relatorio.push({
      id: lembrete.id, chave: aviso.chave, titulo: lembrete.titulo,
      resultado: entregues > 0 ? 'entregue' : 'desistiu após 3 tentativas',
      entregues, detalhe: resultados,
    });
  }

  return json(res, 200, {
    agora: new Date(agora).toISOString(),
    disparados: relatorio.length,
    resumos,
    canais: canaisAtivos().map((c) => c.nome),
    relatorio,
  });
});
