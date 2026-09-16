# Personal Assistant

**No ar: https://assistentepessoal.vercel.app**

Assistente pessoal de prazos: você manda um recado por **texto ou áudio**, ele
interpreta a data, agenda uma **escada de avisos** e te **notifica no celular**
antes de perder o prazo. A lista de pendentes fica agrupada por urgência.

Roda no mesmo padrão visual dos outros apps (tema escuro + claro, neon `#d7ff1a`,
logo BCR no rodapé).

## Custo: R$ 0

O app inteiro roda em camada gratuita, sem cartão de crédito em lugar nenhum.

| Peça | Serviço | Custo |
|---|---|---|
| Hospedagem e API | Vercel Hobby | grátis |
| Banco | Supabase Postgres (free), em São Paulo | grátis |
| Relógio | cron-job.org | grátis |
| **Notificação** | **Web Push (VAPID), direto do navegador** | **grátis, sem intermediário** |
| Transcrição do áudio | Groq Whisper (free) — 2.000 transcrições/dia | grátis |
| Leitura da data | `interpretador-local.js`, determinístico | grátis |
| *(opcional)* leitura de recados sem data | Claude API | ~US$ 0,01 por recado |

A **única** peça que pode custar algo é a Claude API, e ela é opcional: só é
acionada quando o interpretador local não encontra data nenhuma no recado, e só
se `ANTHROPIC_API_KEY` estiver definida. Sem a chave, o app funciona inteiro — o
recado vira lembrete para amanhã às 18h e você ajusta o prazo na tela.

Para garantir custo zero absoluto, defina `MODO_INTERPRETACAO=local`: a IA nunca
é chamada, nem que a chave exista.

---

## Como funciona

```
  recado (texto ou áudio)
        │
        ├─ áudio → /api/transcribe ──→ Whisper (Groq ou OpenAI)
        │
        ▼
  /api/reminders (POST) ──→ interpretar.js ──→ interpretador-local.js (grátis)
        │                                        └─ sem data? → Claude API (opcional)
        ▼
  Postgres (Supabase): lembrete + fila de avisos indexada pela hora
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
- **O aviso sai da fila antes de ser disparado**, e essa retirada é atômica
  dentro do banco (`pegar_avisos_vencidos`, um `DELETE ... RETURNING` com
  `FOR UPDATE SKIP LOCKED`). Se o processo morrer no meio, o pior caso é um aviso
  perdido — e não o celular tocando em loop. Dois ticks sobrepostos nunca pegam
  o mesmo aviso.
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

### 1. Banco — Supabase (grátis, já provisionado)
O projeto `lembretes` já existe em `sa-east-1` (São Paulo), com as tabelas e a
função criadas. Você só precisa de duas coisas:

- **URL**: `https://oyyruucruevoefxzrzpj.supabase.co`
- **Chave secreta**: Supabase → Project Settings → API Keys → `service_role`
  (ou uma *secret key* nova). **Não** use a chave anônima: as tabelas têm RLS
  ligado sem nenhuma policy, então só a `service_role` acessa.

### 2. Chaves de push (VAPID)
```bash
cd lembretes
npm install
npm run gen:vapid
```
Guarde as três linhas que ele imprime.

### 3. *(Opcional)* Chave da Claude API
**Pule este passo se quiser custo zero garantido.**

Quem lê "sexta às 14h" é o `interpretador-local.js`, de graça. A Claude API só
entra quando o recado não tem data reconhecível — por exemplo *"alinhar aquilo
com o jurídico"*. Se você quiser essa rede extra:
[console.anthropic.com](https://console.anthropic.com/settings/keys) →
`ANTHROPIC_API_KEY` (~US$ 0,01 por recado que cair nela,
[preços](https://www.anthropic.com/pricing#api)).

Sem a chave, esses recados viram lembrete para amanhã às 18h com aviso para você
corrigir o prazo — nenhum recado é recusado.

### 4. Chave de transcrição (só se for usar áudio)
- **Groq** (recomendado): [console.groq.com/keys](https://console.groq.com/keys) → `GROQ_API_KEY`.
  O tier gratuito dá 2.000 transcrições por dia — você usaria umas 10.
- ou **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → `OPENAI_API_KEY` (pago por minuto)

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
| `SUPABASE_URL` | banco |
| `SUPABASE_SERVICE_ROLE_KEY` | banco (segredo) |
| `ANTHROPIC_API_KEY` *(opcional)* | só para recados sem data reconhecível |
| `MODO_INTERPRETACAO` *(opcional)* | `auto` (padrão), `local` (nunca chama IA) ou `ia` |
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
npm run build:demo # gera uma versão clicável do app, sem backend
```

Os testes sobem um PostgREST falso em memória e um serviço de push falso em HTTPS
(com certificado local confiado apenas no processo de teste — a verificação de
TLS continua ligada). O teste da Claude API usa um `fetch` controlado: verifica o
formato da requisição e a desserialização sem gastar chamada.

### A demonstração clicável
`npm run build:demo` gera um `demo.html` autossuficiente: é o `index.html` real
com o backend trocado por uma simulação no navegador que usa os módulos de
produção `tempo.js`, `agenda.js` e `interpretador-local.js` sem alteração. Serve
para ver e testar a interface — inclusive a qualidade da leitura de datas — sem
precisar de banco, chave ou deploy. Rode de novo depois de mexer na interface.

### Estrutura
```
api/
  _lib/
    tempo.js        conversão fuso local ↔ UTC (lê o offset do ICU)
    agenda.js       escada de avisos, faixas e texto relativo
    store.js        Postgres via REST (lembretes, fila de avisos, inscrições)
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

## Por que não OneSignal (ou qualquer serviço de push)

Avaliado e descartado, por três motivos:

1. **Não economiza nada.** Web Push com VAPID já é gratuito e sem intermediário.
   Não existe fatura para eliminar.
2. **Não resolve o iPhone.** A exigência de instalar na tela de início é da
   Apple, no nível da plataforma. A própria documentação do OneSignal diz que
   *push não funciona em abas do Safari*
   ([OneSignal](https://documentation.onesignal.com/docs/en/web-push-for-ios)).
   Nenhum fornecedor contorna isso.
3. **Custa liberdade.** O SDK web deles exige o service worker próprio, que
   colide com o nosso — é ele que faz os botões "Feito/Adiar" funcionarem com o
   app fechado. E o texto dos lembretes passaria a morar num terceiro.

O único ganho real seria o `send_after`, que agendaria a notificação no lado
deles e dispensaria o cron. Mas aí editar ou apagar um lembrete passa a exigir
cancelar a notificação agendada lá (rastrear IDs, mais estado, mais falhas), e a
retentativa de entrega deixa de ser nossa. Não compensa trocar 40 linhas de cron
gratuito por isso.

Created by Beatriz C Reis
