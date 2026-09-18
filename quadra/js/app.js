/**
 * Amarra tudo: carrega o estado, desenha a tela pedida e troca de aba.
 * Cada tela é um módulo com `render(alvo, params)` e redesenha o miolo inteiro —
 * a quantidade de dados aqui é pequena e redesenhar tudo elimina a classe de bug
 * em que a lista e o total discordam.
 */
import { carregar, estado } from './estado.js';
import { pedirPersistencia } from './db.js';
import { $, ligarFolha, fecharFolha, recado } from './ui.js';
import { configurarRota } from './rota.js';

import * as painel from './telas/painel.js';
import * as atletas from './telas/atletas.js';
import * as dinheiro from './telas/dinheiro.js';
import * as times from './telas/times.js';
import * as jogos from './telas/jogos.js';
import * as treinos from './telas/treinos.js';
import * as ajustes from './telas/ajustes.js';

const TELAS = { painel, atletas, dinheiro, times, jogos, treinos, ajustes };

let telaAtual = 'painel';
let paramsAtuais = {};

function desenhar() {
  const alvo = $('#tela');
  alvo.scrollTop = 0;
  TELAS[telaAtual].render(alvo, paramsAtuais);

  document.querySelectorAll('.abas button').forEach((b) =>
    b.setAttribute('aria-current', String(b.dataset.tela === telaAtual)));
  // O cabeçalho é a marca; o nome da escolinha fica no subtítulo. Repetir o
  // mesmo nome duas vezes na mesma dobra só rouba espaço da tela do celular.
  const sub = $('#titulo-sub');
  sub.textContent = estado.escola.nome || 'gestão da escolinha';
}

function ir(tela, params = {}) {
  if (!TELAS[tela]) return;
  fecharFolha();
  telaAtual = tela;
  paramsAtuais = params;
  window.scrollTo({ top: 0 });
  desenhar();
}

// ─── Tema ────────────────────────────────────────────────────────────────────
// Guardado por aparelho, não por escolinha: é preferência de quem olha a tela.
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('#tema').textContent = tema === 'escuro' ? '☀︎' : '☽︎';
  $('#tema').setAttribute('aria-label', tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro');
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'escuro' ? '#1a1d23' : '#ffffff');
  try { localStorage.setItem('quadra:tema', tema); } catch { /* aba privada */ }
}

function temaGuardado() {
  try {
    const guardado = localStorage.getItem('quadra:tema');
    if (guardado) return guardado;
  } catch { /* aba privada */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

// ─── Início ──────────────────────────────────────────────────────────────────
async function iniciar() {
  aplicarTema(temaGuardado());
  ligarFolha();
  configurarRota(ir, desenhar);

  $('#tema').addEventListener('click', () =>
    aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'));
  $('#ajustes').addEventListener('click', () => ir('ajustes'));

  document.querySelectorAll('.abas button').forEach((b) =>
    b.addEventListener('click', () => ir(b.dataset.tela)));

  try {
    await carregar();
  } catch (erro) {
    console.error('[quadra] não consegui ler o banco local', erro);
    recado('Não consegui abrir os dados salvos neste navegador.');
  }

  pedirPersistencia();
  desenhar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* http:// puro não registra */ });
  }
}

iniciar();
