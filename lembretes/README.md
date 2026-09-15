# Lembretes

Assistente pessoal de prazos: você manda um recado por **texto ou áudio**, ele
interpreta a data, agenda uma **escada de avisos** e te **notifica no celular**
antes de perder o prazo. A lista de pendentes fica agrupada por urgência.

Roda no mesmo padrão visual dos outros apps (tema escuro + claro, neon `#d7ff1a`,
logo BCR no rodapé).

---

## Como funciona

```
  recado (texto ou áudio)
        │
        ├─ áudio → /api/transcribe ──→ Whisper (Groq ou OpenAI)
        │
        ▼
  /api/reminders (POST) ──→ interpretar.js ──→ Claude API (saída estruturada)
        │                                        {título, prazo, confiança}
        ▼
  Redis (Upstash): lembrete + fila de avisos ordenada pela hora
        │
        ▼
  cron externo (a cada minuto) ──→ /api/tick ──→ canais.js ──→ Web Push ──→ 📱
```

### A escada de avisos
Um lembrete só sempre chega na hora errada. Cada prazo gera vários avisos, que
ficam mais frequentes conforme ele se aproxima:

| Quando | Aviso |
|---|---|
| 7 dias antes, 09h | Falta 1 semana |
| 3 dias antes, 09h | Faltam 3 dias |
| 1 dia antes, 09h | É amanhã |
| No dia, 08h | É hoje |
| 3 horas antes | Faltam 3 horas |
| 30 minutos antes | Faltam 30 minutos |
| Na hora do prazo | O prazo é agora |
| 2 horas depois, se ainda pendente | Passou do prazo |

Avisos no passado são descartados. Um prazo criado em cima da hora ainda recebe
pelo menos um aviso — **nenhum lembrete nasce mudo**.

### Decisões que importam
- **Adiar move o aviso, nunca o prazo.** O prazo é um fato do mundo. Um sistema
  que adia o prazo junto com o aviso começa a mentir para você.
- **Se a notificação não chega em ninguém, ela é reenfileirada** (até 3 tentativas,
  de 5 em 5 minutos). Falha silenciosa é o que destrói a confiança no sistema.
- **O aviso sai da fila antes de ser disparado.** Se o processo morrer no meio, o
  pior caso é um aviso perdido, e não o celular tocando em loop.
- **O núcleo é agnóstico de canal.** `api/_lib/canais.js` é uma lista de
  adaptadores `{nome, disponivel(), enviar()}`. Acrescentar Telegram ou WhatsApp
  é acrescentar um objeto ali — o resto do sistema não muda.

---

## Limitação que você precisa conhecer antes de confiar nisso

**No iPhone, notificação web só funciona com o app instalado na tela de início.**
Aba do Safari não tem acesso ao `PushManager` — e não existe prompt automático de
instalação, é manual: Compartilhar → Adicionar à Tela de Início.
([Apple / WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))

Também não existe agendamento local: a
[Notification Triggers API](https://developer.chrome.com/docs/web-platform/notification-triggers)
nunca saiu de origin trial. É por isso que este projeto tem servidor e cron em vez
de agendar tudo no próprio aparelho.

O app avisa em vermelho, na primeira tela, quando está numa aba do Safari em vez
de instalado — mas ele não pode se instalar sozinho.

---

## Setup (uma vez, ~20 minutos)

### 1. Banco — Upstash Redis (grátis)
1. Crie um banco em [console.upstash.com](https://console.upstash.com/) (região
   mais perto do Brasil, ex.: `us-east-1`).
2. Na aba **REST API**, copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

### 2. Chaves de push (VAPID)
```bash
cd lembretes
npm install
npm run gen:vapid
```
Guarde as três linhas que ele imprime.

### 3. Chave da Claude API
Em [console.anthropic.com](https://console.anthropic.com/settings/keys) → `ANTHROPIC_API_KEY`.
É o que interpreta "sexta às 14h". Custa centavos por mês nesse volume
([preços](https://www.anthropic.com/pricing#api)).

### 4. Chave de transcrição (só se for usar áudio)
- **Groq** (recomendado, mais barato e rápido): [console.groq.com/keys](https://console.groq.com/keys) → `GROQ_API_KEY`
- ou **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → `OPENAI_API_KEY`

Se nenhuma das duas estiver definida, o botão de gravar devolve um erro claro e a
captura por texto continua funcionando.

### 5. Projeto na Vercel
Este app é um **projeto separado** do `cronometro-gamer` (ele tem backend; o outro
é estático). Ao importar o repositório:
- **Root Directory**: `lembretes`
- **Framework Preset**: Other

Em **Settings → Environment Variables**, cadastre:

| Variável | Para quê |
|---|---|
| `UPSTASH_REDIS_REST_URL` | banco |
| `UPSTASH_REDIS_REST_TOKEN` | banco |
| `ANTHROPIC_API_KEY` | interpretar o recado |
| `VAPID_PUBLIC_KEY` | push |
| `VAPID_PRIVATE_KEY` | push (segredo) |
| `VAPID_SUBJECT` | `mailto:beareisfarma@gmail.com` |
| `APP_PIN` | sua senha de acesso — **escolha uma longa** |
| `CRON_SECRET` | segredo que só o cron conhece |
| `GROQ_API_KEY` *(ou `OPENAI_API_KEY`)* | transcrever áudio |
| `FUSO_HORARIO` *(opcional)* | padrão `America/Sao_Paulo` |

> `APP_PIN` e `CRON_SECRET`: gere com `openssl rand -base64 24`. A URL é pública;
> sem PIN configurado a API recusa tudo, e com PIN fraco qualquer um escreve no
> seu banco.

### 6. O cron — a peça que faz tudo funcionar
O plano Hobby da Vercel só permite cron **uma vez por dia**
([limites](https://vercel.com/docs/limits)), o que é inútil aqui. Use um cron
externo gratuito:

1. Crie conta em [cron-job.org](https://cron-job.org/) (grátis, de minuto em minuto).
2. Novo cronjob:
   - **URL**: `https://SEU-APP.vercel.app/api/tick`
   - **Schedule**: a cada 1 minuto
   - **Headers**: `Authorization: Bearer SEU_CRON_SECRET`
3. Salve e confira que a primeira execução devolve `200`.

> Não use `schedule` do GitHub Actions: o mínimo documentado é 5 minutos e as
> execuções atrasam ou são descartadas em horário de pico
> ([discussão](https://github.com/orgs/community/discussions/156282)).

### 7. Primeiro uso
1. Abra a URL no celular e digite o `APP_PIN`.
2. **iPhone**: Compartilhar → Adicionar à Tela de Início, e abra pelo ícone.
3. Toque em **Ativar notificações** e aceite.
4. Crie um lembrete para daqui a 2 minutos e confirme que a notificação chega.
   **Faça esse teste antes de confiar um prazo real ao sistema.**

---

## Desenvolvimento

```bash
npm install
npm test          # 28 testes: fuso, escada de avisos, fluxo completo, requisição da API
npm run gen:vapid # chaves de push
npm run gen:icons # regenera os ícones do PWA
```

Os testes sobem um Redis falso em memória e um serviço de push falso em HTTPS
(com certificado local confiado apenas no processo de teste — a verificação de
TLS continua ligada). O teste da Claude API usa um `fetch` controlado: verifica o
formato da requisição e a desserialização sem gastar chamada.

### Estrutura
```
api/
  _lib/
    tempo.js        conversão fuso local ↔ UTC (lê o offset do ICU)
    agenda.js       escada de avisos, faixas e texto relativo
    store.js        Redis via REST (lembretes, fila de avisos, inscrições)
    interpretar.js  Claude API, saída estruturada
    canais.js       despacho — a costura para Telegram/WhatsApp
    lembrete.js     forma canônica do lembrete
    http.js         JSON, autenticação por PIN e por segredo do cron
  reminders.js      GET / POST / PATCH / DELETE
  subscribe.js      chave VAPID e inscrição do aparelho
  transcribe.js     áudio → texto
  tick.js           o relógio: dispara os avisos vencidos
index.html          o PWA inteiro
sw.js               offline, recepção de push, ações da notificação
```

### Acrescentar um canal (Telegram, WhatsApp)
Em `api/_lib/canais.js`:
```js
const canalTelegram = {
  nome: 'telegram',
  disponivel: () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  async enviar({ titulo, corpo, dados }) {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `*${titulo}*\n${corpo}`,
        parse_mode: 'Markdown',
      }),
    });
    return { enviados: r.ok ? 1 : 0 };
  },
};
export const CANAIS = [canalPush, canalTelegram];
```
Nada mais no sistema precisa mudar. Os dois canais passam a disparar juntos, o que
também serve de rede de segurança se o push do iPhone falhar.

---

## Custo

| Item | Custo |
|---|---|
| Vercel Hobby | R$ 0 |
| Upstash Redis (free) | R$ 0 |
| cron-job.org | R$ 0 |
| Claude API (interpretação) | centavos/mês nesse volume |
| Groq Whisper (áudio) | centavos/mês |

Created by Beatriz C Reis
