/**
 * O modelo do relatório e sua persistência.
 *
 * Princípio do produto, que o modelo espelha: o R2D é o PLANO e não é tocado
 * aqui. `projeto.plano` é uma LEITURA do PDF enviado — serve de referência
 * para as ações se ligarem a ela. `projeto.acoes` é a EXECUÇÃO: o que a
 * pessoa de fato fez. Nada neste arquivo escreve no PDF original.
 */

import { db, esquecerFoto } from './db.js';

export const CATEGORIAS = [
  'Visita médica',
  'Ação em PDV',
  'Evento',
  'Treinamento',
  'Reunião',
  'Ação com cliente',
  'Material promocional',
  'Monitoramento de mercado',
  'Outra',
];

export const INDICADORES = [
  { chave: 'marketShare', nome: 'Market share', unidade: '%', sentido: 'sobe' },
  { chave: 'evolucao', nome: 'Índice de evolução', unidade: '%', sentido: 'sobe', sinal: true },
  { chave: 'cota', nome: 'Atingimento de cota', unidade: '%', sentido: 'sobe' },
];

export function novoId(prefixo = 'id') {
  return prefixo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function projetoVazio() {
  return {
    versao: 1,
    criadoEm: new Date().toISOString(),
    representante: '',
    produto: '',
    logoProduto: null,          // data: URL, opcional — logo do PRODUTO, nunca a institucional
    periodoRotulo: '',
    periodoInicio: '',
    periodoFim: '',

    r2d: {                      // o PDF enviado, só como referência
      nomeArquivo: '',
      paginas: 0,
      enviadoEm: '',
      texto: '',                // texto extraído, guardado para reinterpretar sem reenviar
      origemLeitura: '',        // 'ia' | 'local' | 'manual' | ''
    },

    plano: {                    // o que o R2D previa (editável, nunca reescreve o PDF)
      contexto: '',
      objetivos: [],            // [{id, sigla, texto}]
      estrategias: [],
      desafios: [],
      acoesPlanejadas: [],
      metas: [],
      totalPlanejadas: null,    // número de ações previstas, para o % de execução
    },

    acoes: [],                  // a execução
    indicadores: [],            // [{id, rotulo, marketShare, evolucao, cota}]

    fechamento: {
      resumo: '',
      entregas: [],
      pendencias: [],
      proximosPassos: [],
      atencao: [],
    },
  };
}

export function acaoVazia() {
  return {
    id: novoId('ac'),
    registradoEm: new Date().toISOString(),  // preenchido pelo sistema, não pela pessoa
    data: hojeISO(),
    titulo: '',
    categoria: 'Visita médica',
    vinculos: [],                             // ids de itens do plano
    objetivo: '',
    descricao: '',
    local: '',
    resultado: '',
    proximoPasso: '',
    observacoes: '',
    fotos: [],                                // [{id, legenda}]
  };
}

export function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------------ */

export const estado = {
  projeto: projetoVazio(),
  pronto: false,
};

const ouvintes = new Set();
export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

let gravacaoPendente = null;

/** Marca o projeto como alterado: avisa a tela e agenda a gravação. */
export function mudou({ gravar = true } = {}) {
  ouvintes.forEach((fn) => fn(estado.projeto));
  if (!gravar) return;
  clearTimeout(gravacaoPendente);
  gravacaoPendente = setTimeout(gravarAgora, 400);
}

export async function gravarAgora() {
  clearTimeout(gravacaoPendente);
  estado.projeto.salvoEm = new Date().toISOString();
  try {
    await db.gravarProjeto(JSON.parse(JSON.stringify(estado.projeto)));
  } catch (e) {
    console.error('Não consegui gravar o projeto', e);
  }
}

export async function carregar() {
  try {
    const guardado = await db.lerProjeto();
    if (guardado) estado.projeto = { ...projetoVazio(), ...guardado };
  } catch (e) {
    console.error('Não consegui ler o projeto guardado', e);
  }
  estado.pronto = true;
  return estado.projeto;
}

export async function recomecar() {
  const idsUsados = new Set(estado.projeto.acoes.flatMap((a) => a.fotos.map((f) => f.id)));
  idsUsados.forEach(esquecerFoto);
  await db.limparFotos();
  await db.apagarProjeto();
  estado.projeto = projetoVazio();
  mudou();
}

/* --- itens do plano ---------------------------------------------------- */

const SIGLAS = { objetivos: 'OBJ', estrategias: 'EST', desafios: 'DES', acoesPlanejadas: 'PLN', metas: 'MET' };

export function itemDePlano(lista, texto) {
  const usados = estado.projeto.plano[lista] || [];
  return { id: novoId(lista.slice(0, 3)), sigla: `${SIGLAS[lista]}${usados.length + 1}`, texto };
}

/** Renumera as siglas depois de remover um item, para não ficar OBJ1, OBJ3. */
export function renumerar(lista) {
  (estado.projeto.plano[lista] || []).forEach((item, i) => { item.sigla = `${SIGLAS[lista]}${i + 1}`; });
}

/** Todos os itens do plano em uma lista só, para o seletor de vínculo. */
export function itensDoPlano() {
  const p = estado.projeto.plano;
  const grupos = [
    ['Objetivos', p.objetivos],
    ['Estratégias', p.estrategias],
    ['Ações planejadas', p.acoesPlanejadas],
    ['Desafios', p.desafios],
  ];
  return grupos.filter(([, itens]) => itens && itens.length);
}

export function acharItemDoPlano(id) {
  const p = estado.projeto.plano;
  for (const lista of ['objetivos', 'estrategias', 'acoesPlanejadas', 'desafios', 'metas']) {
    const achado = (p[lista] || []).find((i) => i.id === id);
    if (achado) return achado;
  }
  return null;
}

/* --- números derivados ------------------------------------------------- */

export function acoesEmOrdem() {
  return [...estado.projeto.acoes].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function totalDeFotos() {
  return estado.projeto.acoes.reduce((n, a) => n + a.fotos.length, 0);
}

/** Último período com pelo menos um indicador preenchido. */
export function ultimoIndicador() {
  const preenchidos = estado.projeto.indicadores.filter(
    (i) => INDICADORES.some((d) => i[d.chave] !== '' && i[d.chave] != null),
  );
  return preenchidos.length ? preenchidos[preenchidos.length - 1] : null;
}

export function penultimoIndicador() {
  const preenchidos = estado.projeto.indicadores.filter(
    (i) => INDICADORES.some((d) => i[d.chave] !== '' && i[d.chave] != null),
  );
  return preenchidos.length > 1 ? preenchidos[preenchidos.length - 2] : null;
}

export function execucao() {
  const previstas = Number(estado.projeto.plano.totalPlanejadas);
  const feitas = estado.projeto.acoes.length;
  if (!previstas || previstas <= 0) return { previstas: null, feitas, pct: null };
  return { previstas, feitas, pct: (feitas / previstas) * 100 };
}

export function porCategoria() {
  const mapa = new Map();
  estado.projeto.acoes.forEach((a) => mapa.set(a.categoria, (mapa.get(a.categoria) || 0) + 1));
  return [...mapa].sort((a, b) => b[1] - a[1]);
}

/** Quantas ações se ligaram a cada item do plano — é a coluna
 *  "planejado → executado" do relatório. */
export function cobertura() {
  const p = estado.projeto.plano;
  const alvo = [...(p.objetivos || []), ...(p.estrategias || []), ...(p.acoesPlanejadas || [])];
  return alvo.map((item) => ({
    item,
    quantas: estado.projeto.acoes.filter((a) => a.vinculos.includes(item.id)).length,
  }));
}
