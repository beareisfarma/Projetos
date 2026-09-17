/**
 * Monta o RELATÓRIO DE EXECUÇÃO DO R2D.
 *
 * O R2D é o plano, já aprovado com a gerente; este documento é a execução
 * dele. A ordem responde à pergunta da gerente na sequência em que ela a faz:
 *
 *   1. Como o produto está?      → faixa de indicadores (referência → atual)
 *   2. O que o plano queria?     → objetivo e gap, em duas colunas
 *   3. O que você fez?           → ações em ordem cronológica, com fotos
 *   4. E os números, mês a mês?  → gráficos e tabela de evolução
 *
 * A paginação das ações é medida no DOM de verdade: cada bloco entra na
 * página, o scrollHeight é comparado com o clientHeight e, se passou, o bloco
 * volta e abre página nova. Estimar altura por contagem de caracteres erra
 * sempre que a ação tem foto — e é justamente aí que o estouro apareceria.
 */

import { estado, acoesEmOrdem, totalDeFotos, leituraDoIndicador, serieDoIndicador,
  periodosPreenchidos } from './estado.js';
import { SIMBOLO, MARCA, SLOGAN } from './marca.js';
import { esc, escLinhas, dataCurta, valorFmt, variacaoFmt, periodoPorExtenso } from './ui.js';
import { linhaEvolucao } from './graficos.js';
import { db, comoDataUrl } from './db.js';

/* ------------------------------------------------------------------ */
/* Caixa de páginas                                                     */
/* ------------------------------------------------------------------ */

function elemento(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function paginaVazia({ rotulo, sub, classe = '' }) {
  const pg = elemento(`
    <section class="pg ${classe}">
      <header class="pg__cab">
        <div class="marca">${SIMBOLO}</div>
        <div class="pg__cab-dir">
          <div class="pg__cab-tit">${esc(rotulo)}</div>
          <div class="pg__cab-sub">${esc(sub)}</div>
        </div>
      </header>
      <div class="pg__corpo"></div>
      <footer class="pg__rodape">
        <span>APSEN · ${esc(SLOGAN)}</span>
        <span class="pg__num" data-num></span>
      </footer>
    </section>`);
  return { pg, corpo: pg.querySelector('.pg__corpo') };
}

/**
 * Distribui blocos por páginas, medindo de verdade.
 * `palco` precisa estar no documento e com layout — sem isso scrollHeight é 0.
 */
function paginar(blocos, criarPagina, palco) {
  const paginas = [];
  let atual = null;

  for (const bloco of blocos) {
    if (!atual) { atual = criarPagina(); palco.appendChild(atual.pg); paginas.push(atual); }
    atual.corpo.appendChild(bloco);

    if (atual.corpo.scrollHeight > atual.corpo.clientHeight + 1) {
      atual.corpo.removeChild(bloco);
      if (!atual.corpo.children.length) {
        // bloco sozinho já não cabe (ação enorme): deixa nesta página e segue
        atual.corpo.appendChild(bloco);
        atual = null;
        continue;
      }
      atual = criarPagina(); palco.appendChild(atual.pg); paginas.push(atual);
      atual.corpo.appendChild(bloco);
    }
  }
  return paginas;
}

/* ------------------------------------------------------------------ */

/**
 * @param {HTMLElement} palco container já no DOM (pode estar fora da vista)
 * @returns {Promise<HTMLElement[]>} páginas na ordem
 */
export async function montarRelatorio(palco) {
  palco.innerHTML = '';
  const p = estado.projeto;
  const fotos = await carregarFotos();

  // Tudo num fluxo só, sem quebra de página forçada em lugar nenhum: as ações
  // começam na própria página de abertura, se couber, e os gráficos começam
  // onde a última ação terminou. Forçar as quebras deixava meia folha em
  // branco embaixo do cabeçalho e no fim das ações.
  const corrida = [
    blocoDeAbertura(p),
    ...acoesEmOrdem().map((a, i) => blocoDeAcao(a, i + 1, fotos)),
    ...blocosDeEvolucao(p),
  ];

  let primeira = true;
  const criar = () => {
    if (primeira) {
      primeira = false;
      // a página de abertura troca o cabeçalho corrido pelo masthead
      const pagina = paginaVazia({ rotulo: '', sub: '', classe: 'pg--abertura' });
      pagina.pg.querySelector('.pg__cab').remove();
      return pagina;
    }
    return paginaVazia({ rotulo: '', sub: cabSub(p) });
  };

  const paginas = paginar(corrida, criar, palco).map(({ pg, corpo }) => {
    const titulo = pg.querySelector('.pg__cab-tit');
    if (titulo) {
      const secao = corpo.firstElementChild?.dataset.secao;
      titulo.textContent = secao === 'evolucao' ? 'Evolução dos indicadores' : 'Ações realizadas';
    }
    return pg;
  });

  palco.innerHTML = '';
  paginas.forEach((pg) => palco.appendChild(pg));
  paginas.forEach((pg, i) => {
    const marca = pg.querySelector('[data-num]');
    if (marca) marca.textContent = `${i + 1} / ${paginas.length}`;
  });

  return paginas;
}

function cabSub(p) {
  return [p.produto, p.periodoRotulo || periodoPorExtenso(p.periodoInicio, p.periodoFim)]
    .filter(Boolean).join(' · ');
}

async function carregarFotos() {
  const mapa = new Map();
  for (const acao of estado.projeto.acoes) {
    for (const foto of acao.fotos) {
      const blob = await db.lerFoto(foto.id);
      // data: URL e não blob: — o clone do DOM feito na exportação perde o blob
      if (blob) mapa.set(foto.id, await comoDataUrl(blob));
    }
  }
  return mapa;
}

/* ================================================================== */
/* PÁGINA 1 — abertura                                                 */
/* ================================================================== */

function blocoDeAbertura(p) {
  return elemento(`<div data-secao="abertura">
    ${masthead(p)}${faixaDeNumeros(p)}${bandaDoPlano(p)}${notaDaFonte(p)}
  </div>`);
}

function masthead(p) {
  const periodo = p.periodoRotulo || periodoPorExtenso(p.periodoInicio, p.periodoFim);
  const linha = [periodo, p.representante].filter(Boolean);
  return `
    <header class="mast">
      <div class="marca">${MARCA}</div>
      <div class="mast__meio">
        <div class="mast__rot">R2D — Plano de ação${p.produto ? ` · ${esc(p.produto)}` : ''}</div>
        <h1 class="mast__h">Relatório de Execução</h1>
        <div class="mast__sub">${linha.length
          ? `<b>${esc(linha[0])}</b>${linha[1] ? ` · ${esc(linha[1])}` : ''}`
          : 'Acompanhamento da execução do plano de ação.'}</div>
      </div>
      <div class="mast__dir">
        ${p.logoProduto ? `<img class="mast__logo" src="${p.logoProduto}" alt="${esc(p.produto)}">` : ''}
      </div>
    </header>`;
}

/** Como o produto está: referência do início do plano → posição atual. */
function faixaDeNumeros(p) {
  const defs = p.indicadores.definicoes.filter((d) => d.nome.trim());
  const itens = [];

  for (const d of defs) {
    const l = leituraDoIndicador(d);
    if (!l) continue;
    const v = variacaoFmt(l.variacao, d.unidade);
    itens.push(`
      <div class="faixa__item">
        <div class="faixa__val">${esc(valorFmt(l.atual.valor, d.unidade))}</div>
        <div class="faixa__rot">${esc(d.nome)}</div>
        <div class="faixa__pe">${esc(l.atual.rotulo)}</div>
        ${v ? `<div class="faixa__delta faixa__delta--${v.sentido}">${esc(v.texto)}
                 <span class="faixa__ref">vs. ${esc(l.referencia.rotulo)}
                   (${esc(valorFmt(l.referencia.valor, d.unidade))})</span></div>`
            : '<div class="faixa__delta faixa__delta--igual">sem referência anterior</div>'}
      </div>`);
  }

  const simples = (rot, val, pe) => `
    <div class="faixa__item">
      <div class="faixa__val">${esc(val)}</div>
      <div class="faixa__rot">${esc(rot)}</div>
      <div class="faixa__pe">${esc(pe)}</div>
    </div>`;

  itens.push(simples('Ações realizadas', String(p.acoes.length), 'no período'));
  itens.push(simples('Evidências', String(totalDeFotos()), 'fotos anexadas'));

  return `<div class="faixa">${itens.join('')}</div>`;
}

/** O que o plano queria: objetivo e gap. */
function bandaDoPlano(p) {
  const { objetivo, gap, acoesPrevistas } = p.plano;
  if (!objetivo && !gap && !(acoesPrevistas || []).length) return '';

  const coluna = (titulo, texto) => texto
    ? `<div class="plano-b__col">
         <div class="plano-b__tit">${esc(titulo)}</div>
         <div class="plano-b__txt">${escLinhas(recortar(texto, 420))}</div>
       </div>`
    : '';

  const previstas = (acoesPrevistas || []).slice(0, 6);

  return `<div class="plano-b">
    <div class="plano-b__cab">O que o R2D previa</div>
    <div class="plano-b__cols">
      ${coluna('Objetivo do plano', objetivo)}
      ${coluna('Gap identificado', gap)}
    </div>
    ${previstas.length ? `<div class="plano-b__prev">
      <div class="plano-b__tit">Ações previstas no plano</div>
      <ul class="plano-b__lista">${previstas.map((t) => `<li>${esc(recortar(t, 140))}</li>`).join('')}</ul>
      ${acoesPrevistas.length > previstas.length
        ? `<div class="plano-b__mais">e mais ${acoesPrevistas.length - previstas.length} no R2D original.</div>` : ''}
    </div>` : ''}
  </div>`;
}

function notaDaFonte(p) {
  const r = p.r2d;
  return `<div class="nota-fonte">${r.nomeArquivo
    ? `Fonte: <strong>${esc(r.nomeArquivo)}</strong>${r.paginas ? ` · ${r.paginas} ${r.paginas === 1 ? 'página' : 'páginas'}` : ''}${r.enviadoEm ? ` · enviado em ${esc(dataCurta(r.enviadoEm))}` : ''}. O R2D aprovado não foi modificado.`
    : 'Contexto informado pelo representante. Nenhum R2D foi alterado.'}</div>`;
}

/* ================================================================== */
/* PÁGINAS 2+ — ações realizadas                                       */
/* ================================================================== */

function blocoDeAcao(acao, n, fotos) {
  const comFoto = acao.fotos.filter((f) => fotos.has(f.id));

  return elemento(`
    <article class="acao" data-secao="acoes">
      <div class="acao__cab">
        <span class="acao__data">${esc(dataCurta(acao.data))}</span>
        <h3 class="acao__tit">${esc(acao.titulo || `Ação ${n}`)}</h3>
      </div>
      ${acao.local ? `<div class="acao__local"><b>Local</b>${esc(acao.local)}</div>` : ''}
      ${acao.resultado ? `<div class="acao__desc">${escLinhas(acao.resultado)}</div>` : ''}
      ${comFoto.length ? `<div class="evid">${comFoto.map((f) => `
        <div class="evid__item">
          <div class="evid__foto" style="background-image:url('${fotos.get(f.id)}')"></div>
          ${f.legenda ? `<div class="evid__legenda">${esc(f.legenda)}</div>` : ''}
        </div>`).join('')}</div>` : ''}
    </article>`);
}

/* ================================================================== */
/* ÚLTIMAS PÁGINAS — evolução dos indicadores                          */
/* ================================================================== */

function blocosDeEvolucao(p) {
  const defs = p.indicadores.definicoes.filter((d) => d.nome.trim());
  const periodos = periodosPreenchidos();
  const comLeitura = defs.filter((d) => leituraDoIndicador(d));
  if (!comLeitura.length) return [];

  // O título anda junto dos gráficos, num elemento só: separados, a paginação
  // podia deixar o cabeçalho sozinho no pé de uma página.
  const graficos = comLeitura.map((d) => {
    const svg = linhaEvolucao(serieDoIndicador(d), { unidade: d.unidade, nome: d.nome });
    return svg ? `<div class="grafico"><div class="grafico__tit">${esc(d.nome)}</div>${svg}</div>` : '';
  }).filter(Boolean).join('');

  const blocos = [elemento(`
    <div data-secao="evolucao">
      <div class="tit-secao">
        <div class="tit-secao__rot">Acompanhamento do produto</div>
        <h2 class="tit-secao__h">Evolução dos indicadores</h2>
        <p class="tit-secao__sub">Valores informados pelo representante a partir dos relatórios da empresa,
          do início do plano até o período mais recente.</p>
      </div>
      ${graficos ? `<div class="graficos">${graficos}</div>` : ''}
    </div>`)];

  if (periodos.length) {
    blocos.push(elemento(`<div data-secao="evolucao">
      <table class="serie">
        <thead><tr><th>Período</th>${comLeitura.map((d) => `<th>${esc(d.nome)}</th>`).join('')}</tr></thead>
        <tbody>${periodos.map((linha) => `<tr${linha.referencia ? ' class="serie__ref"' : ''}>
          <td>${esc(linha.rotulo)}${linha.referencia ? ' <span class="serie__marca">referência</span>' : ''}</td>
          ${comLeitura.map((d) => `<td>${esc(valorFmt(linha.valores[d.id], d.unidade))}</td>`).join('')}
        </tr>`).join('')}</tbody>
      </table>
    </div>`));
  }

  return blocos;
}

/* ------------------------------------------------------------------ */

function recortar(t, max) {
  const s = String(t || '').trim();
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
