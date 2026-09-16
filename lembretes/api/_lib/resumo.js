// O resumo diário: uma notificação por dia com o estado geral, em vez de só
// avisos de lembretes individuais. É o "bom dia" do assistente.
//
// Mora aqui, fora do tick, porque a decisão de QUANDO enviar e O QUE dizer é
// pura — dá para testar sem banco, sem push e sem esperar dar 7h da manhã.
import { paraLocal } from './tempo.js';

/**
 * Quantas horas depois da hora marcada ainda vale mandar. Se o tick ficou
 * parado a manhã inteira, um "bom dia" às 22h é pior que nenhum — passada a
 * janela o dia é dado por perdido em vez de disparar fora de hora.
 */
export const JANELA_HORAS = 4;

/** Data local no formato YYYY-MM-DD: é a chave de "já mandei hoje". */
export function dataLocal(instante) {
  const p = paraLocal(instante);
  const z = (n, c = 2) => String(n).padStart(c, '0');
  return `${z(p.ano, 4)}-${z(p.mes)}-${z(p.dia)}`;
}

/** 'cedo' = ainda não deu a hora | 'agora' = manda | 'tarde' = passou da janela */
export function momentoDoResumo(resumoHora, instante) {
  if (resumoHora === null || resumoHora === undefined) return 'cedo';
  const { hora } = paraLocal(instante);
  if (hora < resumoHora) return 'cedo';
  if (hora < resumoHora + JANELA_HORAS) return 'agora';
  return 'tarde';
}

const saudacao = (hora) => (hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite');
const conta = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/**
 * O texto do resumo. `pendentes` já vem com a faixa calculada pela API.
 * @returns {{titulo, corpo, dados}}
 */
export function textoDoResumo(pendentes, instante, assistente = '') {
  const hoje = pendentes.filter((l) => l.faixa === 'hoje').length;
  const atrasadas = pendentes.filter((l) => l.faixa === 'atrasado').length;
  const { hora } = paraLocal(instante);

  const titulo = assistente ? `${saudacao(hora)}! — ${assistente}` : `${saudacao(hora)}!`;

  let corpo;
  if (hoje === 0 && atrasadas === 0) corpo = 'Nenhum prazo para hoje e nada em atraso. Dia limpo.';
  else if (atrasadas === 0) corpo = `Você tem ${conta(hoje, 'tarefa', 'tarefas')} para hoje.`;
  else if (hoje === 0) corpo = `Você tem ${conta(atrasadas, 'tarefa atrasada', 'tarefas atrasadas')}.`;
  else {
    corpo = `Você tem ${conta(hoje, 'tarefa', 'tarefas')} para hoje`
          + ` e ${conta(atrasadas, 'atrasada', 'atrasadas')}.`;
  }

  return { titulo, corpo, dados: { tipo: 'resumo', hoje, atrasadas } };
}
