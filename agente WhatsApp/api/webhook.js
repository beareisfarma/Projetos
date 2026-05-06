require('dotenv').config();
const express = require('express');
const { handleMessage } = require('../src/handlers/message');

const app = express();
app.use(express.json());

// Verificacao do webhook pelo Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recebe mensagens do WhatsApp
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (!messages?.length) return;

    const message = messages[0];
    if (message.type === 'text') {
      await handleMessage(message.from, message.text.body);
    }
  } catch (err) {
    console.error('Erro no webhook:', err.message);
  }
});

module.exports = app;
