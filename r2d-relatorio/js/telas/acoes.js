/**
 * Etapa 3 — registro das ações e linha do tempo.
 *
 * É o coração da ferramenta: o que o representante de fato fez para executar
 * o R2D. A data e a hora do CADASTRO são preenchidas pelo sistema; a data da
 * AÇÃO é da pessoa — não são a mesma coisa e o relatório usa a segunda, senão
 * uma ação de terça lançada no sábado apareceria no sábado.
 */

import { estado, mudou, CATEGORIAS, acaoVazia, acoesEmOrdem, totalDeFotos,
  execucao, itensDoPlano, acharItemDoPlano } from '../estado.js';
import { $, $$, esc, escLinhas, dataCurta, diaDaSemana, horaDe, recado, abrirModal, confirmar } from '../ui.js';
import { db, urlDaFoto, esquecerFoto } from '../db.js';
import { prepararFoto } from '../fotos.js';
import { novoId } from '../estado.js';
import { irPara } from '../app.js';

const filtro = { categoria: '', de: '', ate: '', busca: '' };

export function desenhar(raiz) {
  const e = execucao();

  raiz.innerHTML = `
    <div class="secao">
      <div class="numeros" style="margin-bottom:22px">
        ${caixaNumero('Ações realizadas', estado.projeto.acoes.length, e.previstas ? `de ${e.previstas} previstas` : 'no período')}
        ${caixaNumero('Execução do plano', e.pct == null ? '—' : `${e.pct.toFixed(1).replace('.', ',')}%`,
          e.pct == null ? 'informe o total previsto' : 'do que o R2D previa')}
        ${caixaNumero('Evidências', totalDeFotos(), 'fotos anexadas')}
        ${caixaNumero('Itens do plano cobertos', cobertos(), `de ${totalDeItens()} no R2D`)}
      </div>

      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Ações realizadas</h2>
          <p class="secao__desc">Em ordem cronológica. A data e a hora do cadastro ficam registradas automaticamente.</p>
        </div>
        <button class="btn btn--principal btn--grande" type="button" id="b-nova">+ Registrar ação</button>
      </div>

      <div class="cartao" style="margin-bottom:16px">
        <div class="campos">
          <div class="campo campo--terco">
            <label for="f-cat">Categoria</label>
            <select id="f-cat">
              <option value="">Todas</option>
              ${CATEGORIAS.map((c) => `<option ${filtro.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="campo campo--terco">
            <label for="f-de">De</label>
            <input id="f-de" type="date" value="${esc(filtro.de)}">
          </div>
          <div class="campo campo--terco">
            <label for="f-ate">Até</label>
            <input id="f-ate" type="date" value="${esc(filtro.ate)}">
          </div>
          <div class="campo">
            <label for="f-busca">Buscar</label>
            <input id="f-busca" type="text" value="${esc(filtro.busca)}" placeholder="Médico, local, palavra da descrição…">
          </div>
        </div>
        <div class="btn-linha" style="margin-top:10px">
          <button class="btn btn--fantasma" type="button" id="b-limpa">Limpar filtros</button>
          <span class="dica" id="conta-filtro"></span>
        </div>
      </div>

      <div id="tl"></div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal" type="button" id="b-seguir">Continuar para os indicadores →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#b-nova', raiz).addEventListener('click', () => abrirFormulario(null, raiz));
  $('#b-seguir', raiz).addEventListener('click', () => irPara('indicadores'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('plano'));

  $('#f-cat', raiz).addEventListener('change', (e) => { filtro.categoria = e.target.value; linhaDoTempo(raiz); });
  $('#f-de', raiz).addEventListener('change', (e) => { filtro.de = e.target.value; linhaDoTempo(raiz); });
  $('#f-ate', raiz).addEventListener('change', (e) => { filtro.ate = e.target.value; linhaDoTempo(raiz); });
  $('#f-busca', raiz).addEventListener('input', (e) => { filtro.busca = e.target.value; linhaDoTempo(raiz); });
  $('#b-limpa', raiz).addEventListener('click', () => {
    Object.assign(filtro, { categoria: '', de: '', ate: '', busca: '' });
    desenhar(raiz);
  });

  linhaDoTempo(raiz);
}

function caixaNumero(rotulo, valor, pe) {
  return `<div class="numero"><div class="numero__caixa">
    <div class="numero__rot">${esc(rotulo)}</div>
    <div class="numero__val">${esc(valor)}</div>
    <div class="numero__pe">${esc(pe)}</div>
  </div></div>`;
}

function totalDeItens() {
  const p = estado.projeto.plano;
  return p.objetivos.length + p.estrategias.length + p.acoesPlanejadas.length;
}

function cobertos() {
  const p = estado.projeto.plano;
  const alvo = [...p.objetivos, ...p.estrategias, ...p.acoesPlanejadas];
  const usados = new Set(estado.projeto.acoes.flatMap((a) => a.vinculos));
  return alvo.filter((i) => usados.has(i.id)).length;
}

/* --- linha do tempo ---------------------------------------------------- */

function filtrar(acoes) {
  const busca = filtro.busca.trim().toLowerCase();
  return acoes.filter((a) => {
    if (filtro.categoria && a.categoria !== filtro.categoria) return false;
    if (filtro.de && a.data < filtro.de) return false;
    if (filtro.ate && a.data > filtro.ate) return false;
    if (busca) {
      const alvo = [a.titulo, a.local, a.descricao, a.resultado, a.objetivo, a.proximoPasso, a.observacoes]
        .join(' ').toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

async function linhaDoTempo(raiz) {
  const caixa = $('#tl', raiz);
  if (!caixa) return;

  const todas = acoesEmOrdem().reverse();   // mais recente em cima, na tela
  const lista = filtrar(todas);

  const conta = $('#conta-filtro', raiz);
  if (conta) {
    conta.textContent = lista.length === todas.length
      ? `${todas.length} ${todas.length === 1 ? 'ação' : 'ações'}`
      : `${lista.length} de ${todas.length} ${todas.length === 1 ? 'ação' : 'ações'}`;
  }

  if (!todas.length) {
    caixa.innerHTML = `
      <div class="cartao vazio">
        <div class="vazio__tit">Nenhuma ação registrada ainda</div>
        <p>Cada visita, ação de PDV, evento ou reunião que você fizer para executar este R2D entra aqui.</p>
        <button class="btn btn--principal" type="button" id="b-primeira" style="margin-top:12px">+ Registrar a primeira ação</button>
      </div>`;
    $('#b-primeira', caixa).addEventListener('click', () => abrirFormulario(null, raiz));
    return;
  }

  if (!lista.length) {
    caixa.innerHTML = `<div class="cartao vazio"><div class="vazio__tit">Nada com esses filtros</div>
      <p>Ajuste o período ou a categoria.</p></div>`;
    return;
  }

  caixa.innerHTML = `<ul class="linha-tempo">${lista.map((a) => cartaoDeAcao(a)).join('')}</ul>`;

  // fotos entram depois: cada uma é um objeto no IndexedDB
  for (const acao of lista) {
    for (const foto of acao.fotos) {
      const url = await urlDaFoto(foto.id);
      const img = $(`img[data-foto="${foto.id}"]`, caixa);
      if (img && url) img.src = url;
    }
  }

  $$('[data-editar]', caixa).forEach((b) => b.addEventListener('click', () => {
    abrirFormulario(b.dataset.editar, raiz);
  }));
  $$('[data-apagar]', caixa).forEach((b) => b.addEventListener('click', async () => {
    const acao = estado.projeto.acoes.find((a) => a.id === b.dataset.apagar);
    const ok = await confirmar({
      titulo: 'Apagar esta ação?',
      texto: `"${acao?.titulo || 'Ação'}" e as fotos dela saem do relatório. Não dá para desfazer.`,
      confirmar: 'Apagar', perigo: true,
    });
    if (!ok) return;
    for (const f of acao.fotos) { esquecerFoto(f.id); await db.apagarFoto(f.id); }
    estado.projeto.acoes = estado.projeto.acoes.filter((a) => a.id !== acao.id);
    mudou();
    desenhar(raiz);
    recado('Ação apagada.');
  }));
}

function cartaoDeAcao(a) {
  const vinculos = a.vinculos.map(acharItemDoPlano).filter(Boolean);
  return `
    <li class="tl">
      <div class="tl__dia">${esc(dataCurta(a.data))} · ${esc(diaDaSemana(a.data))}</div>
      <div class="tl__cartao">
        <div class="tl__tit">${esc(a.titulo || 'Ação sem título')}</div>
        <div class="tl__meta">
          <span class="etiqueta">${esc(a.categoria)}</span>
          ${a.local ? `<span>📍 ${esc(a.local)}</span>` : ''}
          <span style="color:#8c98a4">cadastrada em ${esc(dataCurta(a.registradoEm.slice(0, 10)))} às ${esc(horaDe(a.registradoEm))}</span>
        </div>
        ${vinculos.length ? `<div class="tl__vinc"><strong>R2D:</strong>
          ${vinculos.map((v) => `${esc(v.sigla)} · ${esc(v.texto)}`).join(' | ')}</div>` : ''}
        ${a.descricao ? `<div class="tl__corpo">${escLinhas(a.descricao)}</div>` : ''}
        ${a.resultado ? `<div class="tl__corpo"><strong style="color:#17222e">Resultado:</strong> ${escLinhas(a.resultado)}</div>` : ''}
        ${a.proximoPasso ? `<div class="tl__corpo"><strong style="color:#17222e">Próximo passo:</strong> ${escLinhas(a.proximoPasso)}</div>` : ''}
        ${a.fotos.length ? `<div class="tl__fotos">${a.fotos
          .map((f) => `<img data-foto="${esc(f.id)}" alt="${esc(f.legenda || 'Evidência')}">`).join('')}</div>` : ''}
        <div class="tl__pe">
          <button class="btn btn--fantasma" type="button" data-editar="${esc(a.id)}">Editar</button>
          <button class="btn btn--fantasma btn--perigo" type="button" data-apagar="${esc(a.id)}">Apagar</button>
        </div>
      </div>
    </li>`;
}

/* --- formulário de ação ------------------------------------------------ */

function abrirFormulario(id, raiz) {
  const existente = id ? estado.projeto.acoes.find((a) => a.id === id) : null;
  const acao = existente ? JSON.parse(JSON.stringify(existente)) : acaoVazia();
  const fotosNovas = [];   // ids gravados nesta edição, para limpar se cancelar

  const corpo = document.createElement('div');
  corpo.innerHTML = `
    <div class="campos">
      <div class="campo">
        <label for="a-tit">Ação realizada</label>
        <input id="a-tit" type="text" value="${esc(acao.titulo)}" placeholder="Ex.: Ação de PDV com material de Compre &amp; Ganhe">
      </div>
      <div class="campo campo--meio">
        <label for="a-cat">Categoria</label>
        <select id="a-cat">${CATEGORIAS.map((c) => `<option ${acao.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <div class="campo campo--meio">
        <label for="a-data">Data da ação</label>
        <input id="a-data" type="date" value="${esc(acao.data)}">
        <div class="dica">O cadastro fica marcado como ${esc(dataCurta(acao.registradoEm.slice(0, 10)))} às ${esc(horaDe(acao.registradoEm))}.</div>
      </div>

      <div class="campo">
        <span class="rotulo">Relação com o R2D</span>
        <div id="a-vinc"></div>
      </div>

      <div class="campo campo--meio">
        <label for="a-obj">Objetivo da ação</label>
        <input id="a-obj" type="text" value="${esc(acao.objetivo)}" placeholder="O que você queria conseguir com ela">
      </div>
      <div class="campo campo--meio">
        <label for="a-local">Médico, cliente ou local</label>
        <input id="a-local" type="text" value="${esc(acao.local)}" placeholder="Ex.: Pacheco — Carioca Shopping">
      </div>

      <div class="campo">
        <label for="a-desc">Descrição</label>
        <textarea id="a-desc" rows="3" placeholder="O que foi feito, como foi feito.">${esc(acao.descricao)}</textarea>
      </div>
      <div class="campo campo--meio">
        <label for="a-res">Resultado</label>
        <textarea id="a-res" rows="2" placeholder="O que saiu dessa ação.">${esc(acao.resultado)}</textarea>
      </div>
      <div class="campo campo--meio">
        <label for="a-prox">Próximo passo</label>
        <textarea id="a-prox" rows="2" placeholder="O que fica encaminhado.">${esc(acao.proximoPasso)}</textarea>
      </div>
      <div class="campo">
        <label for="a-obs">Observações</label>
        <textarea id="a-obs" rows="2" placeholder="Opcional.">${esc(acao.observacoes)}</textarea>
      </div>

      <div class="campo">
        <span class="rotulo">Fotos e evidências</span>
        <label class="solto" style="padding:16px">
          <input type="file" accept="image/*" multiple hidden id="a-fotos">
          <div class="solto__titulo">Adicionar fotos</div>
          <div class="solto__desc">Do computador ou direto da câmera do celular. Várias de uma vez.</div>
        </label>
        <div class="minis" id="a-minis"></div>
      </div>
    </div>`;

  const pe = document.createElement('div');
  pe.style.display = 'flex'; pe.style.gap = '10px';
  pe.innerHTML = `
    <button class="btn" type="button" data-cancelar>Cancelar</button>
    <button class="btn btn--principal" type="button" data-salvar>${existente ? 'Salvar alterações' : 'Registrar ação'}</button>`;

  const modal = abrirModal({ titulo: existente ? 'Editar ação' : 'Registrar ação', corpo, pe });

  montarVinculos($('#a-vinc', corpo), acao);
  desenharMinis();

  $('#a-fotos', corpo).addEventListener('change', async (ev) => {
    const arquivos = [...(ev.target.files || [])];
    ev.target.value = '';
    for (const arquivo of arquivos) {
      try {
        const blob = await prepararFoto(arquivo);
        const idFoto = novoId('ft');
        await db.gravarFoto(idFoto, blob);
        fotosNovas.push(idFoto);
        acao.fotos.push({ id: idFoto, legenda: '' });
        await desenharMinis();
      } catch {
        recado(`Não consegui usar "${arquivo.name}".`, 'erro');
      }
    }
  });

  async function desenharMinis() {
    const caixa = $('#a-minis', corpo);
    caixa.innerHTML = acao.fotos.map((f, i) => `
      <div class="mini">
        <div class="mini__topo">
          <img class="mini__img" data-mini="${esc(f.id)}" alt="Evidência ${i + 1}">
          <button class="mini__x" type="button" data-tira="${esc(f.id)}" aria-label="Remover foto ${i + 1}">&times;</button>
        </div>
        <input class="mini__legenda" type="text" value="${esc(f.legenda)}" data-leg="${esc(f.id)}" placeholder="Legenda">
      </div>`).join('');

    for (const f of acao.fotos) {
      const url = await urlDaFoto(f.id);
      const img = $(`img[data-mini="${f.id}"]`, caixa);
      if (img && url) img.src = url;
    }
    $$('[data-leg]', caixa).forEach((c) => c.addEventListener('input', () => {
      const alvo = acao.fotos.find((f) => f.id === c.dataset.leg);
      if (alvo) alvo.legenda = c.value;
    }));
    $$('[data-tira]', caixa).forEach((b) => b.addEventListener('click', async () => {
      const idFoto = b.dataset.tira;
      acao.fotos = acao.fotos.filter((f) => f.id !== idFoto);
      if (fotosNovas.includes(idFoto)) { esquecerFoto(idFoto); await db.apagarFoto(idFoto); }
      await desenharMinis();
    }));
  }

  $('[data-cancelar]', pe).addEventListener('click', async () => {
    // fotos gravadas nesta edição e abandonadas não podem ficar ocupando espaço
    for (const idFoto of fotosNovas) {
      if (!acao.fotos.some((f) => f.id === idFoto)) continue;
      esquecerFoto(idFoto); await db.apagarFoto(idFoto);
    }
    modal.fechar();
  });

  $('[data-salvar]', pe).addEventListener('click', async () => {
    acao.titulo = $('#a-tit', corpo).value.trim();
    acao.categoria = $('#a-cat', corpo).value;
    acao.data = $('#a-data', corpo).value;
    acao.objetivo = $('#a-obj', corpo).value.trim();
    acao.local = $('#a-local', corpo).value.trim();
    acao.descricao = $('#a-desc', corpo).value.trim();
    acao.resultado = $('#a-res', corpo).value.trim();
    acao.proximoPasso = $('#a-prox', corpo).value.trim();
    acao.observacoes = $('#a-obs', corpo).value.trim();

    if (!acao.titulo) { recado('Escreva o que foi a ação.', 'erro'); $('#a-tit', corpo).focus(); return; }
    if (!acao.data) { recado('Informe a data da ação.', 'erro'); return; }

    if (existente) {
      // fotos tiradas na edição saem do banco agora que a gravação foi confirmada
      const ficaram = new Set(acao.fotos.map((f) => f.id));
      for (const f of existente.fotos) {
        if (!ficaram.has(f.id)) { esquecerFoto(f.id); await db.apagarFoto(f.id); }
      }
      Object.assign(existente, acao);
    } else {
      estado.projeto.acoes.push(acao);
    }
    mudou();
    modal.fechar();
    desenhar(raiz);
    recado(existente ? 'Ação atualizada.' : 'Ação registrada.');
  });

  setTimeout(() => $('#a-tit', corpo)?.focus(), 60);
}

/** Fichas para amarrar a ação a objetivos, estratégias e ações do plano. */
function montarVinculos(caixa, acao) {
  const grupos = itensDoPlano();
  if (!grupos.length) {
    caixa.innerHTML = `<div class="aviso aviso--atencao">
      <span>⚠️</span><span>O plano ainda está vazio. Preencha os objetivos na etapa
      <strong>Plano do R2D</strong> para poder mostrar no relatório o que foi planejado e o que foi executado.</span></div>`;
    return;
  }

  caixa.innerHTML = grupos.map(([nome, itens]) => `
    <div style="margin-bottom:12px">
      <div class="dica" style="margin:0 0 6px;font-weight:600">${esc(nome)}</div>
      <div class="fichas">${itens.map((i) => `
        <button class="ficha" type="button" data-v="${esc(i.id)}"
                aria-pressed="${acao.vinculos.includes(i.id)}"
                title="${esc(i.texto)}">${esc(i.sigla)} · ${esc(curto(i.texto))}</button>`).join('')}</div>
    </div>`).join('')
    + '<div class="dica">Marque a que objetivo ou estratégia do R2D esta ação responde. É o que liga planejado a executado no relatório.</div>';

  $$('[data-v]', caixa).forEach((b) => b.addEventListener('click', () => {
    const idItem = b.dataset.v;
    const marcado = acao.vinculos.includes(idItem);
    acao.vinculos = marcado ? acao.vinculos.filter((x) => x !== idItem) : [...acao.vinculos, idItem];
    b.setAttribute('aria-pressed', String(!marcado));
  }));
}

const curto = (t) => (t.length <= 42 ? t : t.slice(0, 41).replace(/\s+\S*$/, '') + '…');
