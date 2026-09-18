/**
 * O estado do app: uma escola, seus times, atletas, dinheiro e agenda.
 * Toda escrita passa por `salvar()`, que grava o objeto inteiro.
 */
import { ler, gravar, limpar } from './db.js';

export const VERSAO = 1;

export const estadoVazio = () => ({
  versao: VERSAO,
  escola: {
    id: 'escola',
    nome: '',
    responsavel: '',
    telefone: '',
    pixChave: '',
    pixNome: '',
    pixCidade: '',
    vencimentoPadrao: 10,
  },
  times: [],
  atletas: [],
  mensalidades: [],
  lancamentos: [],
  jogos: [],
  treinos: [],
});

export let estado = estadoVazio();

/**
 * Migra um estado gravado por uma versão anterior.
 * Fica aqui desde a v1, com uma migração que não faz nada, porque acrescentar
 * o ponto de migração depois — com dados de um cliente dentro — é pior.
 */
export function migrar(dados) {
  const base = estadoVazio();
  if (!dados || typeof dados !== 'object') return base;
  return {
    ...base,
    ...dados,
    versao: VERSAO,
    escola: { ...base.escola, ...(dados.escola || {}) },
    times: dados.times || [],
    atletas: dados.atletas || [],
    mensalidades: dados.mensalidades || [],
    lancamentos: dados.lancamentos || [],
    jogos: dados.jogos || [],
    treinos: dados.treinos || [],
  };
}

export async function carregar() {
  estado = migrar(await ler());
  return estado;
}

export async function salvar() {
  // Structured clone não aceita proxies nem funções; o estado é só dado puro,
  // mas o JSON garante isso mesmo que alguém encoste um objeto estranho nele.
  await gravar(JSON.parse(JSON.stringify(estado)));
  return estado;
}

export function substituir(novo) {
  estado = migrar(novo);
  return estado;
}

export async function apagarTudo() {
  await limpar();
  estado = estadoVazio();
  return estado;
}

// ─── Backup ──────────────────────────────────────────────────────────────────

export function backupJson() {
  return JSON.stringify({ ...estado, exportadoEm: new Date().toISOString() }, null, 2);
}

export const nomeDoBackup = () => {
  const apelido = (estado.escola.nome || 'escolinha')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'escolinha';
  return `quadra-${apelido}-${new Date().toISOString().slice(0, 10)}.json`;
};

/**
 * Lê um backup. Confere que é um arquivo deste app antes de trocar o estado —
 * restaurar um JSON qualquer por cima dos dados da escolinha é irreversível.
 */
export function lerBackup(texto) {
  const dados = JSON.parse(texto);
  if (!dados || typeof dados !== 'object' || !('atletas' in dados) || !('escola' in dados)) {
    throw new Error('Este arquivo não parece um backup do Quadra.');
  }
  return migrar(dados);
}
