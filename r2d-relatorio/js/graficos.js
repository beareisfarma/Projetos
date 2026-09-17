/**
 * Gráfico de evolução de um indicador — SVG escrito na mão, sem biblioteca.
 *
 * Decisões que valem a pena não desfazer:
 *
 * • Um gráfico por indicador, lado a lado (small multiples). Market Share em
 *   % e Índice de Evolução em número índice não cabem no mesmo eixo, e dois
 *   eixos num gráfico só é o erro clássico de leitura.
 *
 * • Série única por gráfico ⇒ nada de legenda (o título nomeia a série) e nada
 *   de paleta categórica. A cor é uma: --azul-dado (#1163b0), um passo do azul
 *   institucional escolhido por passar a banda de luminosidade e o contraste
 *   mínimo como marca de dado — o #004080 da marca é escuro demais para isso.
 *
 * • Rótulo direto só no primeiro e no último ponto; a tabela mês a mês, logo
 *   abaixo no relatório, é a série completa e a versão acessível dos dados.
 *
 * • O ponto marcado como referência ganha um anel, porque é dele que a gerente
 *   parte para ler a evolução.
 *
 * • Com menos de dois períodos não existe evolução para desenhar: devolve
 *   vazio e a página mostra só o número.
 */

const COR = '#1163b0';
const TINTA_2 = '#55636f';
const TINTA_3 = '#93a0ac';
const LINHA = '#dbe4ee';

const L = 200, A = 78;                       // caixa em unidades de viewBox
const M = { cima: 16, baixo: 16, esq: 6, dir: 6 };

const fmtNum = (v, casas) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const rotuloValor = (v, unidade) => {
  const n = Number(v);
  const casas = unidade === '%' ? 1 : (Number.isInteger(n) ? 0 : 1);
  return fmtNum(n, casas) + (unidade === '%' ? '%' : '');
};

/**
 * @param {{rotulo:string, valor:number, referencia?:boolean}[]} serie
 * @param {{unidade?:string, nome?:string}} [opcoes]
 * @returns {string} SVG, ou '' quando não há evolução para mostrar
 */
export function linhaEvolucao(serie, { unidade = '', nome = '' } = {}) {
  const dados = (serie || []).filter((p) => p.valor !== '' && p.valor != null && !Number.isNaN(Number(p.valor)));
  if (dados.length < 2) return '';

  const valores = dados.map((p) => Number(p.valor));
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.18;
  min -= folga; max += folga;

  const x = (i) => M.esq + (i * (L - M.esq - M.dir)) / (dados.length - 1);
  const y = (v) => M.cima + (1 - (v - min) / (max - min)) * (A - M.cima - M.baixo);

  const pts = dados.map((p, i) => [x(i), y(Number(p.valor))]);
  const linha = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${linha} L${pts.at(-1)[0].toFixed(1)} ${A - M.baixo} L${pts[0][0].toFixed(1)} ${A - M.baixo} Z`;

  const marcas = pts.map(([px, py], i) => {
    const primeiro = i === 0, ultimo = i === pts.length - 1;
    const ref = dados[i].referencia;
    const rotulo = (primeiro || ultimo)
      ? `<text x="${px.toFixed(1)}" y="${(py - 7).toFixed(1)}" font-size="10" font-weight="600"
              fill="${TINTA_2}" text-anchor="${primeiro ? 'start' : 'end'}">${rotuloValor(dados[i].valor, unidade)}</text>`
      : '';
    return `<g><title>${escapar(dados[i].rotulo)}: ${rotuloValor(dados[i].valor, unidade)}${ref ? ' (referência)' : ''}</title>
      ${ref ? `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="none" stroke="${COR}" stroke-width="1.2" stroke-opacity=".45"/>` : ''}
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${ultimo ? 4 : 3}"
              fill="${ultimo ? COR : '#fff'}" stroke="${COR}" stroke-width="2"/></g>${rotulo}`;
  }).join('');

  const eixo = dados.map((p, i) => {
    const primeiro = i === 0, ultimo = i === dados.length - 1;
    if (!primeiro && !ultimo && dados.length > 3) return '';
    return `<text x="${x(i).toFixed(1)}" y="${A - 3}" font-size="9" fill="${TINTA_3}"
      text-anchor="${primeiro ? 'start' : ultimo ? 'end' : 'middle'}">${escapar(p.rotulo)}</text>`;
  }).join('');

  return `
<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${escapar(nome)}: evolução de ${escapar(dados[0].rotulo)} a ${escapar(dados.at(-1).rotulo)}">
  <line x1="0" y1="${A - M.baixo}" x2="${L}" y2="${A - M.baixo}" stroke="${LINHA}" stroke-width="1"/>
  <path d="${area}" fill="${COR}" fill-opacity=".07"/>
  <path d="${linha}" fill="none" stroke="${COR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${marcas}${eixo}
</svg>`.trim();
}

function escapar(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
