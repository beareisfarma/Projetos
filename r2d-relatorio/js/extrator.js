/**
 * Leitura local do R2D — determinística, gratuita e sempre disponível.
 *
 * Lê TRÊS coisas, e só: o **objetivo** do plano, o **gap** identificado e as
 * **ações previstas**. É o que o relatório precisa para dar contexto à gerente.
 * O R2D não é reconstruído aqui, nem virá estruturado em listas editáveis:
 * ele já existe, já foi aprovado, e neste app é referência.
 *
 * Esta é a leitura PADRÃO. A IA (ia.js) é opcional e entra por cima quando a
 * pessoa pede: sem chave nenhuma, sem internet, o app continua inteiro.
 *
 * O que ele NÃO faz: inventar. Campo que não aparece no PDF volta vazio, para
 * a pessoa escrever. Chute silencioso num documento que vai para a gerente é
 * pior que campo em branco.
 *
 * Nas expressões, as bordas são Unicode — o `\b` do JavaScript é ASCII e falha
 * depois de ã, ç, ê.
 */

const B_INI = '(?<![\\p{L}\\p{N}])';
const B_FIM = '(?![\\p{L}\\p{N}])';

/** Sem acento e em minúscula — só para casar títulos, nunca para exibir. */
const simples = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SECOES = [
  { campo: 'objetivo', nomes: ['objetivo do plano', 'objetivo geral', 'objetivos', 'objetivo', 'meta do plano', 'proposito'] },
  { campo: 'gap', nomes: ['gap', 'gaps', 'causa raiz', 'causas raiz', 'desafios', 'desafio', 'barreiras', 'barreira', 'diagnostico', 'problema', 'oportunidade'] },
  { campo: 'acoes', nomes: ['acoes planejadas', 'plano de acao', 'acoes previstas', 'acoes', 'o que fazer', 'atividades', 'atividades previstas'] },
  { campo: 'estrategia', nomes: ['estrategia', 'estrategias', 'taticas', 'como fazer'] },
  { campo: 'contexto', nomes: ['contexto', 'cenario', 'panorama', 'situacao atual', 'introducao'] },
  // Reconhecidas para ENCERRAR a seção anterior, e descartadas de propósito:
  // os números de indicador são digitados pela pessoa, a partir do relatório
  // oficial da empresa. Ler market share de dentro do PDF seria o app inventar
  // um número que vai para a gerente.
  { campo: 'descartar', nomes: ['indicadores', 'indicador', 'kpis', 'kpi', 'metas', 'meta', 'metricas', 'metrica', 'resultados esperados', 'anexos', 'observacoes'] },
];

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * @param {string} texto  texto extraído do PDF
 * @returns {{produto:string, periodoRotulo:string, periodoInicio:string, periodoFim:string,
 *            objetivo:string, gap:string, acoesPrevistas:string[]}}
 */
export function lerR2D(texto) {
  const linhas = String(texto || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const secoes = fatiar(linhas);
  const juntar = (bloco) => emItens(bloco).join(' ');

  return {
    produto: acharProduto(linhas),
    ...acharPeriodo(linhas),
    objetivo: juntar(secoes.objetivo) || juntar(secoes.contexto),
    gap: juntar(secoes.gap),
    // "Estratégia" só entra quando o R2D não trouxe uma lista de ações: num
    // documento que tem as duas, somar as estratégias infla a lista com o
    // "como" quando a gerente quer ver o "o quê".
    acoesPrevistas: (emItens(secoes.acoes).length ? emItens(secoes.acoes) : emItens(secoes.estrategia)).slice(0, 8),
  };
}

/** Quebra o texto em blocos por título de seção. */
function fatiar(linhas) {
  const blocos = {};
  let atual = null;

  for (const linha of linhas) {
    const achado = comoTitulo(linha);
    if (achado) {
      atual = achado.campo;
      if (!blocos[atual]) blocos[atual] = [];
      if (achado.resto) blocos[atual].push(achado.resto);   // "OBJETIVO: ampliar..." na mesma linha
      continue;
    }
    if (atual) blocos[atual].push(linha);
  }
  return blocos;
}

/**
 * Uma linha é título quando bate com um nome de seção e ou é curta
 * (o título sozinho) ou traz o conteúdo depois de ':' ou '–'.
 */
function comoTitulo(linha) {
  const cru = simples(linha);
  for (const secao of SECOES) {
    for (const nome of secao.nomes) {
      const re = new RegExp(`^${B_INI}${nome}${B_FIM}\\s*[:\\-–—]?\\s*(.*)$`, 'u');
      const m = cru.match(re);
      if (!m) continue;
      if (!m[1].trim()) return { campo: secao.campo, resto: '' };
      if (/[:\-–—]/.test(linha.slice(0, nome.length + 3))) {
        const corte = linha.search(/[:\-–—]/);
        return { campo: secao.campo, resto: linha.slice(corte + 1).trim() };
      }
      // linha longa que apenas começa com a palavra não é título
      if (linha.length > nome.length + 40) return null;
      return { campo: secao.campo, resto: linha.slice(nome.length).replace(/^[\s:–—-]+/, '').trim() };
    }
  }
  return null;
}

/** Bloco de linhas → itens de lista. */
function emItens(linhas) {
  if (!linhas || !linhas.length) return [];

  const marcado = linhas.some((l) => /^([•▪◦‣·*+\-–—]|\d{1,2}[.)])\s+/u.test(l));
  const itens = [];

  if (marcado) {
    for (const linha of linhas) {
      const m = linha.match(/^([•▪◦‣·*+\-–—]|\d{1,2}[.)])\s+(.*)$/u);
      if (m) itens.push(m[2].trim());
      else if (itens.length) itens[itens.length - 1] += ' ' + linha;
      else itens.push(linha);
    }
  } else {
    // sem marcador: junta o que continua a frase anterior
    for (const linha of linhas) {
      const anterior = itens[itens.length - 1];
      const continua = anterior && !/[.;!?]$/.test(anterior) && !/^[A-ZÀ-Ý0-9]/u.test(linha);
      if (continua) itens[itens.length - 1] += ' ' + linha;
      else itens.push(linha);
    }
  }

  return itens
    .map((t) => t.replace(/\s+/g, ' ').replace(/^[\s:–—-]+/, '').replace(/[;,]$/, '').trim())
    .filter((t) => t.length > 3 && t.length < 400);
}

function acharProduto(linhas) {
  for (const linha of linhas.slice(0, 40)) {
    const m = linha.match(/^\s*produtos?\s*[:\-–]\s*(.+)$/iu) || linha.match(/^\s*marca\s*[:\-–]\s*(.+)$/iu);
    if (m) return m[1].trim().slice(0, 60);
  }
  // sem rótulo: a primeira linha curta toda em maiúsculas do topo costuma ser a marca
  for (const linha of linhas.slice(0, 12)) {
    if (linha.length >= 3 && linha.length <= 28
      && linha === linha.toUpperCase()
      && /^[\p{Lu}\p{N} ®+\-.]+$/u.test(linha)
      && !/^(r2d|plano|relatorio|relatório|acoes|ações|ciclo|objetivo)/i.test(simples(linha))) {
      return linha.trim();
    }
  }
  return '';
}

function acharPeriodo(linhas) {
  const vazio = { periodoRotulo: '', periodoInicio: '', periodoFim: '' };
  const texto = linhas.slice(0, 60).join('\n');
  const cru = simples(texto);

  const faixa = texto.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|até|ate|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/u);
  if (faixa) {
    return {
      periodoRotulo: `${faixa[1]} a ${faixa[2]}`,
      periodoInicio: paraISO(faixa[1]),
      periodoFim: paraISO(faixa[2]),
    };
  }

  const ciclo = cru.match(new RegExp(`${B_INI}ciclo\\s*(\\d{1,2})${B_FIM}`, 'u'));
  const mes = cru.match(new RegExp(`${B_INI}(${MESES.join('|')})${B_FIM}(?:\\s*(?:de|/)\\s*(\\d{4}))?`, 'u'));

  if (mes) {
    const iMes = MESES.indexOf(mes[1]);
    const ano = mes[2] ? Number(mes[2]) : new Date().getFullYear();
    const p = (n) => String(n).padStart(2, '0');
    const ultimo = new Date(ano, iMes + 1, 0).getDate();
    const nomeMes = mes[1][0].toUpperCase() + mes[1].slice(1).replace('marco', 'março');
    return {
      periodoRotulo: (ciclo ? `Ciclo ${ciclo[1]} · ` : '') + `${nomeMes} de ${ano}`,
      periodoInicio: `${ano}-${p(iMes + 1)}-01`,
      periodoFim: `${ano}-${p(iMes + 1)}-${p(ultimo)}`,
    };
  }

  if (ciclo) return { ...vazio, periodoRotulo: `Ciclo ${ciclo[1]}` };
  return vazio;
}

function paraISO(br) {
  const [d, m, a] = br.split('/');
  return `${a.length === 2 ? '20' + a : a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
