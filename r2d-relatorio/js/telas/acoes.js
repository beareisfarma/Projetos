/**
 * Etapa 2 — as ações realizadas.
 *
 * O coração da ferramenta. Cinco campos e nada mais: data, o que foi feito,
 * onde ou com quem, o resultado e as fotos. Categoria, objetivo da ação,
 * próximo passo e vínculo com item do plano foram tirados — eram gestão de
 * plano, não registro de execução.
 *
 * A data do CADASTRO é do sistema; a data da AÇÃO é da pessoa. Não são a mesma
 * coisa: uma ação de terça lançada no sábado aparece na terça, que é quando
 * aconteceu.
 */

import { estado, mudou, acaoVazia, acoesEmOrdem, totalDeFotos, novoId } from '../estado.js';
import { $, $$, esc, escLinhas, dataCurta, diaDaSemana, horaDe, recado, abrirModal, confirmar } from '../ui.js';
import { db, urlDaFoto, esquecerFoto } from '../db.js';
import { prepararFoto } from '../fotos.js';
import { irPara } from '../app.js';

const filtro = { de: '', ate: '', busca: '' };

export function desenhar(raiz) {
  const total = estado.projeto.acoes.length;

  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Ações realizadas</h2>
          <p class="secao__desc">${total
            ? `${total} ${total === 1 ? 'ação registrada' : 'ações registradas'} · ${totalDeFotos()} ${totalDeFotos() === 1 ? 'foto' : 'fotos'}`
            : 'Registre o que você foi fazendo para executar o plano.'}</p>
        </div>
        <button class="btn btn--principal btn--grande" type="button" id="b-nova">+ Registrar ação</button>
      </div>

      ${total ? `<div class="cartao" style="margin-bottom:16px">
        <div class="campos">
          <div class="campo campo--terco">
            <label for="f-de">De</label>
            <input id="f-de" type="date" value="${esc(filtro.de)}">
          </div>
          <div class="campo campo--terco">
            <label for="f-ate">Até</label>
            <input id="f-ate" type="date" value="${esc(filtro.ate)}">
          </div>
          <div class="campo campo--terco">
            <label for="f-busca">Buscar</label>
            <input id="f-busca" type="text" value="${esc(filtro.busca)}" placeholder="Médico, farmácia, palavra…">
          </div>
        </div>
        <div class="btn-linha" style="margin-top:10px">
          <button class="btn btn--fantasma" type="button" id="b-limpa">Limpar filtros</button>
          <span class="dica" id="conta-filtro"></span>
        </div>
      </div>` : ''}

      <div id="tl"></div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal" type="button" id="b-seguir">Continuar para os indicadores →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#b-nova', raiz).addEventListener('click', () => abrirFormulario(null, raiz));
  $('#b-seguir', raiz).addEventListener('click', () => irPara('indicadores'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('inicio'));

  if (total) {
    $('#f-de', raiz).addEventListener('change', (e) => { filtro.de = e.target.value; linhaDoTempo(raiz); });
    $('#f-ate', raiz).addEventListener('change', (e) => { filtro.ate = e.target.value; linhaDoTempo(raiz); });
    $('#f-busca', raiz).addEventListener('input', (e) => { filtro.busca = e.target.value; linhaDoTempo(raiz); });
    $('#b-limpa', raiz).addEventListener('click', () => {
      Object.assign(filtro, { de: '', ate: '', busca: '' });
      desenhar(raiz);
    });
  }

  linhaDoTempo(raiz);
}

/* --- linha do tempo ---------------------------------------------------- */

function filtrar(acoes) {
  const busca = filtro.busca.trim().toLowerCase();
  return acoes.filter((a) => {
    if (filtro.de && a.data < filtro.de) return false;
    if (filtro.ate && a.data > filtro.ate) return false;
    if (busca && ![a.titulo, a.local, a.resultado].join(' ').toLowerCase().includes(busca)) return false;
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
      : `${lista.length} de ${todas.length}`;
  }

  if (!todas.length) {
    caixa.innerHTML = `
      <div class="cartao vazio">
        <div class="vazio__tit">Nenhuma ação registrada ainda</div>
        <p>Cada visita, ação de PDV, evento ou parceria que você fizer para executar este R2D entra aqui.</p>
        <button class="btn btn--principal" type="button" id="b-primeira" style="margin-top:12px">+ Registrar a primeira ação</button>
      </div>`;
    $('#b-primeira', caixa).addEventListener('click', () => abrirFormulario(null, raiz));
    return;
  }

  if (!lista.length) {
    caixa.innerHTML = `<div class="cartao vazio"><div class="vazio__tit">Nada com esses filtros</div>
      <p>Ajuste o período ou a busca.</p></div>`;
    return;
  }

  caixa.innerHTML = `<ul class="linha-tempo">${lista.map(cartaoDeAcao).join('')}</ul>`;

  for (const acao of lista) {
    for (const foto of acao.fotos) {
      const url = await urlDaFoto(foto.id);
      const img = $(`img[data-foto="${foto.id}"]`, caixa);
      if (img && url) img.src = url;
    }
  }

  $$('[data-editar]', caixa).forEach((b) => b.addEventListener('click', () => abrirFormulario(b.dataset.editar, raiz)));
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
  return `
    <li class="tl">
      <div class="tl__dia">${esc(dataCurta(a.data))} · ${esc(diaDaSemana(a.data))}</div>
      <div class="tl__cartao">
        <div class="tl__tit">${esc(a.titulo || 'Ação sem título')}</div>
        <div class="tl__meta">
          ${a.local ? `<span>${esc(a.local)}</span>` : ''}
          <span style="color:#8c98a4">registrada em ${esc(dataCurta(a.registradoEm.slice(0, 10)))} às ${esc(horaDe(a.registradoEm))}</span>
        </div>
        ${a.resultado ? `<div class="tl__corpo">${escLinhas(a.resultado)}</div>` : ''}
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
  const fotosNovas = [];   // gravadas nesta edição, para limpar se cancelar

  const corpo = document.createElement('div');
  corpo.innerHTML = `
    <div class="campos">
      <div class="campo campo--terco">
        <label for="a-data">Data</label>
        <input id="a-data" type="date" value="${esc(acao.data)}">
      </div>
      <div class="campo" style="flex-basis:66%">
        <label for="a-tit">Ação realizada</label>
        <input id="a-tit" type="text" value="${esc(acao.titulo)}"
               placeholder="Ex.: Ação de PDV com Compre &amp; Ganhe">
      </div>

      <div class="campo">
        <label for="a-local">Local, PDV ou médico</label>
        <input id="a-local" type="text" value="${esc(acao.local)}"
               placeholder="Ex.: Drogaria Pacheco — Carioca Shopping · Dr. Ramiro">
      </div>

      <div class="campo">
        <label for="a-res">Informações ou resultados relevantes</label>
        <textarea id="a-res" rows="4"
          placeholder="O que aconteceu, o que ficou combinado.">${esc(acao.resultado)}</textarea>
      </div>

      <div class="campo">
        <span class="rotulo">Fotos da ação</span>
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
  desenharMinis();

  $('#a-fotos', corpo).addEventListener('change', async (ev) => {
    const arquivos = [...(ev.target.files || [])];
    ev.target.value = '';
    for (const arquivo of arquivos) {
      try {
        const idFoto = novoId('ft');
        await db.gravarFoto(idFoto, await prepararFoto(arquivo));
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
      if (acao.fotos.some((f) => f.id === idFoto)) continue;
      esquecerFoto(idFoto); await db.apagarFoto(idFoto);
    }
    modal.fechar();
  });

  $('[data-salvar]', pe).addEventListener('click', async () => {
    acao.data = $('#a-data', corpo).value;
    acao.titulo = $('#a-tit', corpo).value.trim();
    acao.local = $('#a-local', corpo).value.trim();
    acao.resultado = $('#a-res', corpo).value.trim();

    if (!acao.titulo) { recado('Escreva o que foi a ação.', 'erro'); $('#a-tit', corpo).focus(); return; }
    if (!acao.data) { recado('Informe a data da ação.', 'erro'); return; }

    if (existente) {
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
