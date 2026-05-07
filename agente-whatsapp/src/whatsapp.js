const axios = require('axios');

const API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const headers = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
});

async function sendText(to, text) {
  await axios.post(API_URL, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  }, { headers: headers() });
}

async function sendButtons(to, bodyText, buttons) {
  await axios.post(API_URL, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((label, i) => ({
          type: 'reply',
          reply: { id: `btn_${i}`, title: label }
        }))
      }
    }
  }, { headers: headers() });
}

module.exports = { sendText, sendButtons };
