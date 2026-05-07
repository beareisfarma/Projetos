const { sendText } = require('../whatsapp');
const { askGemini } = require('../gemini');
const { getSession, saveSession } = require('../sessions');

async function handleMessage(phone, text) {
  const session = getSession(phone);

  if (session.state === 'transferred') {
    session.state = 'idle';
  }

  session.history.push({ role: 'user', content: text });

  const aiResponse = await askGemini(session.history.slice(-10), text);

  if (aiResponse.includes('[TRANSFERIR_HUMANO]')) {
    const msg = aiResponse.replace('[TRANSFERIR_HUMANO]', '').trim();
    await sendText(phone, msg || 'Vou te conectar com a Beatriz agora!');
    await sendText(phone, `Fale diretamente com ela: wa.me/${process.env.HUMAN_PHONE}`);
    session.state = 'transferred';

  } else if (aiResponse.includes('[AGENDAR]')) {
    const msg = aiResponse.replace('[AGENDAR]', '').trim();
    await sendText(phone, msg || 'Otimo! Vamos agendar sua reuniao gratuita.');
    session.state = 'scheduling';

  } else if (aiResponse.includes('[LEAD:')) {
    const match = aiResponse.match(/\[LEAD:\s*(.+?)\]/);
    if (match) {
      const [nome, empresa, email] = match[1].split('|').map(s => s.trim());
      session.data.lead = { nome, empresa, email, phone };
      console.log('Novo lead capturado:', session.data.lead);
      // TODO: salvar no Google Sheets
    }
    const msg = aiResponse.replace(/\[LEAD:.*?\]/, '').trim();
    await sendText(phone, msg);

  } else {
    await sendText(phone, aiResponse);
  }

  session.history.push({ role: 'model', content: aiResponse });
  saveSession(phone, session);
}

module.exports = { handleMessage };
