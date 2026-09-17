/**
 * Etapa 1 — identificação e R2D.
 *
 * O R2D entra como DOCUMENTO DE REFERÊNCIA. Ele já foi elaborado e aprovado
 * com a gerente: o app lê três coisas dele — objetivo, gap e ações previstas —
 * e as mostra num cartão para conferência. Não existe tela de edição de plano,
 * não existem siglas, não existe vínculo de ação com item do plano. Tudo isso
 * seria gerir um R2D, e não é para isso que a ferramenta existe.
 *
 * Os três campos são editáveis porque a leitura de PDF erra, não porque o
 * plano esteja em construção.
 */

import { estado, mudou } from '../estado.js';
import { $, $$, esc, recado, dataCurta, confirmar } from '../ui.js';
import { lerPdf } from '../pdf-leitor.js';
import { lerR2D } from '../extrator.js';
import { ia } from '../ia.js';
import { prepararFoto } from '../fotos.js';
import { comoDataUrl } from '../db.js';
import { irPara } from '../app.js';

export function desenhar(raiz) {
  const p = estado.projeto;

  raiz.innerHTML = `
    <div class="secao">
      <div class="aviso aviso--info" style="margin-bottom:22px">
        <span>ℹ️</span>
        <span><strong>O R2D já existe e não é alterado aqui.</strong>
        Envie o plano aprovado só como referência: o app lê o objetivo, o gap e as ações
        previstas para dar contexto. O que você monta é o <strong>relatório de execução</strong> —
        o que foi feito para colocar esse plano em prática.</span>
      </div>

      <div class="cartao">
        <h3 class="secao__titulo" style="font-size:17px;margin-bottom:4px">Identificação</h3>
        <p class="secao__desc" style="margin-bottom:16px">Abre o relatório.</p>

        <div class="campos">
          <div class="campo campo--meio">
            <label for="f-rep">Nome do representante</label>
            <input id="f-rep" type="text" value="${esc(p.representante)}" placeholder="Como deve constar no relatório">
          </div>
          <div class="campo campo--meio">
            <label for="f-prod">Produto</label>
            <input id="f-prod" type="text" value="${esc(p.produto)}" placeholder="Ex.: Lognis">
          </div>

          <div class="campo campo--terco">
            <label for="f-per">Período do plano</label>
            <input id="f-per" type="text" value="${esc(p.periodoRotulo)}" placeholder="Ex.: Ciclo 7 · Ago a Dez/2026">
          </div>
          <div class="campo campo--terco">
            <label for="f-ini">Início</label>
            <input id="f-ini" type="date" value="${esc(p.periodoInicio)}">
          </div>
          <div class="campo campo--terco">
            <label for="f-fim">Encerramento</label>
            <input id="f-fim" type="date" value="${esc(p.periodoFim)}">
          </div>

          <div class="campo">
            <span class="rotulo">Logo do produto <span style="text-transform:none;letter-spacing:0;font-weight:400">— opcional</span></span>
            <div id="area-logo"></div>
            <div class="dica">A logo da Apsen é fixa e já vai no relatório. Aqui entra só a marca do produto.</div>
          </div>
        </div>
      </div>

      <div class="cartao" style="margin-top:14px">
        <h3 class="secao__titulo" style="font-size:17px;margin-bottom:4px">R2D aprovado (PDF)</h3>
        <p class="secao__desc" style="margin-bottom:16px">
          Documento de referência. O app lê para entender o plano — e não escreve nada nele.</p>
        <div id="area-pdf"></div>
      </div>

      <div class="cartao" style="margin-top:14px">
        <h3 class="secao__titulo" style="font-size:17px;margin-bottom:4px">O que o R2D dizia</h3>
        <p class="secao__desc" style="margin-bottom:16px">
          Entra como contexto no topo do relatório. Confira o que foi lido e corrija se precisar.</p>

        <div class="campos">
          <div class="campo campo--meio">
            <label for="f-obj">Objetivo do plano</label>
            <textarea id="f-obj" rows="3" placeholder="O que o R2D queria alcançar.">${esc(p.plano.objetivo)}</textarea>
          </div>
          <div class="campo campo--meio">
            <label for="f-gap">Gap identificado</label>
            <textarea id="f-gap" rows="3" placeholder="O problema que o plano atacava.">${esc(p.plano.gap)}</textarea>
          </div>
          <div class="campo">
            <label for="f-prev">Ações previstas no plano</label>
            <textarea id="f-prev" rows="4"
              placeholder="Uma por linha.">${esc((p.plano.acoesPrevistas || []).join('\n'))}</textarea>
            <div class="dica">Uma por linha. Opcional — serve para a gerente lembrar o que estava combinado.</div>
          </div>
        </div>
      </div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal btn--grande" type="button" id="b-seguir">Continuar para as ações →</button>
      </div>
    </div>`;

  ligarCampos(raiz);
  desenharLogo();
  desenharPdf();
  $('#b-seguir', raiz).addEventListener('click', () => irPara('acoes'));
}

function ligarCampos(raiz) {
  const p = estado.projeto;
  [['#f-rep', 'representante'], ['#f-prod', 'produto'], ['#f-per', 'periodoRotulo'],
   ['#f-ini', 'periodoInicio'], ['#f-fim', 'periodoFim']]
    .forEach(([sel, chave]) => {
      $(sel, raiz).addEventListener('input', (e) => { p[chave] = e.target.value; mudou(); });
    });

  $('#f-obj', raiz).addEventListener('input', (e) => { p.plano.objetivo = e.target.value; mudou(); });
  $('#f-gap', raiz).addEventListener('input', (e) => { p.plano.gap = e.target.value; mudou(); });
  $('#f-prev', raiz).addEventListener('input', (e) => {
    p.plano.acoesPrevistas = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
    mudou();
  });
}

/* --- logo do produto --------------------------------------------------- */

function desenharLogo() {
  const area = $('#area-logo');
  const p = estado.projeto;

  if (p.logoProduto) {
    area.innerHTML = `
      <div class="arquivo">
        <img src="${p.logoProduto}" alt="Logo do produto" style="height:34px;width:auto;flex:none">
        <div style="flex:1">
          <div class="arquivo__nome">Logo do produto</div>
          <div class="arquivo__meta">Aparece no alto do relatório.</div>
        </div>
        <button class="btn btn--fantasma btn--perigo" type="button" id="b-tira-logo">Remover</button>
      </div>`;
    $('#b-tira-logo').addEventListener('click', () => { p.logoProduto = null; mudou(); desenharLogo(); });
    return;
  }

  area.innerHTML = `
    <label class="solto" style="padding:16px">
      <input type="file" accept="image/*" hidden id="f-logo">
      <div class="solto__titulo">Enviar a logo do produto</div>
      <div class="solto__desc">PNG ou JPG. Fundo transparente fica melhor.</div>
    </label>`;

  $('#f-logo').addEventListener('change', async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      p.logoProduto = await comoDataUrl(await prepararFoto(arquivo));
      mudou(); desenharLogo();
      recado('Logo do produto adicionada.');
    } catch {
      recado('Não consegui ler essa imagem.', 'erro');
    }
  });
}

/* --- PDF do R2D -------------------------------------------------------- */

function desenharPdf() {
  const area = $('#area-pdf');
  const p = estado.projeto;

  if (p.r2d.nomeArquivo) {
    const como = { ia: 'lido com IA', local: 'leitura automática', manual: 'preenchido à mão' }[p.r2d.origemLeitura] || 'lido';
    area.innerHTML = `
      <div class="arquivo">
        <span style="font-size:20px">📄</span>
        <div style="flex:1;min-width:0">
          <div class="arquivo__nome">${esc(p.r2d.nomeArquivo)}</div>
          <div class="arquivo__meta">${p.r2d.paginas} ${p.r2d.paginas === 1 ? 'página' : 'páginas'}
            · enviado em ${esc(dataCurta(p.r2d.enviadoEm))} · ${esc(como)}</div>
        </div>
        <button class="btn btn--fantasma btn--perigo" type="button" id="b-tira-pdf">Trocar</button>
      </div>
      <div class="btn-linha" style="margin-top:12px">
        <button class="btn" type="button" id="b-reler">Ler de novo</button>
        <button class="btn" type="button" id="b-ia">Tentar leitura com IA</button>
      </div>`;

    $('#b-tira-pdf').addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Trocar o R2D?',
        texto: 'O texto lido deste PDF é descartado. As ações e os indicadores que você registrou continuam.',
        confirmar: 'Trocar',
      });
      if (!ok) return;
      p.r2d = { nomeArquivo: '', paginas: 0, enviadoEm: '', texto: '', origemLeitura: '' };
      mudou(); desenharPdf();
    });
    $('#b-reler').addEventListener('click', () => aplicarLeituraLocal(p.r2d.texto));
    $('#b-ia').addEventListener('click', lerComIa);
    return;
  }

  area.innerHTML = `
    <label class="solto" id="solto-pdf">
      <input type="file" accept="application/pdf,.pdf" hidden id="f-pdf">
      <div style="font-size:26px;margin-bottom:6px">📄</div>
      <div class="solto__titulo">Enviar o R2D em PDF</div>
      <div class="solto__desc">Arraste o arquivo aqui ou toque para escolher.</div>
    </label>
    <div class="dica" style="margin-top:10px">Sem o PDF dá para seguir: é só escrever o objetivo e o gap no cartão abaixo.</div>`;

  const solto = $('#solto-pdf');
  $('#f-pdf').addEventListener('change', (e) => { if (e.target.files?.[0]) receber(e.target.files[0]); });
  ['dragenter', 'dragover'].forEach((ev) => solto.addEventListener(ev, (e) => { e.preventDefault(); solto.dataset.sobre = 'sim'; }));
  ['dragleave', 'drop'].forEach((ev) => solto.addEventListener(ev, (e) => { e.preventDefault(); delete solto.dataset.sobre; }));
  solto.addEventListener('drop', (e) => { const a = e.dataTransfer?.files?.[0]; if (a) receber(a); });
}

async function receber(arquivo) {
  if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) {
    recado('Envie um arquivo PDF.', 'erro');
    return;
  }
  const p = estado.projeto;
  $('#area-pdf').innerHTML = `<div class="aviso aviso--info"><span>⏳</span><span>Lendo <strong>${esc(arquivo.name)}</strong>…</span></div>`;

  try {
    const { texto, paginas } = await lerPdf(arquivo);
    p.r2d = {
      nomeArquivo: arquivo.name, paginas,
      enviadoEm: new Date().toISOString().slice(0, 10),
      texto, origemLeitura: 'local',
    };

    if (texto.trim().length < 40) {
      p.r2d.origemLeitura = 'manual';
      mudou(); desenharPdf();
      recado('Esse PDF parece ser digitalizado (imagem). Escreva o objetivo e o gap à mão.', 'erro');
      return;
    }

    aplicarLeituraLocal(texto, { silencioso: true });
    recado(`R2D lido: ${paginas} ${paginas === 1 ? 'página' : 'páginas'}.`);
  } catch (e) {
    console.error(e);
    recado('Não consegui abrir esse PDF.', 'erro');
    desenharPdf();
  }
}

function aplicarLeituraLocal(texto, { silencioso = false } = {}) {
  if (!texto) { recado('Não há texto guardado deste PDF.', 'erro'); return; }
  estado.projeto.r2d.origemLeitura = 'local';
  aplicarPlano(lerR2D(texto));
  mudou();
  desenharPdf();
  if (!silencioso) recado('Plano relido do PDF.');
}

async function lerComIa() {
  const p = estado.projeto;
  const botao = $('#b-ia');
  if (botao) { botao.disabled = true; botao.textContent = 'Lendo com IA…'; }

  const r = await ia.interpretarR2D(p.r2d.texto);
  if (!r.ok) {
    recado(r.mensagem, r.motivo === 'sem-ia' ? '' : 'erro');
    desenharPdf();
    return;
  }
  p.r2d.origemLeitura = 'ia';
  aplicarPlano(r.dados.plano);
  mudou();
  desenharPdf();
  recado('Plano lido com IA. Confira antes de seguir.');
}

/**
 * Passa o que foi lido para os campos de contexto.
 * Campo que a pessoa já preencheu não é sobrescrito: a leitura é sugestão,
 * não autoridade.
 */
function aplicarPlano(lido) {
  const p = estado.projeto;
  if (!p.produto && lido.produto) p.produto = lido.produto;
  if (!p.periodoRotulo && lido.periodoRotulo) p.periodoRotulo = lido.periodoRotulo;
  if (!p.periodoInicio && lido.periodoInicio) p.periodoInicio = lido.periodoInicio;
  if (!p.periodoFim && lido.periodoFim) p.periodoFim = lido.periodoFim;

  if (lido.objetivo) p.plano.objetivo = lido.objetivo;
  if (lido.gap) p.plano.gap = lido.gap;
  if ((lido.acoesPrevistas || []).length) p.plano.acoesPrevistas = lido.acoesPrevistas;

  // reflete nos campos sem redesenhar a tela (o foco se perderia)
  const espelho = {
    '#f-prod': p.produto, '#f-per': p.periodoRotulo, '#f-ini': p.periodoInicio, '#f-fim': p.periodoFim,
    '#f-obj': p.plano.objetivo, '#f-gap': p.plano.gap, '#f-prev': p.plano.acoesPrevistas.join('\n'),
  };
  Object.entries(espelho).forEach(([sel, valor]) => {
    const campo = $(sel);
    if (campo && valor) campo.value = valor;
  });
}
