/**
 * Leitor local do R2D — determinístico, gratuito e sempre disponível.
 *
 * Esta é a leitura PADRÃO. A IA (ia.js) é opcional e entra por cima quando a
 * pessoa pede: sem chave nenhuma, sem internet, o app continua inteiro. Isso
 * é de propósito — um representante no corredor de uma farmácia não pode
 * depender de um serviço externo para montar o relatório dele.
 *
 * O que ele NÃO faz: inventar. Seção que não aparece no PDF volta vazia, para
 * a pessoa preencher. Chute silencioso num relatório que vai para o gestor é
 * pior que campo em branco.
 *
 * Nas expressões, as bordas são Unicode — `\b` do JavaScript é ASCII e falha
 * depois de ã, ç, ê.
 */

const B_INI = '(?<![\\p{L}\\p{N}])';
const B_FIM = '(?![\\p{L}\\p{N}])';

/** Sem acento e em minúscula — só para casar títulos, nunca para exibir. */
const simples = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SECOES = [
  { campo: 'objetivos',       nomes: ['objetivo do plano', 'objetivo geral', 'objetivos', 'objetivo', 'meta do plano', 'proposito'] },
  { campo: 'desafios',        nomes: ['causa raiz', 'causas raiz', 'desafios', 'desafio', 'barreiras', 'barreira', 'diagnostico', 'problema', 'dores', 'pontos de atencao'] },
  { campo: 'estrategias',     nomes: ['estrategia', 'estrategias', 'como fazer', 'abordagem', 'taticas', 'tatica', 'direcionamento'] },
  { campo: 'acoesPlanejadas', nomes: ['acoes planejadas', 'plano de acao', 'acoes previstas', 'acoes', 'o que fazer', 'atividades', 'atividades previstas', 'proximos passos'] },
  { campo: 'metas',           nomes: ['indicadores', 'indicador', 'kpis', 'kpi', 'metas', 'meta', 'metricas', 'metrica', 'resultados esperados'] },
  { campo: 'contexto',        nomes: ['contexto', 'cenario', 'panorama', 'situacao atual', 'introducao', 'resumo'] },
];

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * @param {string} texto  texto extraído do PDF
 * @returns {{produto:string, periodoRotulo:string, periodoInicio:string, periodoFim:string,
 *            contexto:string, objetivos:string[], estrategias:string[], desafios:string[],
 *            acoesPlanejadas:string[], metas:string[], achou:string[]}}
 */
export function lerR2D(texto) {
  const linhas = String(texto || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const secoes = fatiar(linhas);
  const resultado = {
    produto: acharProduto(linhas),
    ...acharPeriodo(linhas),
    contexto: (secoes.contexto || []).join(' ').trim(),
    objetivos: emItens(secoes.objetivos),
    estrategias: emItens(secoes.estrategias),
    desafios: emItens(secoes.desafios),
    acoesPlanejadas: emItens(secoes.acoesPlanejadas),
    metas: emItens(secoes.metas),
  };

  resultado.achou = Object.entries(resultado)
    .filter(([k, v]) => Array.isArray(v) ? v.length : (typeof v === 'string' && v && k !== 'produto'))
    .map(([k]) => k);

  return resultado;
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
      const restoCru = m[1].trim();
      // título sozinho, ou título com dois-pontos e o conteúdo junto
      if (!restoCru) return { campo: secao.campo, resto: '' };
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
    // com marcador: cada marcador abre um item, o resto é continuação
    for (const linha of linhas) {
      const m = linha.match(/^([•▪◦‣·*+\-–—]|\d{1,2}[.)])\s+(.*)$/u);
      if (m) itens.push(m[2].trim());
      else if (itens.length) itens[itens.length - 1] += ' ' + linha;
      else itens.push(linha);
    }
  } else {
    // sem marcador: junta o que continua a frase anterior (linha que não
    // começa com maiúscula, ou anterior que não terminou em ponto)
    for (const linha of linhas) {
      const anterior = itens[itens.length - 1];
      const continua = anterior
        && !/[.;!?]$/.test(anterior)
        && !/^[A-ZÀ-Ý0-9]/u.test(linha);
      if (continua) itens[itens.length - 1] += ' ' + linha;
      else itens.push(linha);
    }
  }

  return itens
    .map((t) => t.replace(/\s+/g, ' ').replace(/^[\s:–—-]+/, '').replace(/[;,]$/, '').trim())
    .filter((t) => t.length > 3 && t.length < 400)
    .slice(0, 20);
}

function acharProduto(linhas) {
  for (const linha of linhas.slice(0, 40)) {
    const m = linha.match(/^\s*produtos?\s*[:\-–]\s*(.+)$/iu)
      || linha.match(/^\s*marca\s*[:\-–]\s*(.+)$/iu);
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

  // "01/09/2026 a 30/09/2026"
  const faixa = texto.match(
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|até|ate|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/u,
  );
  if (faixa) {
    return {
      periodoRotulo: `${faixa[1]} a ${faixa[2]}`,
      periodoInicio: paraISO(faixa[1]),
      periodoFim: paraISO(faixa[2]),
    };
  }

  // "Ciclo 7 | Setembro de 2026" ou só "Setembro de 2026"
  const ciclo = cru.match(new RegExp(`${B_INI}ciclo\\s*(\\d{1,2})${B_FIM}`, 'u'));
  const mes = cru.match(
    new RegExp(`${B_INI}(${MESES.join('|')})${B_FIM}(?:\\s*(?:de|/)\\s*(\\d{4}))?`, 'u'),
  );

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
  const ano = a.length === 2 ? '20' + a : a;
  return `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
