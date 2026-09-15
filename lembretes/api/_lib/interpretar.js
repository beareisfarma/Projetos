// Transforma linguagem solta ("não posso perder o prazo do relatório da Pharma,
// sexta às 14h") num prazo estruturado, usando saída estruturada da Claude API —
// o schema abaixo é garantido pelo servidor, então não há JSON quebrado para tratar.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { FUSO, deLocalParaUTC, textoLocal } from './tempo.js';

export const HORA_PADRAO = 18; // "sexta" sem hora = até o fim do dia útil de sexta

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
- Nunca invente detalhes que não estejam no recado.`;

/**
 * @param {string} recado texto livre ou transcrição do áudio
 * @param {Date} agora instante de referência para resolver datas relativas
 * @param {Anthropic} [clienteInjetado] só para teste; em produção fica indefinido
 * @returns {{titulo, detalhes, prazo: Date, horaExplicita, confianca, observacao}}
 */
export async function interpretar(recado, agora = new Date(), clienteInjetado) {
  const texto = String(recado || '').trim();
  if (!texto) throw new Error('Recado vazio.');

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

  if (resposta.stop_reason === 'refusal') {
    throw new Error('A interpretação foi recusada pelo modelo.');
  }
  const extraido = resposta.parsed_output;
  if (!extraido) throw new Error('Não consegui interpretar o recado.');

  return {
    titulo: extraido.titulo.slice(0, 120),
    detalhes: extraido.detalhes || '',
    prazo: deLocalParaUTC(extraido.prazo_local),
    horaExplicita: extraido.hora_explicita,
    confianca: extraido.confianca,
    observacao: extraido.observacao || '',
  };
}
