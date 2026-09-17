/**
 * Monta o RELATÓRIO DE AÇÕES DO R2D.
 *
 * O documento é complementar ao R2D: mostra a EXECUÇÃO do plano. Em nenhum
 * lugar ele se apresenta como um plano novo — o título é "Relatório de Ações",
 * o R2D aparece como a linha de referência acima dele, e a página 1 diz por
 * escrito que o arquivo original não foi alterado.
 *
 * A estrutura é curta de propósito: um PAINEL que se lê em trinta segundos,
 * as ações realizadas, e o fechamento. Não existe capa — uma folha quase vazia
 * antes do conteúdo só adia a informação que o gestor abriu o arquivo para ver.
 *
 * A paginação das ações é medida no DOM de verdade: cada bloco entra na página,
 * o scrollHeight é comparado com o clientHeight e, se passou, o bloco volta e
 * abre página nova. Estimar altura por contagem de caracteres erra sempre que
 * a ação tem foto — e é justamente aí que o estouro apareceria.
 */

import { estado, INDICADORES, acoesEmOrdem, execucao, porCategoria, cobertura,
  ultimoIndicador, penultimoIndicador, acharItemDoPlano, totalDeFotos } from './estado.js';
import { SIMBOLO, MARCA, SLOGAN } from './marca.js';
import { esc, escLinhas, dataCurta, num, pct, pctSinal, periodoPorExtenso } from './ui.js';
import { linhaEvolucao, barrasCategoria } from './graficos.js';
import { db, comoDataUrl } from './db.js';

/** Quantos itens de cada lista do plano cabem na banda do painel. */
const ITENS_NO_PAINEL = 4;

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
/* Montagem                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {HTMLElement} palco container já no DOM (pode estar fora da vista)
 * @returns {Promise<HTMLElement[]>} páginas na ordem
 */
export async function montarRelatorio(palco) {
  palco.innerHTML = '';
  const p = estado.projeto;
  const fotos = await carregarFotos();
  const paginas = [paginaPainel(p)];

  // Ações e fechamento vão num fluxo só, sem quebra de página forçada entre
  // eles: o fechamento começa onde a última ação terminou, se couber. Forçar
  // a quebra rendia uma folha com uma ação e três quartos de papel em branco.
  const corrida = [
    ...acoesEmOrdem().map((a, i) => blocoDeAcao(a, i + 1, fotos)),
    ...blocosDeFechamento(p),
  ];
  if (corrida.length) {
    const criar = () => paginaVazia({ rotulo: '', sub: cabSub(p) });
    paginar(corrida, criar, palco).forEach(({ pg, corpo }) => {
      // o título de cada página sai do primeiro bloco que ela recebeu
      const primeiro = corpo.firstElementChild?.dataset.secao;
      pg.querySelector('.pg__cab-tit').textContent =
        primeiro === 'fecho' ? 'Resultados e próximos passos' : 'Ações realizadas';
      paginas.push(pg);
    });
  }

  // as paginadas já estão no palco; as fixas ainda não — remonta na ordem
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
/* PÁGINA 1 — PAINEL                                                   */
/* ================================================================== */

function paginaPainel(p) {
  const { pg, corpo } = paginaVazia({ rotulo: '', sub: '', classe: 'pg--painel' });
  pg.querySelector('.pg__cab').remove();   // o masthead faz esse papel aqui

  corpo.innerHTML = masthead(p)
    + faixaDeNumeros(p)
    + linhaDeExecucao()
    + graficosDeEvolucao(p)
    + bandaDoPlano(p)
    + tiraDeCobertura()
    + notaDaFonte(p);
  return pg;
}

function masthead(p) {
  const periodo = p.periodoRotulo || periodoPorExtenso(p.periodoInicio, p.periodoFim);
  const linha = [periodo, p.representante].filter(Boolean);
  return `
    <header class="mast">
      <div class="marca">${MARCA}</div>
      <div class="mast__meio">
        <div class="mast__rot">R2D — Plano de ação${p.produto ? ` · ${esc(p.produto)}` : ''}</div>
        <h1 class="mast__h">Relatório de Ações</h1>
        <div class="mast__sub">${linha.length
          ? `<b>${esc(linha[0])}</b>${linha[1] ? ` · ${esc(linha[1])}` : ''}`
          : 'Acompanhamento da execução do plano de ação.'}</div>
      </div>
      <div class="mast__dir">
        ${p.logoProduto ? `<img class="mast__logo" src="${p.logoProduto}" alt="${esc(p.produto)}">` : ''}
      </div>
    </header>`;
}

function faixaDeNumeros(p) {
  const ultimo = ultimoIndicador();
  const anterior = penultimoIndicador();

  const deIndicador = (d) => {
    const v = ultimo?.[d.chave];
    const a = anterior?.[d.chave];
    const tem = v !== '' && v != null;
    const temDelta = tem && a !== '' && a != null;
    const delta = temDelta ? Number(v) - Number(a) : null;
    const classe = delta == null ? 'igual' : delta > 0.05 ? 'sobe' : delta < -0.05 ? 'desce' : 'igual';
    const seta = delta == null ? '' : delta > 0.05 ? '▲ ' : delta < -0.05 ? '▼ ' : '● ';
    return item(
      d.nome,
      tem ? (d.sinal ? pctSinal(v) : pct(v)) : '—',
      temDelta
        ? `<div class="faixa__delta faixa__delta--${classe}">${seta}${num(Math.abs(delta), 1)} p.p.</div>`
        : '',
      !tem,
    );
  };

  const item = (rot, val, pe = '', fraco = false) => `
    <div class="faixa__item">
      <div class="faixa__val${fraco ? ' faixa__val--fraco' : ''}">${val}</div>
      <div class="faixa__rot">${esc(rot)}</div>
      ${pe}
    </div>`;

  return `<div class="faixa">
    ${INDICADORES.map(deIndicador).join('')}
    ${item('Ações realizadas', String(p.acoes.length))}
    ${item('Evidências', String(totalDeFotos()))}
  </div>`;
}

function linhaDeExecucao() {
  const e = execucao();
  if (e.pct == null) {
    return `<div class="exec-l">
      <div class="exec-l__rot">Execução do plano</div>
      <div class="exec-l__txt" style="padding-left:0;white-space:normal;color:#93a0ac">
        O R2D não informou o total de ações previstas, então o percentual não é calculado.</div>
    </div>`;
  }
  return `<div class="exec-l">
    <div class="exec-l__rot">Execução do plano</div>
    <div class="exec-l__trilho"><div class="exec-l__cheio" style="width:${Math.min(e.pct, 100)}%"></div></div>
    <div class="exec-l__txt"><b>${num(Math.min(e.pct, 999), 1)}%</b>
      &nbsp;·&nbsp; ${e.feitas} de ${e.previstas} ações previstas</div>
  </div>`;
}

function graficosDeEvolucao(p) {
  const graficos = INDICADORES.map((d) => {
    const svg = linhaEvolucao(
      p.indicadores.map((i) => ({ rotulo: i.rotulo, valor: i[d.chave] })),
      { sinal: d.sinal, nome: d.nome },
    );
    return svg ? `<div class="grafico"><div class="grafico__tit">${esc(d.nome)}</div>${svg}</div>` : '';
  }).join('');
  return graficos ? `<div class="graficos">${graficos}</div>` : '';
}

function bandaDoPlano(p) {
  const plano = p.plano;
  const colunas = [
    ['Objetivo do plano', plano.objetivos],
    ['Desafios e causa raiz', plano.desafios],
    ['Estratégia', plano.estrategias],
  ].filter(([, itens]) => (itens || []).length);

  if (!colunas.length) {
    // sem plano lido, a banda mostra o que existir de contexto — ou nada
    return plano.contexto
      ? `<div class="plano-b"><div class="plano-b__cab">O que o R2D previa</div>
           <div style="font-size:9pt;line-height:1.45">${escLinhas(recortar(plano.contexto, 420))}</div></div>`
      : '';
  }

  return `<div class="plano-b">
    <div class="plano-b__cab">O que o R2D previa</div>
    ${plano.contexto ? `<div style="font-size:8.6pt;line-height:1.45;color:#55636f;margin-bottom:4mm;
      padding-bottom:3.5mm;border-bottom:.2mm solid #c6d4e3">${esc(recortar(plano.contexto, 300))}</div>` : ''}
    <div class="plano-b__cols">
      ${colunas.map(([titulo, itens]) => {
        const mostra = itens.slice(0, ITENS_NO_PAINEL);
        const sobra = itens.length - mostra.length;
        return `<div class="plano-b__col">
          <div class="plano-b__tit">${esc(titulo)}</div>
          <ul class="plano-b__lista">
            ${mostra.map((i) => `<li><span class="plano-b__sig">${esc(i.sigla)}</span>${esc(recortar(i.texto, 130))}</li>`).join('')}
          </ul>
          ${sobra > 0 ? `<div class="plano-b__mais">e mais ${sobra} no R2D original.</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/**
 * Planejado → executado, item a item. É a pergunta que o gestor faz primeiro,
 * então ela fica no painel e não numa página lá adiante.
 */
function tiraDeCobertura() {
  const cob = cobertura();
  if (!cob.length) return '';
  const cobertos = cob.filter((c) => c.quantas > 0).length;

  return `<div class="cobre">
    <div class="cobre__cab">
      <span class="cobre__tit">Planejado → executado</span>
      <span class="cobre__resumo"><b>${cobertos} de ${cob.length}</b>
        ${cob.length === 1 ? 'item do plano com ação registrada' : 'itens do plano com ação registrada'}</span>
    </div>
    <div class="cobre__fichas">
      ${cob.map((c) => `<span class="cobre__f${c.quantas ? '' : ' cobre__f--zero'}" title="${esc(c.item.texto)}">
        <span class="cobre__sig">${esc(c.item.sigla)}</span>
        <span class="cobre__n">${c.quantas}</span></span>`).join('')}
    </div>
  </div>`;
}

function notaDaFonte(p) {
  const r = p.r2d;

  const fonte = r.nomeArquivo
    ? `Fonte: <strong>${esc(r.nomeArquivo)}</strong>${r.paginas ? ` · ${r.paginas} ${r.paginas === 1 ? 'página' : 'páginas'}` : ''}${r.enviadoEm ? ` · enviado em ${esc(dataCurta(r.enviadoEm))}` : ''}. O arquivo original não foi modificado.`
    : 'Plano informado manualmente pelo representante. Nenhum R2D foi alterado.';

  return `<div class="nota-fonte">${fonte}</div>`;
}

/* ================================================================== */
/* PÁGINAS 2+ — AÇÕES REALIZADAS                                       */
/* ================================================================== */

function blocoDeAcao(acao, n, fotos) {
  const vinculos = acao.vinculos.map(acharItemDoPlano).filter(Boolean);
  const comFoto = acao.fotos.filter((f) => fotos.has(f.id));
  const temMeta = acao.local || vinculos.length;

  return elemento(`
    <article class="acao" data-secao="acoes">
      <div class="acao__cab">
        <span class="acao__data">${esc(dataCurta(acao.data))}</span>
        <h3 class="acao__tit">${esc(acao.titulo || `Ação ${n}`)}</h3>
        <span class="acao__cat">${esc(acao.categoria)}</span>
      </div>

      ${temMeta ? `<div class="acao__meta">
        ${acao.local ? `<span><b>Local</b>${esc(acao.local)}</span>` : ''}
        ${vinculos.length ? `<span><b>R2D</b>${vinculos
          .map((v) => `<span class="sig" title="${esc(v.texto)}">${esc(v.sigla)}</span>`).join('')}</span>` : ''}
      </div>` : ''}

      ${acao.objetivo ? `<div class="acao__desc"><strong>Objetivo.</strong> ${escLinhas(acao.objetivo)}</div>` : ''}
      ${acao.descricao ? `<div class="acao__desc">${escLinhas(acao.descricao)}</div>` : ''}

      ${(acao.resultado || acao.proximoPasso) ? `<div class="acao__campos">
        ${acao.resultado ? `<div class="acao__campo">
          <div class="acao__campo-rot">Resultado</div>
          <div class="acao__campo-val">${escLinhas(acao.resultado)}</div></div>` : ''}
        ${acao.proximoPasso ? `<div class="acao__campo">
          <div class="acao__campo-rot">Próximo passo</div>
          <div class="acao__campo-val">${escLinhas(acao.proximoPasso)}</div></div>` : ''}
      </div>` : ''}

      ${acao.observacoes ? `<div class="acao__campo" style="padding:0;margin-bottom:2.4mm">
        <div class="acao__campo-rot">Observações</div>
        <div class="acao__campo-val">${escLinhas(acao.observacoes)}</div></div>` : ''}

      ${comFoto.length ? `<div class="evid">${comFoto.map((f) => `
        <div class="evid__item">
          <div class="evid__foto" style="background-image:url('${fotos.get(f.id)}')"></div>
          ${f.legenda ? `<div class="evid__legenda">${esc(f.legenda)}</div>` : ''}
        </div>`).join('')}</div>` : ''}
    </article>`);
}

/* ================================================================== */
/* ÚLTIMA PÁGINA — RESULTADOS E PRÓXIMOS PASSOS                        */
/* ================================================================== */

function blocosDeFechamento(p) {
  const f = p.fechamento;
  const temTexto = f.resumo || [f.entregas, f.pendencias, f.proximosPassos, f.atencao].some((l) => (l || []).length);
  const categorias = porCategoria();
  if (!temTexto && !categorias.length) return [];

  // O título anda junto do primeiro conteúdo, num elemento só: separados, a
  // paginação podia deixar o cabeçalho sozinho no pé de uma página.
  const blocos = [elemento(`
    <div data-secao="fecho">
      <div class="tit-secao">
        <div class="tit-secao__rot">Fechamento do período</div>
        <h2 class="tit-secao__h">Resultados e próximos passos</h2>
        <p class="tit-secao__sub">O que a execução do R2D entregou até aqui e o que segue em andamento.</p>
      </div>
      ${f.resumo ? `<div class="destaque">
        <div class="destaque__rot">Resumo executivo</div>
        <div class="destaque__txt">${escLinhas(f.resumo)}</div>
      </div>` : ''}
    </div>`)];

  // A cobertura do plano NÃO se repete aqui: ela já é a tira de fichas do
  // painel. Repetir a mesma informação em duas páginas é o que fazia o
  // relatório parecer longo sem dizer mais nada.

  if ((f.entregas || []).length || (f.pendencias || []).length) {
    blocos.push(elemento(`<div class="colunas" data-secao="fecho" style="margin-bottom:8mm">
      <div class="coluna">${listaSimples('Principais entregas', f.entregas)}</div>
      <div class="coluna">${listaSimples('Pendências', f.pendencias)}</div>
    </div>`));
  }

  if ((f.proximosPassos || []).length || (f.atencao || []).length) {
    blocos.push(elemento(`<div class="colunas" data-secao="fecho" style="margin-bottom:8mm">
      <div class="coluna">${(f.proximosPassos || []).length ? `<div class="bloco">
        <div class="bloco__tit">Próximos passos</div>
        <ol class="passos">${f.proximosPassos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      </div>` : ''}</div>
      <div class="coluna">${(f.atencao || []).length ? `<div class="bloco">
        <div class="bloco__tit">Pontos de atenção</div>
        <ol class="passos atencao">${f.atencao.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      </div>` : ''}</div>
    </div>`));
  }

  if (categorias.length) {
    blocos.push(elemento(`<div class="bloco" data-secao="fecho">
      <div class="bloco__tit">Ações por tipo</div>
      ${barrasCategoria(categorias, { total: p.acoes.length })}
    </div>`));
  }

  return blocos;
}

function listaSimples(titulo, itens) {
  if (!itens || !itens.length) return '';
  return `<div class="bloco">
    <div class="bloco__tit">${esc(titulo)}</div>
    <ul class="lista">${itens.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </div>`;
}

/* ------------------------------------------------------------------ */

function recortar(t, max) {
  const s = String(t || '').trim();
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
