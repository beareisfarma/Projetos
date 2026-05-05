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
│   └── webhook.js        # Endpoint principal (Vercel serverless)
├── src/
│   ├── whatsapp.js       # Integracao com WhatsApp Cloud API
│   ├── gemini.js         # Integracao com Google Gemini AI
│   ├── sessions.js       # Gerenciamento de sessoes por usuario
│   └── handlers/
│       └── message.js    # Logica principal de atendimento
├── .env.example
├── vercel.json
└── package.json
```

## Configuracao

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variaveis de ambiente
```bash
cp .env.example .env
# Preencha o .env com suas chaves
```

### 3. Rodar localmente
```bash
npm run dev
# Em outro terminal, use ngrok para expor o servidor:
ngrok http 3000
```

### 4. Deploy na Vercel
```bash
vercel --prod
```

## Variaveis de ambiente

| Variavel | Onde obter |
|---|---|
| `WHATSAPP_TOKEN` | Meta Developers → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Qualquer string secreta sua |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `HUMAN_PHONE` | Seu numero no formato 5511999999999 |
