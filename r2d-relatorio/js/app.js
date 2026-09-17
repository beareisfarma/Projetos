/**
 * Casca do app: carrega o projeto guardado, monta a navegação por etapas e
 * troca de tela. Sem cadastro e sem login, por decisão de produto — a pessoa
 * abre e usa.
 *
 * A contrapartida honesta disso: os dados moram SÓ neste navegador. Por isso
 * existe o backup em arquivo no topo — é o único jeito de levar um relatório
 * em andamento para outro aparelho.
 */

import { estado, carregar, gravarAgora, recomecar, mudou, projetoVazio } from './estado.js';
import { $, $$, esc, recado, confirmar, baixar, nomeLimpo } from './ui.js';
import { marcaInstitucional } from './marca.js';
import { db } from './db.js';

import * as telaInicio from './telas/inicio.js';
import * as telaPlano from './telas/plano.js';
import * as telaAcoes from './telas/acoes.js';
import * as telaIndicadores from './telas/indicadores.js';
import * as telaFechamento from './telas/fechamento.js';
import * as telaPrevia from './telas/previa.js';

const ETAPAS = [
  { id: 'inicio', rotulo: 'Dados e R2D', modulo: telaInicio },
  { id: 'plano', rotulo: 'Plano do R2D', modulo: telaPlano },
  { id: 'acoes', rotulo: 'Ações realizadas', modulo: telaAcoes },
  { id: 'indicadores', rotulo: 'Indicadores', modulo: telaIndicadores },
  { id: 'fechamento', rotulo: 'Resultados', modulo: telaFechamento },
  { id: 'previa', rotulo: 'Relatório', modulo: telaPrevia },
];

let atual = null;

export function irPara(id) {
  const etapa = ETAPAS.find((e) => e.id === id);
  if (!etapa) return;

  if (atual && atual !== id) {
    ETAPAS.find((e) => e.id === atual)?.modulo.sair?.();
  }
  atual = id;

  // Esvazia TODAS as telas, não só a que entra. Elas convivem no mesmo
  // documento, então uma tela inativa com conteúdo faz `#listas` ou
  // `#b-seguir` casarem com a etapa errada em document.querySelector.
  $$('.tela').forEach((t) => {
    t.dataset.ativa = t.dataset.tela === id ? 'sim' : 'nao';
    t.innerHTML = '';
  });
  etapa.modulo.desenhar($(`.tela[data-tela="${id}"]`));

  desenharEtapas();
  window.scrollTo({ top: 0, behavior: 'instant' });
  history.replaceState(null, '', `#${id}`);
}

function completa(id) {
  const p = estado.projeto;
  switch (id) {
    case 'inicio': return Boolean(p.representante && p.produto);
    case 'plano': return p.plano.objetivos.length > 0 || p.plano.estrategias.length > 0;
    case 'acoes': return p.acoes.length > 0;
    case 'indicadores': return p.indicadores.length > 0;
    case 'fechamento': return Boolean(p.fechamento.resumo) || p.fechamento.proximosPassos.length > 0;
    default: return false;
  }
}

function desenharEtapas() {
  const lista = $('#etapas');
  lista.innerHTML = ETAPAS.map((e, i) => `
    <li><button class="etapas__btn" type="button" data-ir="${e.id}"
        aria-current="${atual === e.id}" data-completa="${completa(e.id) ? 'sim' : 'nao'}">
      <span class="etapas__n">${completa(e.id) && atual !== e.id ? '✓' : i + 1}</span>${esc(e.rotulo)}
    </button></li>`).join('');
  $$('[data-ir]', lista).forEach((b) => b.addEventListener('click', () => irPara(b.dataset.ir)));
  // no celular a régua de etapas rola: traz a etapa atual para a vista
  lista.querySelector('[aria-current="true"]')
    ?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

/* --- backup em arquivo -------------------------------------------------- */

async function exportarBackup() {
  const p = JSON.parse(JSON.stringify(estado.projeto));
  const fotos = {};
  for (const acao of p.acoes) {
    for (const foto of acao.fotos) {
      const blob = await db.lerFoto(foto.id);
      if (blob) fotos[foto.id] = await new Promise((ok) => {
        const l = new FileReader(); l.onload = () => ok(l.result); l.readAsDataURL(blob);
      });
    }
  }
  const pacote = JSON.stringify({ tipo: 'relatorio-acoes-r2d', versao: 1, projeto: p, fotos });
  baixar(new Blob([pacote], { type: 'application/json' }),
    `backup-${nomeLimpo(p.produto || 'relatorio')}.json`);
  recado('Backup salvo.');
}

async function importarBackup(arquivo) {
  try {
    const pacote = JSON.parse(await arquivo.text());
    if (pacote.tipo !== 'relatorio-acoes-r2d') throw new Error('arquivo de outro tipo');

    const ok = await confirmar({
      titulo: 'Restaurar este backup?',
      texto: 'O relatório que está aberto agora será substituído pelo do arquivo.',
      confirmar: 'Restaurar', perigo: true,
    });
    if (!ok) return;

    await recomecar();
    for (const [id, dataUrl] of Object.entries(pacote.fotos || {})) {
      const blob = await (await fetch(dataUrl)).blob();
      await db.gravarFoto(id, blob);
    }
    estado.projeto = { ...projetoVazio(), ...pacote.projeto };
    await gravarAgora();
    mudou({ gravar: false });
    irPara('inicio');
    recado('Backup restaurado.');
  } catch (e) {
    console.error(e);
    recado('Esse arquivo não é um backup válido.', 'erro');
  }
}

/* --- início ------------------------------------------------------------ */

async function comecar() {
  $('#marca-topo').innerHTML = marcaInstitucional({ assinatura: false });

  await carregar();

  $('#b-backup').addEventListener('click', exportarBackup);
  $('#f-restaurar').addEventListener('change', (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (arquivo) importarBackup(arquivo);
  });
  $('#b-novo').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Começar um relatório novo?',
      texto: 'Tudo que está aqui — plano, ações e fotos — é apagado deste aparelho. Faça um backup antes se quiser guardar.',
      confirmar: 'Apagar e começar', perigo: true,
    });
    if (!ok) return;
    await recomecar();
    irPara('inicio');
    recado('Pronto para um relatório novo.');
  });

  // grava antes de fechar a aba, para não perder o que estava em digitação
  window.addEventListener('pagehide', () => { gravarAgora(); });

  const alvo = location.hash.slice(1);
  irPara(ETAPAS.some((e) => e.id === alvo) ? alvo : 'inicio');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline é um extra */ });
  }
}

comecar();
