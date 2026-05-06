# Agente WhatsApp

Assistente virtual para atendimento empresarial via WhatsApp, powered by Google Gemini AI e WhatsApp Cloud API.

## Funcionalidades

- Atendimento automatico com IA (Gemini)
- Captura de leads (nome, empresa, e-mail)
- Agendamento de reunioes de diagnostico gratuito
- Transferencia para atendimento humano
- Historico de conversa por sessao (30 minutos)

## Estrutura

```
agente WhatsApp/
├── api/
│   └── webhook.js
├── src/
│   ├── whatsapp.js
│   ├── gemini.js
│   ├── sessions.js
│   └── handlers/
│       └── message.js
├── .env.example
├── vercel.json
└── package.json
```

## Variaveis de ambiente

| Variavel | Onde obter |
|---|---|
| `WHATSAPP_TOKEN` | Meta Developers → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Qualquer string secreta sua |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `HUMAN_PHONE` | Seu numero no formato 5511999999999 |
