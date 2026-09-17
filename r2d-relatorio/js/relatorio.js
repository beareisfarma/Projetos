/**
 * Monta o RELATÓRIO DE AÇÕES DO R2D.
 *
 * O documento é complementar ao R2D: mostra a EXECUÇÃO do plano. Em nenhum
 * lugar ele se apresenta como um plano novo — o título é fixo e a página de
 * contexto diz, por escrito, que o R2D original não foi alterado.
 *
 * A paginação é medida no DOM de verdade: cada bloco entra na página, o
 * scrollHeight é comparado com o clientHeight e, se passou, o bloco volta e
 * abre página nova. Estimar altura por contagem de caracteres erra sempre que
 * a ação tem foto — e é justamente aí que o estouro apareceria.
 */

import { estado, INDICADORES, acoesEmOrdem, execucao, porCategoria, cobertura,
  ultimoIndicador, penultimoIndicador, acharItemDoPlano, totalDeFotos } from './estado.js';
import { marcaInstitucional, SLOGAN } from './marca.js';
import { esc, escLinhas, dataCurta, dataLonga, num, pct, pctSinal, periodoPorExtenso } from './ui.js';
import { linhaEvolucao, barrasCategoria } from './graficos.js';
import { db, comoDataUrl } from './db.js';

const MAX_ITENS_CONTEXTO = 6;

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
        ${marcaInstitucional({ assinatura: false })}
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
  const paginas = [];

  paginas.push(capa(p));

  const temPlano = temConteudoDePlano(p.plano);
  if (temPlano) paginas.push(paginaContexto(p));

  if (temIndicadores(p)) paginas.push(paginaIndicadores(p));

  paginas.push(paginaExecucao(p));

  const acoes = acoesEmOrdem();
  if (acoes.length) {
    const blocos = acoes.map((a, i) => blocoDeAcao(a, i + 1, fotos));
    const criar = () => paginaVazia({ rotulo: 'Ações realizadas', sub: cabSub(p), classe: 'pg--acoes' });
    paginar(blocos, criar, palco).forEach(({ pg }) => paginas.push(pg));
  }

  const blocosFim = blocosDeFechamento(p);
  if (blocosFim.length) {
    const criar = () => paginaVazia({ rotulo: 'Resultados e próximos passos', sub: cabSub(p) });
    paginar(blocosFim, criar, palco).forEach(({ pg }) => paginas.push(pg));
  }

  // as páginas paginadas já estão no palco; as fixas ainda não
  palco.innerHTML = '';
  paginas.forEach((pg) => palco.appendChild(pg));

  const total = paginas.length;
  paginas.forEach((pg, i) => {
    const marca = pg.querySelector('[data-num]');
    if (marca) marca.textContent = `${i + 1} / ${total}`;
  });

  // dá o primeiro título de "Ações realizadas" só na primeira página delas
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

/* --- página 1: capa ---------------------------------------------------- */

function capa(p) {
  const periodo = p.periodoRotulo || periodoPorExtenso(p.periodoInicio, p.periodoFim) || '—';
  return elemento(`
    <section class="pg pg--capa">
      <div class="capa__topo">
        ${marcaInstitucional()}
        ${p.logoProduto
          ? `<img class="capa__logo-produto" src="${p.logoProduto}" alt="${esc(p.produto)}">`
          : '<div></div>'}
      </div>

      <div class="capa__regua"></div>
      <div class="capa__bloco">
        <div class="capa__rot">Execução do plano de ação</div>
        <h1 class="capa__tit">Relatório de Ações<br>do R2D</h1>
        ${p.produto ? `<div class="capa__produto">${esc(p.produto)}</div>` : ''}
      </div>

      <div class="capa__meta">
        <div class="capa__meta-item">
          <div class="capa__meta-rot">Representante</div>
          <div class="capa__meta-val">${esc(p.representante || '—')}</div>
        </div>
        <div class="capa__meta-item">
          <div class="capa__meta-rot">Período do R2D</div>
          <div class="capa__meta-val">${esc(periodo)}</div>
        </div>
        <div class="capa__meta-item">
          <div class="capa__meta-rot">Emitido em</div>
          <div class="capa__meta-val">${esc(dataLonga(hoje()))}</div>
        </div>
      </div>

      <div class="capa__pe">
        <span>Apsen · ${esc(SLOGAN)}</span>
        <span>Documento complementar ao R2D</span>
      </div>
    </section>`);
}

function hoje() {
  const d = new Date(); const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/* --- página 2: contexto do R2D ---------------------------------------- */

function temConteudoDePlano(plano) {
  return Boolean(plano.contexto)
    || ['objetivos', 'estrategias', 'desafios', 'acoesPlanejadas'].some((k) => (plano[k] || []).length);
}

function paginaContexto(p) {
  const { pg, corpo } = paginaVazia({ rotulo: 'Contexto do R2D', sub: cabSub(p) });
  const plano = p.plano;
  const chamada = plano.contexto || plano.objetivos[0]?.texto || '';

  corpo.innerHTML = `
    <div class="tit-secao">
      <div class="tit-secao__rot">Documento-base</div>
      <h2 class="tit-secao__h">O que o R2D previa</h2>
      <p class="tit-secao__sub">Resumo do plano de ação que estava em execução no período.
        O R2D original permanece como foi emitido — este relatório não o altera.</p>
    </div>
    ${chamada ? `<div class="chamada">${escLinhas(recortar(chamada, 380))}</div>` : ''}
    <div class="colunas">
      <div class="coluna">
        ${blocoLista('Objetivos', plano.objetivos)}
        ${blocoLista('Desafios e causa raiz', plano.desafios)}
      </div>
      <div class="coluna">
        ${blocoLista('Estratégias', plano.estrategias)}
        ${blocoLista('Ações planejadas', plano.acoesPlanejadas)}
      </div>
    </div>
    ${notaDaFonte(p)}`;
  return pg;
}

function blocoLista(titulo, itens) {
  if (!itens || !itens.length) return '';
  const mostra = itens.slice(0, MAX_ITENS_CONTEXTO);
  const sobra = itens.length - mostra.length;
  return `
    <div class="bloco">
      <div class="bloco__tit">${esc(titulo)}</div>
      <ul class="lista">
        ${mostra.map((i) => `<li><span class="lista__sig">${esc(i.sigla)}</span>${esc(recortar(i.texto, 190))}</li>`).join('')}
      </ul>
      ${sobra > 0 ? `<div style="font-size:7.5pt;color:#93a0ac;margin-top:2mm">
        e mais ${sobra} ${sobra === 1 ? 'item' : 'itens'} no R2D original.</div>` : ''}
    </div>`;
}

function notaDaFonte(p) {
  const r = p.r2d;
  if (!r.nomeArquivo) return '';
  const como = { ia: 'leitura assistida por IA', local: 'leitura automática', manual: 'preenchimento manual' }[r.origemLeitura] || 'leitura automática';
  return `<div class="nota-fonte">
    Fonte: <strong>${esc(r.nomeArquivo)}</strong>${r.paginas ? ` · ${r.paginas} ${r.paginas === 1 ? 'página' : 'páginas'}` : ''}${r.enviadoEm ? ` · enviado em ${esc(dataCurta(r.enviadoEm))}` : ''} · ${esc(como)}, revisada pelo representante.
    O arquivo original não foi modificado.</div>`;
}

/* --- página 3: indicadores -------------------------------------------- */

function temIndicadores(p) {
  return p.indicadores.some((i) => INDICADORES.some((d) => i[d.chave] !== '' && i[d.chave] != null));
}

function paginaIndicadores(p) {
  const { pg, corpo } = paginaVazia({ rotulo: 'Indicadores', sub: cabSub(p) });
  const ultimo = ultimoIndicador();
  const anterior = penultimoIndicador();

  const kpis = INDICADORES.map((d) => {
    const v = ultimo?.[d.chave];
    const a = anterior?.[d.chave];
    const temDelta = v !== '' && v != null && a !== '' && a != null;
    const delta = temDelta ? Number(v) - Number(a) : null;
    const classe = delta == null ? 'igual' : delta > 0.05 ? 'sobe' : delta < -0.05 ? 'desce' : 'igual';
    const seta = delta == null ? '' : delta > 0.05 ? '▲ ' : delta < -0.05 ? '▼ ' : '● ';
    return `
      <div class="kpi"><div class="kpi__int">
        <div class="kpi__rot">${esc(d.nome)}</div>
        <div class="kpi__val">${d.sinal ? pctSinal(v) : pct(v)}</div>
        ${temDelta
          ? `<div class="kpi__delta kpi__delta--${classe}">${seta}${num(Math.abs(delta), 1)} p.p. vs. ${esc(anterior.rotulo)}</div>`
          : '<div class="kpi__delta kpi__delta--igual">sem período anterior</div>'}
        <div class="kpi__pe">posição em ${esc(ultimo?.rotulo || '—')}</div>
      </div></div>`;
  }).join('');

  const graficos = INDICADORES.map((d) => {
    const svg = linhaEvolucao(
      p.indicadores.map((i) => ({ rotulo: i.rotulo, valor: i[d.chave] })),
      { sinal: d.sinal, nome: d.nome },
    );
    if (!svg) return '';
    return `<div class="grafico"><div class="grafico__tit">${esc(d.nome)}</div>${svg}</div>`;
  }).join('');

  corpo.innerHTML = `
    <div class="tit-secao">
      <div class="tit-secao__rot">Acompanhamento</div>
      <h2 class="tit-secao__h">Indicadores do produto</h2>
      <p class="tit-secao__sub">Posição no período mais recente e evolução ao longo dos períodos informados.</p>
    </div>
    <div class="kpis">${kpis}</div>
    ${graficos ? `<div class="graficos">${graficos}</div>` : ''}
    ${tabelaDeSerie(p)}
    ${(p.plano.metas || []).length ? `<div class="nota-fonte">
      <strong>Metas registradas no R2D:</strong>
      ${p.plano.metas.slice(0, 4).map((m) => esc(m.texto)).join(' · ')}</div>` : ''}`;
  return pg;
}

function tabelaDeSerie(p) {
  const linhas = p.indicadores.filter((i) => INDICADORES.some((d) => i[d.chave] !== '' && i[d.chave] != null));
  if (linhas.length < 2) return '';
  return `
    <table class="serie">
      <thead><tr><th>Período</th>${INDICADORES.map((d) => `<th>${esc(d.nome)}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map((l) => `<tr>
        <td>${esc(l.rotulo)}</td>
        ${INDICADORES.map((d) => `<td>${d.sinal ? pctSinal(l[d.chave]) : pct(l[d.chave])}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table>`;
}

/* --- página 4: execução do plano -------------------------------------- */

function paginaExecucao(p) {
  const { pg, corpo } = paginaVazia({ rotulo: 'Execução do plano', sub: cabSub(p) });
  const e = execucao();
  const cob = cobertura();
  const semAcao = cob.filter((c) => c.quantas === 0);

  const medida = e.pct == null
    ? `<div class="exec__pct">
         <div class="exec__pct-val">${e.feitas}</div>
         <div class="exec__pct-rot">Ações realizadas</div>
       </div>
       <div class="exec__lados"><div class="exec__lado">
         <div class="exec__lado-val" style="font-size:9.5pt;font-weight:400;color:#93a0ac;line-height:1.4">
           O R2D não informou o total de ações previstas,<br>então o percentual de execução não é calculado.</div>
       </div></div>`
    : `<div class="exec__pct">
         <div class="exec__pct-val">${num(Math.min(e.pct, 999), 1)}%</div>
         <div class="exec__pct-rot">Execução do plano</div>
       </div>
       <div class="exec__lados">
         <div class="exec__lado">
           <div class="exec__lado-val">${e.previstas}</div>
           <div class="exec__lado-rot">Ações planejadas</div>
         </div>
         <div class="exec__lado">
           <div class="exec__lado-val">${e.feitas}</div>
           <div class="exec__lado-rot">Ações realizadas</div>
         </div>
         <div class="exec__lado">
           <div class="exec__lado-val">${totalDeFotos()}</div>
           <div class="exec__lado-rot">Evidências</div>
         </div>
       </div>`;

  corpo.innerHTML = `
    <div class="tit-secao">
      <div class="tit-secao__rot">Planejado → executado</div>
      <h2 class="tit-secao__h">Execução do plano</h2>
      <p class="tit-secao__sub">Quanto do que estava previsto no R2D foi colocado em prática no período.</p>
    </div>

    <div class="exec">${medida}</div>
    ${e.pct != null ? `<div class="trilho"><div class="trilho__cheio" style="width:${Math.min(e.pct, 100)}%"></div></div>` : ''}

    <div class="colunas">
      <div class="coluna">
        <div class="bloco">
          <div class="bloco__tit">Ações por tipo</div>
          ${barrasCategoria(porCategoria(), { total: e.feitas }) || '<div class="vazio-doc">Sem ações registradas.</div>'}
        </div>
      </div>
      <div class="coluna">
        <div class="bloco">
          <div class="bloco__tit">Cobertura do plano</div>
          ${cob.length
            ? `<ul class="lista">${cob.slice(0, 9).map((c) => `
                <li><span class="lista__sig">${esc(c.item.sigla)}</span>
                  ${esc(recortar(c.item.texto, 110))}
                  <span style="color:${c.quantas ? '#1163b0' : '#93a0ac'};font-weight:600;white-space:nowrap">
                    &nbsp;· ${c.quantas} ${c.quantas === 1 ? 'ação' : 'ações'}</span></li>`).join('')}</ul>`
            : '<div class="vazio-doc">O R2D lido não trouxe itens para vincular.</div>'}
        </div>
      </div>
    </div>

    ${semAcao.length ? `<div class="nota-fonte">
      <strong>Sem ação registrada até aqui:</strong>
      ${semAcao.slice(0, 6).map((c) => esc(c.item.sigla)).join(', ')}${semAcao.length > 6 ? ` e mais ${semAcao.length - 6}` : ''}.</div>` : ''}`;
  return pg;
}

/* --- páginas 5+: ações realizadas ------------------------------------- */

function blocoDeAcao(acao, n, fotos) {
  const vinculos = acao.vinculos.map(acharItemDoPlano).filter(Boolean);
  const comFoto = acao.fotos.filter((f) => fotos.has(f.id));
  const classeEvid = comFoto.length === 1 ? 'evid--1' : comFoto.length === 2 ? 'evid--2' : '';

  return elemento(`
    <article class="acao">
      <div class="acao__topo">
        <div class="acao__data">${esc(dataCurta(acao.data))}</div>
        <h3 class="acao__tit">${esc(acao.titulo || `Ação ${n}`)}</h3>
        <div class="acao__cat">${esc(acao.categoria)}</div>
      </div>
      <div class="acao__int">
        ${vinculos.length ? `<div class="acao__vinc"><b>R2D</b>&nbsp; ${vinculos
          .map((v) => `${esc(v.sigla)} · ${esc(recortar(v.texto, 130))}`).join(' &nbsp;|&nbsp; ')}</div>` : ''}
        ${acao.local ? `<div class="acao__local"><b>Local</b>${esc(acao.local)}</div>` : ''}
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
        ${acao.observacoes ? `<div class="acao__campo" style="padding:0">
          <div class="acao__campo-rot">Observações</div>
          <div class="acao__campo-val">${escLinhas(acao.observacoes)}</div></div>` : ''}
        ${comFoto.length ? `<div class="evid ${classeEvid}">${comFoto.map((f) => `
          <div class="evid__item">
            <div class="evid__foto" style="background-image:url('${fotos.get(f.id)}')"></div>
            ${f.legenda ? `<div class="evid__legenda">${esc(f.legenda)}</div>` : ''}
          </div>`).join('')}</div>` : ''}
      </div>
    </article>`);
}

/* --- última página: resultados e próximos passos ---------------------- */

function blocosDeFechamento(p) {
  const f = p.fechamento;
  const temAlgo = f.resumo || [f.entregas, f.pendencias, f.proximosPassos, f.atencao].some((l) => (l || []).length);
  if (!temAlgo) return [];

  const blocos = [elemento(`
    <div class="tit-secao">
      <div class="tit-secao__rot">Fechamento do período</div>
      <h2 class="tit-secao__h">Resultados e próximos passos</h2>
      <p class="tit-secao__sub">O que a execução do R2D entregou até aqui e o que segue em andamento.</p>
    </div>`)];

  if (f.resumo) {
    blocos.push(elemento(`<div class="destaque">
      <div class="destaque__rot">Resumo executivo</div>
      <div class="destaque__txt">${escLinhas(f.resumo)}</div>
    </div>`));
  }

  if ((f.entregas || []).length || (f.pendencias || []).length) {
    blocos.push(elemento(`<div class="colunas" style="margin-bottom:8mm">
      <div class="coluna">${listaSimples('Principais entregas', f.entregas)}</div>
      <div class="coluna">${listaSimples('Pendências', f.pendencias)}</div>
    </div>`));
  }

  if ((f.proximosPassos || []).length) {
    blocos.push(elemento(`<div class="bloco">
      <div class="bloco__tit">Próximos passos</div>
      <ol class="passos">${f.proximosPassos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
    </div>`));
  }

  if ((f.atencao || []).length) {
    blocos.push(elemento(`<div class="bloco">
      <div class="bloco__tit">Pontos de atenção</div>
      <ol class="passos atencao">${f.atencao.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
    </div>`));
  }

  return blocos;
}

function listaSimples(titulo, itens) {
  if (!itens || !itens.length) return '';
  return `<div class="bloco">
    <div class="bloco__tit">${esc(titulo)}</div>
    <ul class="lista lista--simples">${itens.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </div>`;
}

/* ------------------------------------------------------------------ */

function recortar(t, max) {
  const s = String(t || '').trim();
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
