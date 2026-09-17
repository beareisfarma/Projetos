/**
 * Leitura do R2D com IA — OPCIONAL.
 *
 * O app funciona inteiro sem esta função: o extrator.js lê o PDF localmente,
 * de graça e sem internet. Isto aqui é um reforço para R2D com formatação
 * irregular, e só roda quando a pessoa pede.
 *
 * Sem ANTHROPIC_API_KEY no ambiente, responde 501 e a tela segue com a
 * leitura local. Não derruba nada.
 *
 * Regra que vale para o produto inteiro: a IA NÃO INVENTA. O prompt manda
 * devolver vazio para o que não estiver no documento, e a tela marca esses
 * campos para preenchimento manual. Um objetivo inventado num relatório que
 * vai para o gestor é pior que um campo em branco.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5';
const LIMITE_TEXTO = 60_000;   // ~15k tokens; R2D é um plano de ciclo, não um livro

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['produto', 'periodoRotulo', 'periodoInicio', 'periodoFim',
    'objetivo', 'gap', 'acoesPrevistas'],
  properties: {
    produto: { type: 'string', description: 'Nome do produto/marca. "" se não constar.' },
    periodoRotulo: { type: 'string', description: 'Ex.: "Ciclo 7 · Setembro de 2026". "" se não constar.' },
    periodoInicio: { type: 'string', description: 'AAAA-MM-DD, ou "" se não der para determinar.' },
    periodoFim: { type: 'string', description: 'AAAA-MM-DD, ou "" se não der para determinar.' },
    objetivo: { type: 'string', description: 'O que o plano queria alcançar, em até 3 frases. "" se não constar.' },
    gap: { type: 'string', description: 'O gap, desafio ou causa raiz que o plano atacava, em até 3 frases. "" se não constar.' },
    acoesPrevistas: {
      type: 'array', items: { type: 'string' },
      description: 'As ações que o plano previa, uma frase curta cada. Lista vazia se não constar.',
    },
  },
};

const INSTRUCAO = `Você lê um R2D (plano de ação de ciclo) da indústria farmacêutica e
extrai TRÊS coisas: o objetivo do plano, o gap identificado e as ações previstas.

O R2D já foi elaborado e aprovado. Você não o reescreve, não o melhora, não o
completa e não o estrutura: apenas transcreve o que está lá, para servir de
contexto num relatório de execução.

Regras:
- Use as palavras do documento. Pode encurtar e limpar a formatação; não pode reinterpretar.
- Campo cuja informação não está no documento volta como "" ou lista vazia. Nunca deduza,
  nunca preencha por plausibilidade, nunca some informação que "costuma" estar num R2D.
- Cada ação prevista é uma frase curta e independente, sem marcador no início. No máximo 8.
- Datas em AAAA-MM-DD. Se o documento só disser o mês, use o primeiro e o último dia dele.
- Não invente números de indicador (market share, índice de evolução): eles não são pedidos aqui.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'metodo', mensagem: 'Use POST.' });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return res.status(501).json({
      erro: 'sem-ia',
      mensagem: 'A leitura por IA não está configurada neste servidor. A leitura local continua funcionando.',
    });
  }

  const texto = String(req.body?.texto || '').slice(0, LIMITE_TEXTO);
  if (texto.trim().length < 40) {
    return res.status(400).json({
      erro: 'texto-curto',
      mensagem: 'Não consegui ler texto suficiente nesse PDF. Se ele for digitalizado (imagem), preencha à mão.',
    });
  }

  try {
    const cliente = new Anthropic({ apiKey: chave });

    const resposta = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      system: INSTRUCAO,
      messages: [{ role: 'user', content: `Texto extraído do R2D:\n\n<r2d>\n${texto}\n</r2d>` }],
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      // Se um classificador recusar, o servidor atende num modelo alternativo
      // em vez de devolver erro — a leitura do plano não pode travar o app.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (resposta.stop_reason === 'refusal') {
      return res.status(422).json({
        erro: 'recusado',
        mensagem: 'A leitura automática não pôde ser concluída. Preencha os campos à mão.',
      });
    }

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco) throw new Error('resposta sem texto');

    return res.status(200).json({ plano: JSON.parse(bloco.text), modelo: MODELO });
  } catch (e) {
    console.error('Falha na leitura por IA', e);
    const status = e?.status === 429 ? 429 : 502;
    return res.status(status).json({
      erro: 'falhou',
      mensagem: status === 429
        ? 'O serviço de leitura está ocupado. Tente de novo em instantes ou preencha à mão.'
        : 'Não consegui interpretar o PDF com IA. A leitura local continua valendo.',
    });
  }
}
