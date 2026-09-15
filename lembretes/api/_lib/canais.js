// Despacho de avisos. A lista de canais é a costura de extensão do sistema: hoje
// só existe o push do PWA; acrescentar Telegram ou WhatsApp é acrescentar um
// objeto aqui com a mesma interface, sem tocar no resto do núcleo.
//
//   { nome, disponivel(): boolean, enviar({titulo, corpo, dados}): Promise }
import webpush from 'web-push';
import { listarInscricoes, descartarInscricao } from './store.js';

// Lido sob demanda: na Edge Function a configuração chega depois do import.
const assuntoVapid = () => process.env.VAPID_SUBJECT || 'mailto:beareisfarma@gmail.com';

function vapidPronto() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const canalPush = {
  nome: 'push',
  disponivel: vapidPronto,
  async enviar({ titulo, corpo, dados }) {
    webpush.setVapidDetails(assuntoVapid(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const inscricoes = await listarInscricoes();
    if (inscricoes.length === 0) return { enviados: 0, removidos: 0, motivo: 'nenhum aparelho inscrito' };

    const carga = JSON.stringify({ titulo, corpo, dados });
    let enviados = 0;
    const mortas = [];

    await Promise.all(inscricoes.map(async (registro) => {
      try {
        await webpush.sendNotification(registro.inscricao, carga, { TTL: 6 * 3600, urgency: 'high' });
        enviados++;
      } catch (erro) {
        // 404/410 = a inscrição morreu (app desinstalado, permissão revogada).
        // Qualquer outro código é falha temporária e a inscrição fica.
        if (erro?.statusCode === 404 || erro?.statusCode === 410) mortas.push(registro.id);
        else console.error('[push] falha', erro?.statusCode, erro?.body || erro?.message);
      }
    }));

    for (const id of mortas) await descartarInscricao(id);
    return { enviados, removidos: mortas.length };
  },
};

export const CANAIS = [canalPush];

export function canaisAtivos() {
  return CANAIS.filter((c) => c.disponivel());
}

/** Envia por todos os canais ativos. Um canal que falha não derruba os outros. */
export async function despachar(mensagem) {
  const ativos = canaisAtivos();
  if (ativos.length === 0) return [{ canal: 'nenhum', erro: 'nenhum canal configurado' }];

  return Promise.all(ativos.map(async (canal) => {
    try {
      return { canal: canal.nome, ...(await canal.enviar(mensagem)) };
    } catch (erro) {
      console.error(`[${canal.nome}] erro no despacho`, erro);
      return { canal: canal.nome, erro: erro.message };
    }
  }));
}
