// Orquestrador da interpretação do recado.
//
// Ordem de tentativa, sempre da mais barata para a mais cara:
//   1. interpretador-local.js — determinístico, instantâneo, R$ 0. Resolve a
//      grande maioria dos recados ("sexta às 14h", "dia 20", "amanhã de manhã").
//   2. Claude API — só quando o local não achou data NENHUMA, e só se houver
//      ANTHROPIC_API_KEY. É opcional: sem chave, o app segue 100% gratuito.
//   3. Sem as duas: devolve amanhã às 18h com confiança baixa, para ela ajustar
//      na tela de confirmação. Um recado nunca é recusado por falta de data.
//
// MODO_INTERPRETACAO controla isso: 'auto' (padrão), 'local' (nunca chama IA)
// ou 'ia' (sempre chama, quando há chave).
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { FUSO, deLocalParaUTC, textoLocal, DIA_MS } from './tempo.js';
import { interpretarLocal, HORA_PADRAO } from './interpretador-local.js';

export { HORA_PADRAO };

const modo = () => (process.env.MODO_INTERPRETACAO || 'auto').toLowerCase();
export const iaDisponivel = () => Boolean(process.env.ANTHROPIC_API_KEY) && modo() !== 'local';

const Extracao = z.object({
  titulo: z.string().describe('Título curto e acionável, em português, no imperativo. Até 60 caracteres.'),
  detalhes: z.string().describe('Contexto extra que apareceu na fala. String vazia se não houver.'),
  prazo_local: z.string().describe('Prazo no formato YYYY-MM-DDTHH:mm, no fuso do usuário.'),
  hora_explicita: z.boolean().describe('true se a pessoa disse uma hora; false se a hora foi assumida.'),
  confianca: z.enum(['alta', 'media', 'baixa']).describe('Confiança na data extraída.'),
  observacao: z.string().describe('Se a confiança não for alta, o que ficou ambíguo. String vazia se estiver claro.'),
});

const INSTRUCOES = `Você extrai prazos de recados que a pessoa manda para si mesma, em português do Brasil.

Regras:
- O título é curto, no imperativo, e descreve a ação ("Enviar relatório da Pharma"), não o recado ("lembrar de enviar...").
- Resolva datas relativas ("sexta", "amanhã", "daqui a duas semanas", "dia 20") contra a data atual informada.
- Quando a pessoa disser só o dia da semana sem "que vem", use a próxima ocorrência futura desse dia.
- Se nenhuma hora for dita, use ${String(HORA_PADRAO).padStart(2, '0')}:00 e marque hora_explicita como false.
- "de manhã" = 09:00, "de tarde" = 14:00, "de noite" = 20:00, "fim do dia" = 18:00.
- O prazo é sempre no futuro. Se a interpretação cair no passado, avance para a próxima ocorrência plausível e marque confianca como "baixa".
- Se o recado não tiver data nenhuma, use amanhã às ${String(HORA_PADRAO).padStart(2, '0')}:00, confianca "baixa" e explique em observacao.
- Na dúvida entre duas datas, escolha a MAIS CEDO: avisar antes incomoda, avisar tarde faz perder o prazo.
- Nunca invente detalhes que não estejam no recado.`;

async function interpretarComIA(texto, agora, clienteInjetado) {
  const cliente = clienteInjetado || new Anthropic();
  const resposta = await cliente.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: INSTRUCOES,
    messages: [{
      role: 'user',
      content: `Agora são ${textoLocal(agora)} (fuso ${FUSO}).\n\nRecado:\n${texto}`,
    }],
    output_config: {
      effort: 'low', // extração curta e bem especificada; não precisa de mais profundidade
      format: zodOutputFormat(Extracao),
    },
  });

  if (resposta.stop_reason === 'refusal') throw new Error('A interpretação foi recusada pelo modelo.');
  const extraido = resposta.parsed_output;
  if (!extraido) throw new Error('Não consegui interpretar o recado.');

  return {
    titulo: extraido.titulo.slice(0, 120),
    detalhes: extraido.detalhes || '',
    prazo: deLocalParaUTC(extraido.prazo_local),
    horaExplicita: extraido.hora_explicita,
    confianca: extraido.confianca,
    observacao: extraido.observacao || '',
    motor: 'ia',
  };
}

/** Último recurso: nunca recusar um recado só porque não achamos a data nele. */
function palpiteSeguro(texto, agora) {
  const amanha = new Date(agora.getTime() + DIA_MS);
  const [dia] = textoLocal(amanha).split('T');
  return {
    titulo: texto.replace(/\s+/g, ' ').trim().slice(0, 120),
    detalhes: '',
    prazo: deLocalParaUTC(`${dia}T${String(HORA_PADRAO).padStart(2, '0')}:00`),
    horaExplicita: false,
    confianca: 'baixa',
    observacao: 'Não identifiquei data no recado — deixei para amanhã. Ajuste o prazo.',
    motor: 'palpite',
  };
}

/**
 * @param {string} recado texto livre ou transcrição do áudio
 * @param {Date} agora instante de referência para resolver datas relativas
 * @param {Anthropic} [clienteInjetado] só para teste
 */
export async function interpretar(recado, agora = new Date(), clienteInjetado) {
  const texto = String(recado || '').trim();
  if (!texto) throw new Error('Recado vazio.');

  if (modo() !== 'ia') {
    const local = interpretarLocal(texto, agora);
    if (local) return local;
  }

  // O modo é autoritativo: em 'local' a IA não roda nem com cliente injetado.
  // Quem configura 'local' está pedindo custo zero garantido.
  if (modo() !== 'local' && (clienteInjetado || Boolean(process.env.ANTHROPIC_API_KEY))) {
    try {
      return await interpretarComIA(texto, agora, clienteInjetado);
    } catch (erro) {
      // A IA é um reforço, não uma dependência: se ela falhar (sem crédito, fora
      // do ar, recusa), o recado ainda vira lembrete em vez de sumir.
      console.error('[interpretar] IA falhou, caindo no palpite:', erro.message);
    }
  }

  return palpiteSeguro(texto, agora);
}
