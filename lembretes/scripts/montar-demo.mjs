// Monta uma versão clicável do app: o index.html REAL, com o backend trocado por
// uma simulação no próprio navegador que usa os módulos REAIS de interpretação
// de data e de escada de avisos. O que ela vê aqui é o que o app faz.
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url).pathname;
const saida = process.argv[2] || raiz + 'demo.html';

// Tira os import/export para os três módulos viverem num escopo só no navegador.
const paraNavegador = (arquivo) =>
  readFileSync(raiz + arquivo, 'utf8')
    .replace(/^import[\s\S]*?;$/gm, '')
    .replace(/^export (?=(function|const|async|class))/gm, '')
    .replace(/^export \{[^}]*\};$/gm, '');

const nucleo = [
  paraNavegador('api/_lib/tempo.js'),
  paraNavegador('api/_lib/agenda.js'),
  paraNavegador('api/_lib/interpretador-local.js'),
].join('\n');

const simulacao = `
<script>
// ─────────────────────────────────────────────────────────────────────────────
// DEMONSTRAÇÃO. O app abaixo é o arquivo real; só o backend foi trocado por uma
// simulação aqui no navegador. A leitura das datas e a escada de avisos usam os
// módulos de produção, sem alteração — o que você digitar é interpretado pelo
// mesmo código que rodaria no servidor.
// Os dados vivem só nesta aba e somem ao recarregar. Nada é salvo em lugar nenhum.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
const process = { env: {} };   // os módulos leem process.env; no navegador não existe

${nucleo}

  const banco = new Map();
  let assistente = '';
  let resumoHora = 7;
  let senhaDemo = 'Mike2026';
  const novoId = () => Math.random().toString(36).slice(2, 10);

  function montar(lido, origem, antecedencias, detalhes) {
    const prazoIso = lido.prazo.toISOString();
    const id = novoId();
    const l = {
      id, titulo: lido.titulo, detalhes: (detalhes || lido.detalhes || ''), prazo: prazoIso,
      status: 'pendente', origem, motor: lido.motor || 'local',
      confianca: lido.confianca, observacao: lido.observacao || '',
      criadoEm: new Date().toISOString(),
      antecedencias: normalizarAntecedencias(antecedencias),
      avisos: montarAvisos(Date.parse(prazoIso), Date.now(), antecedencias),
    };
    banco.set(id, l);
    return l;
  }

  function enriquecer(l) {
    const agora = Date.now();
    return {
      ...l,
      falta: comoFalta(Date.parse(l.prazo), agora),
      faixa: faixa(Date.parse(l.prazo), agora),
      proximoAviso: l.avisos.filter((a) => !a.enviadoEm && Date.parse(a.em) > agora)
        .sort((a, b) => Date.parse(a.em) - Date.parse(b.em))[0] || null,
    };
  }

  // Estado inicial realista: o app tem que abrir mostrando o que ele faz.
  // Horas redondas: lembrete de verdade cai às 9h, não às 9h42.
  const emDias = (dias, hora, minuto = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    d.setHours(hora, minuto, 0, 0);
    return d;
  };
  const semente = [
    ['Enviar o relatório da Pharma',     new Date(Math.min(emDias(0, 9).getTime(), Date.now() - 3 * 3600e3)), 'versão final para o comitê'],
    ['Pagar o boleto do contador',       emDias(0, 18),  ''],
    ['Responder a proposta da cliente',  emDias(1, 9),   'orçamento do Rep.Rota'],
    ['Renovar o certificado digital',    emDias(4, 17),  ''],
    ['Entregar a declaração do imposto', emDias(22, 18), ''],
  ];
  for (const [titulo, prazo, detalhes] of semente) {
    const id = novoId();
    banco.set(id, {
      id, titulo, detalhes, prazo: prazo.toISOString(), status: 'pendente',
      origem: 'texto', motor: 'local', confianca: 'alta', observacao: '',
      criadoEm: new Date().toISOString(), antecedencias: ['d1', 'h1'],
      avisos: montarAvisos(prazo.getTime(), Date.now(), ['d1', 'h1']),
    });
  }
  const feitoId = novoId();
  banco.set(feitoId, {
    id: feitoId, titulo: 'Assinar o contrato do Rep.Rota', detalhes: '',
    prazo: new Date(Date.now() - 26 * 3600e3).toISOString(), status: 'feito',
    origem: 'audio', motor: 'local', confianca: 'alta', observacao: '',
    concluidoEm: new Date(Date.now() - 25 * 3600e3).toISOString(),
    antecedencias: ['d1'], avisos: [],
  });

  const responder = (corpo, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

  const original = window.fetch.bind(window);
  window.fetch = async (recurso, opcoes = {}) => {
    const caminho = String(recurso);
    // A API real mora numa Edge Function do Supabase; aqui interceptamos por
    // esse prefixo e roteamos pelo trecho final.
    if (!caminho.includes('/functions/v1/api/')) return original(recurso, opcoes);

    await new Promise((r) => setTimeout(r, 160));  // latência, para parecer real
    const url = new URL('/api/' + caminho.split('/functions/v1/api/')[1], 'http://demo/');
    const id = url.searchParams.get('id');
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : {};
    const metodo = opcoes.method || 'GET';

    if (url.pathname === '/api/subscribe') {
      return responder(metodo === 'GET' ? { chavePublica: 'demo' } : { ok: true });
    }

    if (url.pathname === '/api/perfil') {
      if (metodo === 'GET') return responder({ perfil: { usuario: 'demo', assistente, resumoHora } });
      if (corpo.resumoHora !== undefined) {
        resumoHora = corpo.resumoHora === null || corpo.resumoHora === '' ? null : Number(corpo.resumoHora);
        return responder({ perfil: { usuario: 'demo', assistente, resumoHora } });
      }
      if (corpo.senhaNova !== undefined) {
        if (corpo.senhaAtual !== senhaDemo) return responder({ erro: 'Senha atual incorreta.' }, 400);
        if (String(corpo.senhaNova).length < 6) {
          return responder({ erro: 'A senha nova precisa ter pelo menos 6 caracteres.' }, 400);
        }
        senhaDemo = corpo.senhaNova;
        return responder({ trocada: true });
      }
      assistente = String(corpo.assistente || '').trim().slice(0, 24);
      return responder({ perfil: { usuario: 'demo', assistente, resumoHora } });
    }

    if (url.pathname === '/api/transcribe') {
      return responder({ texto: 'me lembra de mandar a nota fiscal sexta às 14h' });
    }

    if (url.pathname === '/api/reminders') {
      if (metodo === 'GET') {
        const todos = [...banco.values()];
        return responder({
          agora: new Date().toISOString(),
          pendentes: todos.filter((l) => l.status === 'pendente')
            .sort((a, b) => Date.parse(a.prazo) - Date.parse(b.prazo)).map(enriquecer),
          feitos: todos.filter((l) => l.status === 'feito').map(enriquecer),
        });
      }
      if (metodo === 'POST') {
        const lido = interpretarLocal(String(corpo.recado || ''), new Date()) || {
          titulo: String(corpo.recado).slice(0, 120), detalhes: '',
          prazo: new Date(Date.now() + 86400e3), confianca: 'baixa', motor: 'palpite',
          observacao: 'Não identifiquei data no recado — deixei para amanhã. Ajuste o prazo.',
        };
        const manual = corpo.prazo ? new Date(corpo.prazo) : null;
        if (manual) Object.assign(lido, { prazo: manual, confianca: 'alta', observacao: '' });
        return responder({ lembrete: {
          ...enriquecer(montar(lido, corpo.origem || 'texto', corpo.antecedencias, corpo.detalhes)),
          dataExplicita: manual ? true : Boolean(lido.dataExplicita),
          horaExplicita: manual ? true : Boolean(lido.horaExplicita),
        } }, 201);
      }
      const l = banco.get(id);
      if (!l) return responder({ erro: 'Lembrete não encontrado.' }, 404);

      if (metodo === 'DELETE') { banco.delete(id); return responder({ removido: id }); }

      if (corpo.acao === 'concluir') {
        Object.assign(l, { status: 'feito', concluidoEm: new Date().toISOString(), avisos: [] });
      } else if (corpo.acao === 'reabrir') {
        Object.assign(l, { status: 'pendente', concluidoEm: undefined,
          avisos: montarAvisos(Date.parse(l.prazo), Date.now()) });
      } else if (corpo.acao === 'adiar') {
        // Adiar mexe no aviso, nunca no prazo.
        l.avisos = [...l.avisos, {
          chave: 'soneca-' + Date.now().toString(36),
          em: new Date(Date.now() + corpo.minutos * 60000).toISOString(),
          rotulo: 'Você pediu para lembrar de novo',
        }];
      } else if (corpo.acao === 'editar') {
        if (corpo.titulo) l.titulo = corpo.titulo;
        if (corpo.detalhes !== undefined) l.detalhes = corpo.detalhes;
        if (corpo.prazo) l.prazo = new Date(corpo.prazo).toISOString();
        if (corpo.antecedencias !== undefined) l.antecedencias = normalizarAntecedencias(corpo.antecedencias);
        if (corpo.prazo !== undefined || corpo.antecedencias !== undefined) {
          l.avisos = montarAvisos(Date.parse(l.prazo), Date.now(), l.antecedencias);
        }
        l.confianca = 'alta'; l.observacao = '';
      }
      return responder({ lembrete: enriquecer(l) });
    }
    return responder({ erro: 'rota desconhecida na demonstração' }, 404);
  };

  try {
    localStorage.setItem('lembretes_usuario', 'demo');
    localStorage.setItem('lembretes_pin', 'demo');
  } catch (e) {}


  window.addEventListener('load', () => {
    // A demo não pede PIN. O localStorage pode estar indisponível conforme o
    // contexto, então entra pela própria tela em vez de confiar nele.
    const tela = document.getElementById('telaPin');
    if (tela && !tela.hidden) {
      document.getElementById('campoUsuario').value = 'demo';
      document.getElementById('campoPin').value = 'demo';
      document.getElementById('btnEntrar').click();
    }

    // O botão de notificação não tem servidor de push aqui. Em vez de estourar
    // um erro, explica. O banner é redesenhado, então observamos o contêiner.
    const banners = document.getElementById('avisos');
    const prender = () => {
      const b = document.getElementById('btnAtivarPush');
      if (b && !b.dataset.demo) {
        b.dataset.demo = '1';
        b.onclick = () => {
          banners.innerHTML = '<div class="banner"><div><strong>Isto só funciona no app publicado</strong>' +
            '<p>Aqui não existe servidor de push. No app no seu celular, este botão pede a ' +
            'permissão e os avisos passam a chegar mesmo com o app fechado — no iPhone, ' +
            'depois de instalar na tela de início.</p></div></div>';
        };
      }
    };
    prender();
    if (banners) new MutationObserver(prender).observe(banners, { childList: true, subtree: true });

    // O microfone não roda aqui; simula a transcrição para mostrar o fluxo do áudio.
    const botao = document.getElementById('btnGravar');
    if (botao) botao.onclick = () => {
      botao.textContent = '⏺ Gravando…';
      botao.classList.add('gravando');
      setTimeout(() => {
        botao.textContent = '🎤 Gravar';
        botao.classList.remove('gravando');
        document.getElementById('recado').value = 'me lembra de mandar a nota fiscal sexta às 14h';
        document.getElementById('btnAdicionar').click();
      }, 1400);
    };
  });
})();
</script>
`;

let html = readFileSync(raiz + 'index.html', 'utf8');
html = html.replace('<title>Lembretes</title>', '<title>Lembretes</title>');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '');
// a simulação precisa estar de pé antes do script do app fazer a primeira chamada
// Função de substituição, não texto: num texto, o JS interpreta $& e $` como
// referências ao trecho casado, e o núcleo contém a sequência )$` numa regex.
html = html.replace('<script>\n\'use strict\';', () => simulacao + '<script>\n\'use strict\';');

const faixaDemo = `
  <div style="background:#d7ff1a;color:#16233f;padding:.8rem 1rem;border-radius:.9rem;
              font-size:.84rem;line-height:1.5;font-weight:600;">
    Demonstração — dá para usar de verdade. O que você digitar é lido pelo mesmo
    código do app publicado. Os dados ficam só nesta aba e somem ao recarregar.
  </div>`;
html = html.replace('  <div id="avisos"></div>', () => faixaDemo + '\n  <div id="avisos"></div>');

writeFileSync(saida, html);
console.log('demo montada:', (html.length / 1024).toFixed(1) + 'KB');
