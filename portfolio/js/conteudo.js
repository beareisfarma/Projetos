/* =========================================================
   CONTEÚDO — português e inglês lado a lado.

   Este é o ÚNICO arquivo que precisa ser editado para mudar
   texto do site. As duas línguas ficam na mesma chave, uma
   embaixo da outra, de propósito: assim é impossível mexer
   numa e esquecer da outra.

   Chaves terminadas em ".html" podem conter marcação
   (<strong>, <em>, <br>). Todas as outras entram como texto
   puro. No index.html isso corresponde a data-i18n-html e
   data-i18n.
   ========================================================= */

/* ---------------------------------------------------------
   CONTATO — mude aqui, em um lugar só.
   Deixar em branco ('') esconde o canal do site inteiro,
   em vez de publicar um link quebrado.
   --------------------------------------------------------- */
const CONTATO = {
  email:    'beareisfarma@gmail.com',
  linkedin: '',                              // ex.: 'https://www.linkedin.com/in/…'
  github:   '',                              // ex.: 'https://github.com/…'
  whatsapp: 'https://wa.me/5521997235209',
};

/* Endereço público do site — usado no canonical, no Open Graph
   e nas tags hreflang. Mudou de domínio? Mude só aqui. */
const BASE_URL = 'https://beatrizreis.vercel.app';

const CONTEUDO = {

  /* =======================================================
     PORTUGUÊS
     ======================================================= */
  pt: {
    'meta.titulo':    'Beatriz C. Reis — Gestão de projetos, IA aplicada e desenvolvimento full-stack',
    'meta.descricao': 'Trabalho dentro da operação comercial da indústria farmacêutica e construo o software que ela precisa. Sete produtos entregues, três no ar. PWAs offline, Web Push, Supabase e arquitetura de custo zero.',

    'nav.trabalho': 'Trabalho',
    'nav.metodo':   'Método',
    'nav.perfil':   'Perfil',
    'nav.contato':  'Contato',
    'nav.pular':    'Pular para o conteúdo',
    'nav.idioma':   'Idioma',
    'nav.tema':     'Alternar tema claro e escuro',

    'hero.hoje':      'Hoje: operação comercial · indústria farmacêutica',
    'hero.nome':      'Beatriz C. Reis',
    'hero.papel1':    'Gestão de projetos',
    'hero.papel2':    'IA aplicada',
    'hero.papel3':    'Desenvolvimento full-stack',
    'hero.papel4':    'Indústria farmacêutica',
    'hero.lead1.html': 'Eu não estudo o problema de fora. <strong>Trabalho dentro da operação comercial da indústria farmacêutica</strong> — e construo o software que aquela operação precisa. Cada produto desta página nasceu de uma dor que eu mesma tinha que resolver no fim do expediente.',
    'hero.lead2.html': 'Sete produtos entregues, <strong>três deles no ar e abertos para você testar agora</strong>. Todos escritos à mão, todos rodando a custo zero, todos com o núcleo determinístico e a IA fora do caminho crítico — porque produto que só funciona quando a chave de API responde não é produto.',
    'hero.btn1':      'Ver o trabalho',
    'hero.btn2':      'Falar comigo',

    'trab.rotulo': '01 — Trabalho selecionado',
    'trab.titulo': 'Sete problemas. Sete sistemas.',
    'trab.lead':   'Cada entrada traz o problema, a decisão técnica que mais pesou e o que dá para conferir. Os links levam ao produto rodando — não a um vídeo de demonstração.',

    'selo.vivo':     'No ar',
    'selo.entregue': 'Entregue',
    'selo.nda':      'Sob NDA',
    'obra.decisoes': 'Decisões que importaram',
    'obra.abrir':    'Abrir o produto',

    'o1.nome': 'Personal Assistant',
    'o1.pilha': 'PWA|Web Push · VAPID|Supabase Postgres|Deno Edge Functions|pg_cron · pg_net|bcrypt · pgcrypto|Whisper',
    'o1.tese': 'Prazo que só existe na cabeça é prazo perdido.',
    'o1.desc': 'Assistente pessoal de prazos. Você manda um recado por texto ou por áudio — «consulta com a Ana sexta às 14h» — e o sistema lê a data, agenda a escada de avisos que você escolheu (2 dias, 1 dia, 1 hora, 15 minutos) e notifica na tela de bloqueio do celular, com o app fechado.',
    'o1.d1.html': '<strong>A IA não está no caminho crítico.</strong> Quem lê a data é um interpretador de português escrito à mão, determinístico e gratuito, que cobre «sexta às 14h», «dia 20», «amanhã de manhã» e «em duas semanas». A Claude API só entra quando o recado não tem data reconhecível, e uma variável de ambiente desliga a IA por completo. Sem chave nenhuma, o app funciona inteiro.',
    'o1.d2.html': '<strong>A retirada do aviso da fila é atômica no banco.</strong> <code>DELETE … RETURNING</code> com <code>FOR UPDATE SKIP LOCKED</code> — é isso que impede dois ticks de notificarem o mesmo prazo. Ler-e-depois-apagar seria mais simples e duplicaria notificação.',
    'o1.d3.html': '<strong>A API roda numa Edge Function do Supabase, não na Vercel.</strong> Lá dentro a chave de serviço já existe no ambiente, então o projeto sobe sem ninguém cadastrar variável nenhuma. O agendamento é o <code>pg_cron</code> do próprio Postgres — sem serviço externo e sem plano pago.',
    'o1.n1': 'testes automatizados',
    'o1.n2': 'custo mensal de infraestrutura',
    'o1.n3': 'intervalo do tick no pg_cron',

    /* 02 — R2D */
    'o2.nome': 'Relatório de Execução do R2D',
    'o2.pilha': 'PWA offline-first|pdf.js|IndexedDB|html2canvas|jsPDF|Gráficos em SVG|Service Worker',
    'o2.tese': 'O plano já foi aprovado. O que falta é provar a execução.',
    'o2.desc': 'Ferramenta de campo para a força de representantes da indústria farmacêutica. Lê o PDF do plano aprovado apenas como referência, registra as ações realizadas (data, ação, PDV ou médico, resultado, fotos) e os indicadores mês a mês, e fecha um relatório de três páginas em PDF para a gerência — números primeiro, depois objetivo e gap, depois as ações em ordem cronológica.',
    'o2.d1.html': '<strong>O extrator descarta de propósito a seção de indicadores do PDF.</strong> Ler market share de dentro do plano seria inventar um número que vai subir para a gerência. A ferramenta guarda, compara e desenha — não calcula, não estima e não completa indicador nenhum. Diferença entre dois valores digitados é comparação; o resto seria chute com cara de dado.',
    'o2.d2.html': '<strong>Nada de CDN.</strong> pdf.js, html2canvas, jsPDF e a fonte são vendorizados e guardados pelo service worker. O cenário real é corredor de farmácia e sala de espera de consultório: o app tem que abrir sem sinal, ou não serve para nada.',
    'o2.d3.html': '<strong>Sem cadastro, sem login, sem servidor.</strong> Tudo vive no IndexedDB do navegador. A contrapartida foi assumida de frente, não escondida: backup e restauração em JSON com as fotos embutidas, no topo da tela.',
    'o2.n1': 'testes automatizados',
    'o2.n2': 'páginas no relatório final',
    'o2.n3': 'para gerar um PDF de 0,82 MB',

    /* 03 — Marque Seu Jogo */
    'o3.nome': 'Marque Seu Jogo',
    'o3.pilha': 'PWA|Service Worker|Sem framework',
    'o3.tese': 'Quatro cronômetros diferentes num bolso só.',
    'o3.desc': 'Cronômetro e placar para quem joga. Quatro modos — cronômetro, timer, HIIT e Tabata — mais um placar de vôlei separado. Instalável na tela de início, funciona sem rede, e põe os números numa fonte inclinada que se lê da beira da quadra.',
    'o3.d1.html': '<strong>PWA de verdade, não site que finge ser app.</strong> Service worker próprio, instalação na tela de início e funcionamento integral sem rede — que é o estado normal da maioria dos ginásios.',
    'o3.n1': 'modos de contagem',
    'o3.n2': 'apps no mesmo endereço',

    /* 04 — Rep.Rota */
    'o4.nome': 'Rep.Rota',
    'o4.pilha': 'Web app|Multiusuário|Mapa|Agenda de ciclos',
    'o4.tese': 'O representante não perde venda por preguiça. Perde por roteiro ruim.',
    'o4.desc': 'Sistema de gestão de carteira para representantes comerciais, consultores de vendas e consultores médicos: clientes categorizados por potencial, roteiro de visitas, agenda de ciclos e mapa, num painel só, acessível de qualquer aparelho.',
    'o4.d1.html': '<strong>Construído a partir da rotina, não de um briefing.</strong> A categorização por potencial e a agenda de ciclos existem porque é assim que o trabalho se organiza na prática — não porque ficavam bem numa tela.',
    'o4.fig': 'Painel de carteira e tela de acesso.',

    /* 05 — Finances Control */
    'o5.nome': 'Finances Control',
    'o5.pilha': 'Dashboard|Multiusuário|Alertas',
    'o5.tese': 'Não falta disciplina. Falta enxergar para onde o dinheiro vai.',
    'o5.desc': 'Aplicativo de organização financeira com painel visual e diagnóstico por categoria: mostra em tempo real onde o dinheiro está indo, sinaliza gasto crítico, acompanha meta de poupança e exibe o orçamento do mês.',
    'o5.d1.html': '<strong>Diagnóstico, não extrato.</strong> Listar gasto qualquer planilha faz. O valor está em apontar a categoria que estourou e o quanto ainda falta para a meta — a leitura, não o dado.',
    'o5.fig': 'Painel com diagnóstico por categoria e meta de poupança.',

    /* 06 — Assistente no WhatsApp */
    'o6.nome': 'Assistente no WhatsApp',
    'o6.pilha': 'IA conversacional|WhatsApp|Agendamento',
    'o6.tese': '80% do atendimento é previsível. Nenhuma parte dele precisava de você.',
    'o6.desc': 'Assistente conversacional no WhatsApp que atende, tira dúvida, coleta informação e agenda consulta 24 horas por dia, sem intervenção humana. Chega até uma pessoa apenas o contato já qualificado.',
    'o6.d1.html': '<strong>Qualificar é o produto; responder é o efeito colateral.</strong> Um bot que só responde economiza digitação. Um bot que qualifica decide o que merece o tempo de uma pessoa — e é aí que o custo cai de verdade.',
    'o6.fig': 'Conversa real do assistente no WhatsApp.',

    /* 07 — NDA */
    'o7.nome': 'Ferramenta clínica · Pharma',
    'o7.pilha': 'Web|Decisão clínica|Confidencial',
    'o7.tese': 'A venda trava no segundo em que o profissional hesita.',
    'o7.desc': 'Solução web desenvolvida para uma grande empresa farmacêutica. Apoia o profissional de saúde na decisão clínica no momento exato da orientação ao paciente. Escopo, arquitetura e resultado disponíveis mediante assinatura de NDA.',
    'o7.d1.html': '<strong>O gargalo nunca foi informação — era o momento.</strong> O conteúdo já existia em bula e material técnico. O que faltava era ele chegar no segundo da decisão, sem exigir leitura. Por isso a ferramenta é uma entrada e uma resposta, não uma biblioteca.',

    'met.rotulo': '02 — Método',
    'met.titulo': 'Quatro regras que eu não quebro.',
    'met.lead':   'Não são preferências de estilo. Cada uma delas custou caro para ser aprendida em algum projeto desta página.',
    'met.p1.t': 'Custo zero é requisito, não detalhe.',
    'met.p1.d': 'O que eu construo roda em camada gratuita de ponta a ponta. Não por elegância: um projeto que precisa de fatura para continuar existindo morre no primeiro mês em que ninguém olhar para ele.',
    'met.p2.t': 'A IA fica fora do caminho crítico.',
    'met.p2.d': 'O núcleo é determinístico e testável. A IA entra como reforço, é opcional e pode ser desligada por variável de ambiente. Se a chave sumir, o produto continua inteiro.',
    'met.p3.t': 'Offline é o cenário, não a exceção.',
    'met.p3.d': 'Corredor de farmácia, sala de espera, beira de quadra. Se o app só funciona com sinal bom, ele não funciona onde vai ser usado.',
    'met.p4.t': 'Eu entrego o problema resolvido, não o pedido atendido.',
    'met.p4.d': 'O pedido é o sintoma que a pessoa conseguiu nomear. Meu trabalho é entender a operação fundo o suficiente para ver o que está atrás dele — e, às vezes, dizer que o que foi pedido não resolve.',

    'perf.rotulo': '03 — Perfil',
    'perf.titulo': 'Quem escreve o código e quem usa o produto são a mesma pessoa.',
    'perf.p1':     'Sou pós-graduada em Marketing e Comunicação e trabalho na indústria farmacêutica, na operação comercial de campo. Não sou uma desenvolvedora que aprendeu sobre pharma: sou alguém de dentro da operação que passou a construir o software dela. É por isso que a ferramenta de relatório sabe que foto de evidência precisa caber três por linha, e que o assistente de prazos entende «sexta às 14h» sem pedir calendário.',
    'perf.p2':     'Gerencio projeto e gerencio IA — as duas coisas no mesmo lugar, onde a maior parte das empresas ainda tem uma pessoa para cada. Escrevo o código, decido a arquitetura, meço o contraste da paleta e respondo pelo resultado.',
    'perf.c1': 'Pós-graduação · Marketing e Comunicação',
    'perf.c2': 'IA Manager',
    'perf.c3': 'Project Manager',
    'perf.c4': 'Indústria farmacêutica',
    'perf.c5': 'Desenvolvimento full-stack',
    'perf.foto': 'Retrato de Beatriz C. Reis',

    'cap.g1': 'Produto e operação',
    'cap.g1i': 'Descoberta a partir da rotina|Definição de escopo|Gestão de projeto|Gestão de IA aplicada|Operação comercial farmacêutica|Relação com PDV e prescritor',
    'cap.g2': 'Construção',
    'cap.g2i': 'HTML, CSS e JavaScript sem framework|PWA e service workers|Node e funções serverless|Postgres e PostgREST (Supabase)|Deno Edge Functions|Web Push com VAPID|Testes automatizados',
    'cap.g3': 'Decisões que eu assumo',
    'cap.g3i': 'Arquitetura de custo zero|Acessibilidade e contraste medido|Offline-first|Autenticação e limite de tentativa|Onde a IA entra e onde não entra|Identidade visual e tipografia',

    'cont.rotulo': '04 — Contato',
    'cont.titulo.html': 'Se alguma coisa aqui <em>resolve</em> um problema seu, me escreve.',
    'cont.lead':  'Respondo em português e em inglês. Para conversa de trabalho, o e-mail e o LinkedIn são o caminho mais direto.',
    'cont.email':    'E-mail',
    'cont.linkedin': 'LinkedIn',
    'cont.github':   'GitHub',
    'cont.whatsapp': 'WhatsApp',

    'rod.colofao': 'Feito à mão: HTML, CSS e JavaScript, sem framework e sem etapa de build. Duas fontes, nenhuma outra dependência externa. Paleta com contraste medido contra a WCAG AA. © 2026',
  },

  /* =======================================================
     ENGLISH
     ======================================================= */
  en: {
    'meta.titulo':    'Beatriz C. Reis — Project management, applied AI and full-stack development',
    'meta.descricao': 'I work inside commercial field operations in the pharmaceutical industry and build the software that operation needs. Seven products delivered, three live. Offline PWAs, Web Push, Supabase and zero-cost architecture.',

    'nav.trabalho': 'Work',
    'nav.metodo':   'Method',
    'nav.perfil':   'Profile',
    'nav.contato':  'Contact',
    'nav.pular':    'Skip to content',
    'nav.idioma':   'Language',
    'nav.tema':     'Switch between light and dark theme',

    'hero.hoje':      'Currently: commercial field operations · pharmaceutical industry',
    'hero.nome':      'Beatriz C. Reis',
    'hero.papel1':    'Project management',
    'hero.papel2':    'Applied AI',
    'hero.papel3':    'Full-stack development',
    'hero.papel4':    'Pharmaceutical industry',
    'hero.lead1.html': 'I don’t study the problem from the outside. <strong>I work inside commercial field operations in the pharmaceutical industry</strong> — and I build the software that operation needs. Every product on this page started as a problem I had to solve myself, after hours.',
    'hero.lead2.html': 'Seven products delivered, <strong>three of them live and open for you to try right now</strong>. All hand-written, all running at zero infrastructure cost, all with a deterministic core and AI kept off the critical path — because a product that only works when an API key answers isn’t a product.',
    'hero.btn1':      'See the work',
    'hero.btn2':      'Get in touch',

    'trab.rotulo': '01 — Selected work',
    'trab.titulo': 'Seven problems. Seven systems.',
    'trab.lead':   'Each entry gives the problem, the technical decision that mattered most, and what you can go and check. The links open the running product — not a demo video.',

    'selo.vivo':     'Live',
    'selo.entregue': 'Delivered',
    'selo.nda':      'Under NDA',
    'obra.decisoes': 'Decisions that mattered',
    'obra.abrir':    'Open the product',

    'o1.nome': 'Personal Assistant',
    'o1.pilha': 'PWA|Web Push · VAPID|Supabase Postgres|Deno Edge Functions|pg_cron · pg_net|bcrypt · pgcrypto|Whisper',
    'o1.tese': 'A deadline that lives only in your head is a deadline you will miss.',
    'o1.desc': 'A personal deadline assistant. You send a note by text or by voice — “appointment with Ana, Friday at 2pm” — and the system reads the date, schedules the reminder ladder you chose (2 days, 1 day, 1 hour, 15 minutes) and pushes to your phone’s lock screen with the app closed.',
    'o1.d1.html': '<strong>AI is off the critical path.</strong> Dates are read by a hand-written, deterministic Portuguese parser that costs nothing and covers “Friday at 2pm”, “the 20th”, “tomorrow morning” and “in two weeks”. The Claude API only steps in when a note carries no recognisable date, and one environment variable turns AI off entirely. With no API key at all, the app still works end to end.',
    'o1.d2.html': '<strong>Pulling a reminder off the queue is atomic in the database.</strong> <code>DELETE … RETURNING</code> with <code>FOR UPDATE SKIP LOCKED</code> — that is what stops two ticks from notifying the same deadline. Read-then-delete would have been simpler, and would have double-notified.',
    'o1.d3.html': '<strong>The API runs in a Supabase Edge Function, not on Vercel.</strong> Inside it the service key already exists in the environment, so the project deploys without anyone registering a single variable. Scheduling is Postgres’s own <code>pg_cron</code> — no external scheduler, no paid tier.',
    'o1.n1': 'automated tests',
    'o1.n2': 'monthly infrastructure cost',
    'o1.n3': 'pg_cron tick interval',

    /* 02 — R2D */
    'o2.nome': 'R2D Execution Report',
    'o2.pilha': 'PWA offline-first|pdf.js|IndexedDB|html2canvas|jsPDF|SVG charts|Service Worker',
    'o2.tese': 'The plan is already approved. What is missing is proof of execution.',
    'o2.desc': 'A field tool for pharmaceutical sales forces. It reads the approved plan PDF purely as reference, records the actions actually taken (date, action, point of sale or doctor, outcome, photos) and the month-by-month indicators, then closes a three-page PDF report for management — numbers first, then objective and gap, then the actions in chronological order.',
    'o2.d1.html': '<strong>The extractor deliberately discards the indicator section of the PDF.</strong> Reading market share out of the plan would mean inventing a number that travels up to management. The tool stores, compares and charts — it does not calculate, estimate or fill in any indicator. The difference between two values you typed is a comparison; anything beyond that would be a guess wearing the costume of data.',
    'o2.d2.html': '<strong>No CDN.</strong> pdf.js, html2canvas, jsPDF and the typeface are vendored and cached by the service worker. The real setting is a pharmacy aisle and a clinic waiting room: the app has to open with no signal, or it is good for nothing.',
    'o2.d3.html': '<strong>No sign-up, no login, no server.</strong> Everything lives in the browser’s IndexedDB. The trade-off was taken head-on rather than hidden: JSON backup and restore with the photos embedded, right at the top of the screen.',
    'o2.n1': 'automated tests',
    'o2.n2': 'pages in the final report',
    'o2.n3': 'to generate a 0.82 MB PDF',

    /* 03 — Marque Seu Jogo */
    'o3.nome': 'Marque Seu Jogo',
    'o3.pilha': 'PWA|Service Worker|No framework',
    'o3.tese': 'Four different timers in a single pocket.',
    'o3.desc': 'A stopwatch and scoreboard for people who actually play. Four modes — stopwatch, timer, HIIT and Tabata — plus a separate volleyball scoreboard. Installs to the home screen, runs with no network, and sets the numbers in a slanted face you can read from the sideline.',
    'o3.d1.html': '<strong>A real PWA, not a website pretending to be an app.</strong> Its own service worker, home-screen install and full function with no network — which is the normal state of most gyms.',
    'o3.n1': 'counting modes',
    'o3.n2': 'apps at the same address',

    /* 04 — Rep.Rota */
    'o4.nome': 'Rep.Rota',
    'o4.pilha': 'Web app|Multi-user|Map|Cycle calendar',
    'o4.tese': 'A field rep does not lose sales to laziness. They lose them to a bad route.',
    'o4.desc': 'A territory management system for sales reps, commercial consultants and medical liaisons: accounts ranked by potential, visit routing, cycle calendar and map, in a single dashboard, on any device.',
    'o4.d1.html': '<strong>Built from the routine, not from a brief.</strong> Potential-based ranking and the cycle calendar exist because that is how the work is actually organised — not because they looked good on a screen.',
    'o4.fig': 'Territory dashboard and sign-in screen.',

    /* 05 — Finances Control */
    'o5.nome': 'Finances Control',
    'o5.pilha': 'Dashboard|Multi-user|Alerts',
    'o5.tese': 'It is not a discipline problem. It is a visibility problem.',
    'o5.desc': 'A personal finance app with a visual dashboard and per-category diagnosis: it shows in real time where the money is going, flags critical spending, tracks a savings goal and lays out the month’s budget.',
    'o5.d1.html': '<strong>Diagnosis, not a bank statement.</strong> Any spreadsheet can list expenses. The value is in naming the category that blew up and how far the goal still is — the reading, not the data.',
    'o5.fig': 'Dashboard with per-category diagnosis and savings goal.',

    /* 06 — WhatsApp assistant */
    'o6.nome': 'WhatsApp Assistant',
    'o6.pilha': 'Conversational AI|WhatsApp|Scheduling',
    'o6.tese': '80% of your inbound is predictable. None of it needed you.',
    'o6.desc': 'A conversational assistant on WhatsApp that answers, resolves questions, collects information and books appointments around the clock, with no human in the loop. Only the already-qualified contact reaches a person.',
    'o6.d1.html': '<strong>Qualifying is the product; answering is the side effect.</strong> A bot that only answers saves typing. A bot that qualifies decides what deserves a person’s time — and that is where the cost actually drops.',
    'o6.fig': 'A real conversation with the WhatsApp assistant.',

    /* 07 — NDA */
    'o7.nome': 'Clinical tool · Pharma',
    'o7.pilha': 'Web|Clinical decision|Confidential',
    'o7.tese': 'The sale stalls the second the professional hesitates.',
    'o7.desc': 'A web tool built for a large pharmaceutical company. It supports the health professional’s clinical decision at the exact moment of advising the patient. Scope, architecture and outcome available under NDA.',
    'o7.d1.html': '<strong>The bottleneck was never information — it was timing.</strong> The content already existed in the leaflet and the technical material. What was missing was it arriving at the second of the decision, without demanding reading. That is why the tool is one input and one answer, not a library.',

    'met.rotulo': '02 — Method',
    'met.titulo': 'Four rules I do not break.',
    'met.lead':   'These are not style preferences. Each one was learned expensively, on a project listed on this page.',
    'met.p1.t': 'Zero cost is a requirement, not a detail.',
    'met.p1.d': 'What I build runs on free tiers end to end. Not out of elegance: a project that needs an invoice to keep existing dies the first month nobody looks at it.',
    'met.p2.t': 'AI stays off the critical path.',
    'met.p2.d': 'The core is deterministic and testable. AI comes in as reinforcement, stays optional, and can be switched off with an environment variable. If the key disappears, the product stays whole.',
    'met.p3.t': 'Offline is the setting, not the exception.',
    'met.p3.d': 'A pharmacy aisle, a waiting room, the side of a court. If an app only works on a good connection, it does not work where it is going to be used.',
    'met.p4.t': 'I deliver the problem solved, not the request fulfilled.',
    'met.p4.d': 'The request is the symptom someone managed to name. My job is to understand the operation deeply enough to see what sits behind it — and, sometimes, to say that what was asked for will not fix it.',

    'perf.rotulo': '03 — Profile',
    'perf.titulo': 'The person who writes the code and the person who uses the product are the same.',
    'perf.p1':     'I hold a postgraduate degree in Marketing and Communications and I work in the pharmaceutical industry, in commercial field operations. I am not a developer who learned about pharma: I am someone from inside the operation who started building its software. That is why the reporting tool knows an evidence photo has to fit three to a row, and why the deadline assistant understands “Friday at 2pm” without asking for a calendar.',
    'perf.p2':     'I manage projects and I manage AI — both in the same place, where most companies still have one person for each. I write the code, decide the architecture, measure the palette’s contrast and answer for the outcome.',
    'perf.c1': 'Postgraduate · Marketing & Communications',
    'perf.c2': 'AI Manager',
    'perf.c3': 'Project Manager',
    'perf.c4': 'Pharmaceutical industry',
    'perf.c5': 'Full-stack development',
    'perf.foto': 'Portrait of Beatriz C. Reis',

    'cap.g1': 'Product & operations',
    'cap.g1i': 'Discovery from the daily routine|Scope definition|Project management|Applied-AI management|Pharma commercial operations|Point-of-sale and prescriber relations',
    'cap.g2': 'Engineering',
    'cap.g2i': 'HTML, CSS and JavaScript with no framework|PWAs and service workers|Node and serverless functions|Postgres and PostgREST (Supabase)|Deno Edge Functions|Web Push with VAPID|Automated testing',
    'cap.g3': 'Decisions I own',
    'cap.g3i': 'Zero-cost architecture|Accessibility and measured contrast|Offline-first|Authentication and rate limiting|Where AI belongs and where it does not|Visual identity and typography',

    'cont.rotulo': '04 — Contact',
    'cont.titulo.html': 'If something here <em>solves</em> a problem of yours, write to me.',
    'cont.lead':  'I reply in Portuguese and in English. For work conversations, email and LinkedIn are the most direct route.',
    'cont.email':    'Email',
    'cont.linkedin': 'LinkedIn',
    'cont.github':   'GitHub',
    'cont.whatsapp': 'WhatsApp',

    'rod.colofao': 'Hand-written: HTML, CSS and JavaScript, no framework and no build step. Two typefaces, no other external dependency. Palette contrast measured against WCAG AA. © 2026',
  },
};
