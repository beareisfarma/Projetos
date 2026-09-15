// Forma canônica de um lembrete e as transições que ele sofre.
import { montarAvisos, normalizarAntecedencias, ANTECEDENCIAS_PADRAO } from './agenda.js';
import { novoId } from './store.js';

export function criarLembrete({ titulo, detalhes = '', prazo, origem = 'texto', confianca = 'alta', observacao = '', motor = 'manual', antecedencias = ANTECEDENCIAS_PADRAO, agora = new Date() }) {
  const escolhidas = normalizarAntecedencias(antecedencias);
  const prazoIso = (prazo instanceof Date ? prazo : new Date(prazo)).toISOString();
  return {
    id: novoId(),
    titulo,
    detalhes,
    prazo: prazoIso,
    status: 'pendente',
    origem,                 // 'texto' | 'audio'
    motor,                  // 'local' | 'ia' | 'palpite' | 'manual' — quem leu a data
    confianca,              // 'alta' | 'media' | 'baixa' — baixa pede conferência na tela
    observacao,
    criadoEm: agora.toISOString(),
    atualizadoEm: agora.toISOString(),
    antecedencias: escolhidas,   // quais avisos antes do prazo ela escolheu
    avisos: montarAvisos(Date.parse(prazoIso), agora.getTime(), escolhidas),
  };
}

/** Texto da notificação de um aviso. */
export function textoDoAviso(lembrete, aviso) {
  return {
    titulo: aviso.rotulo,
    corpo: lembrete.detalhes ? `${lembrete.titulo} — ${lembrete.detalhes}` : lembrete.titulo,
    dados: { id: lembrete.id, chave: aviso.chave, prazo: lembrete.prazo },
  };
}
