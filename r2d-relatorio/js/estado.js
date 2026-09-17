/**
 * O modelo do relatório e sua persistência.
 *
 * O R2D é o PLANO, já elaborado e aprovado com a gerente. Este app não o cria,
 * não o edita e não o substitui. `projeto.plano` guarda só a LEITURA de três
 * coisas do PDF — objetivo, gap e ações previstas — que entram no relatório
 * como contexto e nada mais.
 *
 * O que o app de fato registra é `acoes` (o que foi feito) e `indicadores`
 * (como o produto evoluiu). Nada além disso.
 */

import { db, esquecerFoto } from './db.js';

export function novoId(prefixo = 'id') {
  return prefixo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Os dois indicadores que todo R2D acompanha. A pessoa acrescenta outros. */
export function indicadoresPadrao() {
  return [
    { id: novoId('ind'), nome: 'Market Share', unidade: '%' },
    { id: novoId('ind'), nome: 'Índice de Evolução', unidade: '' },
  ];
}

export function projetoVazio() {
  return {
    versao: 2,
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
      texto: '',                // guardado para reinterpretar sem reenviar o arquivo
      origemLeitura: '',        // 'ia' | 'local' | 'manual' | ''
    },

    plano: {                    // o que o R2D dizia — contexto, não gestão
      objetivo: '',
      gap: '',
      acoesPrevistas: [],       // lista de textos, só para exibição
    },

    acoes: [],                  // o que foi feito
    indicadores: {
      definicoes: indicadoresPadrao(),
      periodos: [],             // [{id, rotulo, referencia, valores: {defId: número}}]
    },
  };
}

export function acaoVazia() {
  return {
    id: novoId('ac'),
    registradoEm: new Date().toISOString(),  // preenchido pelo sistema
    data: hojeISO(),
    titulo: '',
    local: '',
    resultado: '',
    fotos: [],                               // [{id, legenda}]
  };
}

export function periodoVazio(rotulo = '', referencia = false) {
  return { id: novoId('per'), rotulo, referencia, valores: {} };
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
    if (guardado) estado.projeto = migrar(guardado);
  } catch (e) {
    console.error('Não consegui ler o projeto guardado', e);
  }
  estado.pronto = true;
  return estado.projeto;
}

/**
 * Traz um projeto da versão 1 para a 2.
 *
 * A v1 tinha um plano estruturado (objetivos, estratégias, desafios, ações
 * planejadas, com siglas) e ações amarradas a ele. Virou contexto simples.
 * Nada do que a pessoa escreveu é jogado fora sem aviso: o que existia vira
 * texto nos campos novos.
 */
function migrar(guardado) {
  const base = projetoVazio();
  if ((guardado.versao || 1) >= 2) {
    return {
      ...base, ...guardado,
      plano: { ...base.plano, ...(guardado.plano || {}) },
      indicadores: {
        definicoes: guardado.indicadores?.definicoes?.length
          ? guardado.indicadores.definicoes : base.indicadores.definicoes,
        periodos: guardado.indicadores?.periodos || [],
      },
    };
  }

  const velho = guardado.plano || {};
  const texto = (lista) => (lista || []).map((i) => i.texto || i).filter(Boolean);
  const novo = {
    ...base,
    ...guardado,
    versao: 2,
    plano: {
      objetivo: velho.contexto || texto(velho.objetivos).join(' ') || '',
      gap: texto(velho.desafios).join(' ') || '',
      acoesPrevistas: [...texto(velho.acoesPlanejadas), ...texto(velho.estrategias)].slice(0, 8),
    },
    acoes: (guardado.acoes || []).map((a) => ({
      id: a.id, registradoEm: a.registradoEm, data: a.data,
      titulo: a.titulo, local: a.local,
      resultado: [a.descricao, a.resultado, a.observacoes].filter(Boolean).join('\n\n'),
      fotos: a.fotos || [],
    })),
    indicadores: base.indicadores,
  };

  // a tabela antiga tinha três colunas fixas; vira definições + períodos
  const antigos = guardado.indicadores;
  if (Array.isArray(antigos) && antigos.length) {
    const defs = [
      { id: novoId('ind'), nome: 'Market Share', unidade: '%', de: 'marketShare' },
      { id: novoId('ind'), nome: 'Índice de Evolução', unidade: '', de: 'evolucao' },
      { id: novoId('ind'), nome: 'Atingimento de cota', unidade: '%', de: 'cota' },
    ];
    novo.indicadores = {
      definicoes: defs.map(({ de, ...d }) => d),
      periodos: antigos.map((linha, i) => ({
        id: novoId('per'),
        rotulo: linha.rotulo || `Período ${i + 1}`,
        referencia: i === 0,
        valores: Object.fromEntries(defs
          .map((d, j) => [novo.indicadores?.definicoes?.[j]?.id ?? defs[j].id, linha[d.de]])
          .filter(([, v]) => v !== '' && v != null)),
      })),
    };
    // refaz os ids agora que as definições existem
    novo.indicadores.periodos.forEach((p, i) => {
      p.valores = Object.fromEntries(novo.indicadores.definicoes
        .map((d, j) => [d.id, antigos[i][defs[j].de]])
        .filter(([, v]) => v !== '' && v != null));
    });
  }

  delete novo.fechamento;
  return novo;
}

export async function recomecar() {
  const idsUsados = new Set(estado.projeto.acoes.flatMap((a) => a.fotos.map((f) => f.id)));
  idsUsados.forEach(esquecerFoto);
  await db.limparFotos();
  await db.apagarProjeto();
  estado.projeto = projetoVazio();
  mudou();
}

/* --- números derivados --------------------------------------------- */

export function acoesEmOrdem() {
  return [...estado.projeto.acoes].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function totalDeFotos() {
  return estado.projeto.acoes.reduce((n, a) => n + a.fotos.length, 0);
}

const temValor = (v) => v !== '' && v != null && !Number.isNaN(Number(v));

/** Períodos com pelo menos um valor preenchido, na ordem em que foram criados. */
export function periodosPreenchidos() {
  const { definicoes, periodos } = estado.projeto.indicadores;
  return periodos.filter((p) => definicoes.some((d) => temValor(p.valores[d.id])));
}

/**
 * Referência (o marco inicial do R2D) e a posição mais recente de um indicador.
 * O app não calcula nem estima valor nenhum: só lê o que foi digitado e compara.
 */
export function leituraDoIndicador(def) {
  const comValor = periodosPreenchidos().filter((p) => temValor(p.valores[def.id]));
  if (!comValor.length) return null;

  const marcada = comValor.find((p) => p.referencia);
  const referencia = marcada || comValor[0];
  const atual = comValor[comValor.length - 1];
  const mesma = referencia.id === atual.id;

  return {
    referencia: { rotulo: referencia.rotulo, valor: Number(referencia.valores[def.id]) },
    atual: { rotulo: atual.rotulo, valor: Number(atual.valores[def.id]) },
    variacao: mesma ? null : Number(atual.valores[def.id]) - Number(referencia.valores[def.id]),
  };
}

/** Série completa de um indicador, para o gráfico. */
export function serieDoIndicador(def) {
  return estado.projeto.indicadores.periodos
    .map((p) => ({ rotulo: p.rotulo, valor: p.valores[def.id], referencia: p.referencia }))
    .filter((p) => temValor(p.valor));
}
