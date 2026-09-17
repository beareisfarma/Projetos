/**
 * Cliente das funções opcionais de IA.
 *
 * Toda chamada daqui pode falhar sem consequência: quem chama sempre tem um
 * caminho local ou manual. É a mesma decisão do app de lembretes — a IA fica
 * fora do caminho crítico.
 */

const TEMPO_LIMITE = 60_000;

async function chamar(rota, corpo) {
  const aborto = new AbortController();
  const relogio = setTimeout(() => aborto.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(rota, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: aborto.signal,
    });

    // 404 = o app está servido como site estático, sem as funções. É esperado.
    if (r.status === 404) return { ok: false, motivo: 'sem-ia', mensagem: 'A leitura por IA não está disponível nesta instalação.' };

    const dados = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, motivo: dados.erro || 'falhou', mensagem: dados.mensagem || 'Não deu certo.' };
    return { ok: true, dados };
  } catch (e) {
    const abortou = e.name === 'AbortError';
    return {
      ok: false,
      motivo: abortou ? 'demorou' : 'rede',
      mensagem: abortou ? 'A leitura demorou demais.' : 'Sem conexão com o serviço de leitura.',
    };
  } finally {
    clearTimeout(relogio);
  }
}

export const ia = {
  interpretarR2D: (texto) => chamar('/api/interpretar', { texto }),
};
