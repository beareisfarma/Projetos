/**
 * O estado do app: uma escola, seus times, atletas, dinheiro e agenda.
 * Toda escrita passa por `salvar()`, que grava o objeto inteiro.
 */
import { ler, gravar, limpar } from './db.js';

export const VERSAO = 2;

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
 *
 * v1 → v2: o time ganhou `modalidade`. Tudo que existia antes era vôlei, que é
 * o padrão — assim um backup antigo continua abrindo com a escalação certa.
 */
export function migrar(dados) {
  const base = estadoVazio();
  if (!dados || typeof dados !== 'object') return base;
  return {
    ...base,
    ...dados,
    versao: VERSAO,
    escola: { ...base.escola, ...(dados.escola || {}) },
    times: (dados.times || []).map((t) => ({ modalidade: 'volei', ...t })),
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

/** Erro de gravação, separado para a tela reconhecer e avisar alto. */
export class FalhaAoGravar extends Error {
  constructor(causa) {
    super('Não consegui gravar os dados neste aparelho.');
    this.name = 'FalhaAoGravar';
    this.causa = causa;
  }
}

/**
 * Quem é avisado quando a gravação falha.
 *
 * Isto é um aviso DIRETO, e não `unhandledrejection`, de propósito: bastaria um
 * `try/catch` em qualquer tela para a rejeição parar de subir e o alerta sumir
 * calado — exatamente o problema que ele existe para evitar. Aqui, falhou,
 * avisa, e só depois lança.
 */
let avisarFalha = () => {};
export const aoFalharGravacao = (fn) => { avisarFalha = fn; };

export async function salvar() {
  try {
    // Structured clone não aceita proxies nem funções; o estado é só dado puro,
    // mas o JSON garante isso mesmo que alguém encoste um objeto estranho nele.
    await gravar(JSON.parse(JSON.stringify(estado)));
  } catch (erro) {
    // O pior desfecho possível num app de dinheiro é a gravação falhar CALADA:
    // a tela fecha, o número aparece certo em memória, e na próxima abertura
    // sumiu. Disco cheio, aba privada e cota estourada fazem exatamente isso.
    // Então a falha sobe, e quem chamou não tem como fingir que deu certo.
    console.error('[quadra] falha ao gravar', erro);
    const falha = new FalhaAoGravar(erro);
    try { avisarFalha(falha); } catch { /* o aviso nunca derruba o app */ }
    throw falha;
  }
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
