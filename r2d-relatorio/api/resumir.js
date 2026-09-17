/**
 * Resumo executivo, pendências e próximos passos — OPCIONAL.
 *
 * Recebe o que já está preenchido (plano lido do R2D, ações registradas,
 * indicadores) e devolve texto de fechamento. Sem chave configurada responde
 * 501 e a tela segue com os campos em branco para preenchimento manual.
 *
 * O prompt é fechado sobre o material enviado: nada de recomendação genérica
 * de consultoria. Se a pessoa registrou três ações, o resumo fala das três.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5';

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumo', 'entregas', 'pendencias', 'proximosPassos', 'atencao'],
  properties: {
    resumo: { type: 'string', description: '3 a 5 frases. O que foi executado no período e o que isso produziu.' },
    entregas: { type: 'array', items: { type: 'string' }, description: 'Principais entregas, até 6.' },
    pendencias: { type: 'array', items: { type: 'string' }, description: 'Itens do plano sem ação registrada, até 6.' },
    proximosPassos: { type: 'array', items: { type: 'string' }, description: 'Até 6, tirados dos "próximo passo" das ações.' },
    atencao: { type: 'array', items: { type: 'string' }, description: 'Pontos de atenção evidentes nos dados, até 4.' },
  },
};

const INSTRUCAO = `Você escreve o fechamento de um RELATÓRIO DE AÇÕES DO R2D, que um
representante da indústria farmacêutica apresenta ao gestor dele.

O R2D é o plano; o relatório mostra a execução. Você não altera o plano.

Regras:
- Fale SOMENTE do material recebido. Não sugira boas práticas genéricas de vendas,
  não recomende ação que ninguém citou, não estime número que não foi informado.
- "pendencias" são itens do plano sem nenhuma ação vinculada. Se todos têm ação, devolva lista vazia.
- "proximosPassos" saem dos campos "próximo passo" das ações registradas. Sem eles, lista vazia.
- "atencao" só quando algo nos dados sustenta: indicador que caiu, execução baixa,
  objetivo sem cobertura. Sem evidência, lista vazia.
- Português do Brasil, tom profissional e direto, sem adjetivo de propaganda
  ("excelente", "extraordinário"). Frases curtas.
- Nunca chame o documento de "novo R2D".`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'metodo', mensagem: 'Use POST.' });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return res.status(501).json({
      erro: 'sem-ia',
      mensagem: 'O resumo por IA não está configurado neste servidor. Escreva o fechamento à mão.',
    });
  }

  const material = req.body?.material;
  if (!material || !Array.isArray(material.acoes) || !material.acoes.length) {
    return res.status(400).json({
      erro: 'sem-acoes',
      mensagem: 'Registre pelo menos uma ação antes de gerar o resumo.',
    });
  }

  try {
    const cliente = new Anthropic({ apiKey: chave });

    const resposta = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      system: INSTRUCAO,
      messages: [{
        role: 'user',
        content: `Material do relatório, em JSON:\n\n<material>\n${JSON.stringify(material, null, 1)}\n</material>`,
      }],
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (resposta.stop_reason === 'refusal') {
      return res.status(422).json({ erro: 'recusado', mensagem: 'Não foi possível gerar o resumo. Escreva à mão.' });
    }

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco) throw new Error('resposta sem texto');

    return res.status(200).json({ fechamento: JSON.parse(bloco.text), modelo: MODELO });
  } catch (e) {
    console.error('Falha ao resumir', e);
    const status = e?.status === 429 ? 429 : 502;
    return res.status(status).json({
      erro: 'falhou',
      mensagem: status === 429
        ? 'O serviço está ocupado. Tente de novo em instantes.'
        : 'Não consegui gerar o resumo agora. Escreva o fechamento à mão.',
    });
  }
}
