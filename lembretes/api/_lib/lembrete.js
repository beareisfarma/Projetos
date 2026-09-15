// Forma canônica de um lembrete e as transições que ele sofre.
import { montarAvisos } from './agenda.js';
import { novoId } from './store.js';

export function criarLembrete({ titulo, detalhes = '', prazo, origem = 'texto', confianca = 'alta', observacao = '', motor = 'manual', agora = new Date() }) {
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
    avisos: montarAvisos(Date.parse(prazoIso), agora.getTime()),
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
