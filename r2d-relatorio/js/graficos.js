/**
 * Gráficos do relatório — SVG escrito na mão, sem biblioteca.
 *
 * Decisões que valem a pena não desfazer:
 *
 * • Um gráfico por indicador, lado a lado (small multiples), em vez de três
 *   séries num gráfico só. Market share, índice de evolução e atingimento de
 *   cota são todos "%", mas medem coisas diferentes em escalas diferentes —
 *   juntar exigiria dois eixos, que é o erro clássico de leitura de gráfico.
 *
 * • Série única por gráfico ⇒ nada de legenda (o título já nomeia a série) e
 *   nada de paleta categórica. A cor é uma só: --azul-dado (#1163b0), um passo
 *   do azul institucional escolhido por passar a banda de luminosidade e o
 *   contraste mínimo como marca de dado — o #004080 da marca é escuro demais
 *   para isso e fica valendo para texto e estrutura.
 *
 * • Rótulo direto só no primeiro e no último ponto. Número em cima de todo
 *   ponto vira ruído; a série completa está na tabela logo abaixo do gráfico,
 *   que também é a versão acessível dos dados.
 *
 * • Com menos de dois períodos não existe evolução para desenhar: devolve
 *   vazio e a página mostra só o número grande.
 */

const COR = '#1163b0';
const TINTA_2 = '#55636f';
const TINTA_3 = '#93a0ac';
const LINHA = '#dbe4ee';

const L = 200, A = 78;                       // caixa em unidades de viewBox
const M = { cima: 16, baixo: 16, esq: 6, dir: 6 };

const fmt = (v, casas = 1) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Linha de evolução de um indicador.
 * @param {{rotulo:string, valor:number}[]} pontos
 * @param {{sinal?:boolean, nome?:string}} [opcoes]  sinal: mostra '+' nos positivos
 * @returns {string} SVG, ou '' quando não há evolução para mostrar
 */
export function linhaEvolucao(pontos, { sinal = false, nome = '' } = {}) {
  const dados = pontos.filter((p) => p.valor !== '' && p.valor != null && !Number.isNaN(Number(p.valor)));
  if (dados.length < 2) return '';

  const valores = dados.map((p) => Number(p.valor));
  let min = Math.min(...valores, sinal ? 0 : Math.min(...valores));
  let max = Math.max(...valores, sinal ? 0 : Math.max(...valores));
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.18;
  min -= folga; max += folga;

  const x = (i) => M.esq + (i * (L - M.esq - M.dir)) / (dados.length - 1);
  const y = (v) => M.cima + (1 - (v - min) / (max - min)) * (A - M.cima - M.baixo);

  const pts = dados.map((p, i) => [x(i), y(Number(p.valor))]);
  const linha = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${linha} L${pts.at(-1)[0].toFixed(1)} ${A - M.baixo} L${pts[0][0].toFixed(1)} ${A - M.baixo} Z`;

  const texto = (v) => (sinal && Number(v) > 0 ? '+' : '') + fmt(v) + '%';

  const marcas = pts.map(([px, py], i) => {
    const primeiro = i === 0, ultimo = i === pts.length - 1;
    const rotulo = (primeiro || ultimo)
      ? `<text x="${px.toFixed(1)}" y="${(py - 7).toFixed(1)}" font-size="10" font-weight="600"
              fill="${TINTA_2}" text-anchor="${primeiro ? 'start' : 'end'}">${texto(dados[i].valor)}</text>`
      : '';
    return `<g><title>${escapar(dados[i].rotulo)}: ${texto(dados[i].valor)}</title>
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
  <path d="${linha}" fill="none" stroke="${COR}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
  ${marcas}${eixo}
</svg>`.trim();
}

/**
 * Barra de uma série só (categorias). Devolve HTML, não SVG: a barra é um
 * retângulo com rótulo, e HTML atravessa a exportação sem surpresa.
 * @param {[string, number][]} pares
 */
export function barrasCategoria(pares, { total }) {
  if (!pares.length) return '';
  const maior = Math.max(...pares.map(([, n]) => n));
  return `<div class="barras">${pares.map(([nome, n]) => `
    <div class="barra-l">
      <div class="barra-l__topo">
        <span class="barra-l__nome">${escapar(nome)}</span>
        <span class="barra-l__n">${n}${total ? ` <span style="color:#93a0ac;font-weight:400">de ${total}</span>` : ''}</span>
      </div>
      <div class="barra-l__trilho"><div class="barra-l__cheio" style="width:${(n / maior) * 100}%"></div></div>
    </div>`).join('')}</div>`;
}

function escapar(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
