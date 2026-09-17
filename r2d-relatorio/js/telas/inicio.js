/**
 * Etapa 1 — dados do relatório e envio do R2D.
 *
 * O R2D entra aqui como DOCUMENTO DE REFERÊNCIA. O PDF é lido, o texto é
 * guardado e o arquivo original não é alterado em momento nenhum. A tela diz
 * isso por escrito, porque é a confusão que o produto inteiro existe para
 * evitar: este sistema não cria nem substitui o plano de ação.
 */

import { estado, mudou } from '../estado.js';
import { itemDePlano } from '../estado.js';
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
        <span><strong>O R2D é o plano; este documento é a execução.</strong>
        Envie o R2D original só como referência — ele não é alterado, nem substituído.
        O que você monta aqui é o <strong>Relatório de Ações do R2D</strong>, para mostrar ao gestor
        o que foi feito para colocar aquele plano em prática.</span>
      </div>

      <div class="cartao">
        <h3 class="secao__titulo" style="font-size:17px;margin-bottom:4px">Dados do relatório</h3>
        <p class="secao__desc" style="margin-bottom:16px">Aparecem na capa do documento.</p>

        <div class="campos">
          <div class="campo campo--meio">
            <label for="f-rep">Nome do representante</label>
            <input id="f-rep" type="text" value="${esc(p.representante)}" placeholder="Como deve constar na capa">
          </div>
          <div class="campo campo--meio">
            <label for="f-prod">Produto</label>
            <input id="f-prod" type="text" value="${esc(p.produto)}" placeholder="Ex.: Lognis">
          </div>

          <div class="campo campo--terco">
            <label for="f-per">Período do R2D</label>
            <input id="f-per" type="text" value="${esc(p.periodoRotulo)}" placeholder="Ex.: Ciclo 7 · Setembro de 2026">
            <div class="dica">Como você chama o período no dia a dia.</div>
          </div>
          <div class="campo campo--terco">
            <label for="f-ini">Data de início</label>
            <input id="f-ini" type="date" value="${esc(p.periodoInicio)}">
          </div>
          <div class="campo campo--terco">
            <label for="f-fim">Data de encerramento</label>
            <input id="f-fim" type="date" value="${esc(p.periodoFim)}">
          </div>

          <div class="campo">
            <span class="rotulo">Logo do produto <span style="text-transform:none;letter-spacing:0;font-weight:400">— opcional</span></span>
            <div id="area-logo"></div>
            <div class="dica">A logo da Apsen é fixa e já vai no relatório. Aqui entra só a marca do produto,
              se você quiser — ela aparece discreta, no alto da capa.</div>
          </div>
        </div>
      </div>

      <div class="cartao" style="margin-top:14px">
        <h3 class="secao__titulo" style="font-size:17px;margin-bottom:4px">R2D original (PDF)</h3>
        <p class="secao__desc" style="margin-bottom:16px">
          Documento de referência. O sistema lê para entender o plano — e não escreve nada nele.</p>
        <div id="area-pdf"></div>
      </div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal btn--grande" type="button" id="b-seguir">Continuar para o plano →</button>
      </div>
    </div>`;

  ligarCampos();
  desenharLogo();
  desenharPdf();

  $('#b-seguir', raiz).addEventListener('click', () => irPara('plano'));
}

/* --- campos ------------------------------------------------------------ */

function ligarCampos() {
  const p = estado.projeto;
  const par = [
    ['#f-rep', 'representante'], ['#f-prod', 'produto'],
    ['#f-per', 'periodoRotulo'], ['#f-ini', 'periodoInicio'], ['#f-fim', 'periodoFim'],
  ];
  par.forEach(([sel, chave]) => {
    $(sel).addEventListener('input', (e) => { p[chave] = e.target.value; mudou(); });
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
          <div class="arquivo__meta">Aparece no alto da capa.</div>
        </div>
        <button class="btn btn--fantasma btn--perigo" type="button" id="b-tira-logo">Remover</button>
      </div>`;
    $('#b-tira-logo').addEventListener('click', () => {
      p.logoProduto = null; mudou(); desenharLogo();
    });
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
      const blob = await prepararFoto(arquivo);
      p.logoProduto = await comoDataUrl(blob);
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
    const achou = resumoDoQueFoiLido();
    area.innerHTML = `
      <div class="arquivo">
        <span style="font-size:20px">📄</span>
        <div style="flex:1;min-width:0">
          <div class="arquivo__nome">${esc(p.r2d.nomeArquivo)}</div>
          <div class="arquivo__meta">${p.r2d.paginas} ${p.r2d.paginas === 1 ? 'página' : 'páginas'}
            · enviado em ${esc(dataCurta(p.r2d.enviadoEm))}
            · ${esc({ ia: 'lido com IA', local: 'leitura automática', manual: 'preenchido à mão' }[p.r2d.origemLeitura] || 'lido')}</div>
        </div>
        <button class="btn btn--fantasma btn--perigo" type="button" id="b-tira-pdf">Trocar</button>
      </div>
      <div class="aviso ${achou.vazio ? 'aviso--atencao' : 'aviso--ok'}" style="margin-top:12px">
        <span>${achou.vazio ? '⚠️' : '✓'}</span>
        <span>${achou.texto}</span>
      </div>
      <div class="btn-linha" style="margin-top:12px">
        <button class="btn" type="button" id="b-reler">Ler de novo (local)</button>
        <button class="btn" type="button" id="b-ia">Tentar leitura com IA</button>
        <button class="btn btn--fantasma" type="button" id="b-plano">Revisar o plano →</button>
      </div>`;

    $('#b-tira-pdf').addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Trocar o R2D?',
        texto: 'O texto lido deste PDF será descartado. O que você já escreveu no plano e as ações registradas continuam.',
        confirmar: 'Trocar',
      });
      if (!ok) return;
      p.r2d = { nomeArquivo: '', paginas: 0, enviadoEm: '', texto: '', origemLeitura: '' };
      mudou(); desenharPdf();
    });
    $('#b-reler').addEventListener('click', () => aplicarLeituraLocal(p.r2d.texto));
    $('#b-ia').addEventListener('click', () => lerComIa());
    $('#b-plano').addEventListener('click', () => irPara('plano'));
    return;
  }

  area.innerHTML = `
    <label class="solto" id="solto-pdf">
      <input type="file" accept="application/pdf,.pdf" hidden id="f-pdf">
      <div style="font-size:26px;margin-bottom:6px">📄</div>
      <div class="solto__titulo">Enviar o R2D em PDF</div>
      <div class="solto__desc">Arraste o arquivo aqui ou toque para escolher.</div>
    </label>
    <div class="dica" style="margin-top:10px">Sem o PDF dá para seguir assim mesmo:
      é só escrever os objetivos e as estratégias na próxima etapa.</div>`;

  const solto = $('#solto-pdf');
  const campo = $('#f-pdf');
  campo.addEventListener('change', (e) => { if (e.target.files?.[0]) receber(e.target.files[0]); });
  ['dragenter', 'dragover'].forEach((ev) => solto.addEventListener(ev, (e) => {
    e.preventDefault(); solto.dataset.sobre = 'sim';
  }));
  ['dragleave', 'drop'].forEach((ev) => solto.addEventListener(ev, (e) => {
    e.preventDefault(); delete solto.dataset.sobre;
  }));
  solto.addEventListener('drop', (e) => {
    const arquivo = e.dataTransfer?.files?.[0];
    if (arquivo) receber(arquivo);
  });
}

async function receber(arquivo) {
  if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) {
    recado('Envie um arquivo PDF.', 'erro');
    return;
  }
  const p = estado.projeto;
  const area = $('#area-pdf');
  area.innerHTML = `<div class="aviso aviso--info"><span>⏳</span><span>Lendo <strong>${esc(arquivo.name)}</strong>…</span></div>`;

  try {
    const { texto, paginas } = await lerPdf(arquivo);
    p.r2d = {
      nomeArquivo: arquivo.name,
      paginas,
      enviadoEm: new Date().toISOString().slice(0, 10),
      texto,
      origemLeitura: 'local',
    };

    if (texto.trim().length < 40) {
      recado('Esse PDF parece ser digitalizado (imagem). Preencha o plano à mão.', 'erro');
      p.r2d.origemLeitura = 'manual';
      mudou(); desenharPdf();
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

/** Leitura local (determinística) → preenche o plano sem sobrescrever o que já foi escrito. */
function aplicarLeituraLocal(texto, { silencioso = false } = {}) {
  if (!texto) { recado('Não há texto guardado deste PDF.', 'erro'); return; }
  const lido = lerR2D(texto);
  estado.projeto.r2d.origemLeitura = 'local';
  aplicarPlano(lido);
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
  recado('Plano lido com IA. Revise antes de seguir.');
}

/**
 * Passa o que foi lido para o plano.
 * Campo que a pessoa já preencheu não é sobrescrito — a leitura é sugestão,
 * não autoridade. E lista lida substitui a lista lida anterior, não soma
 * (senão reler duas vezes duplica tudo).
 */
function aplicarPlano(lido) {
  const p = estado.projeto;
  if (!p.produto && lido.produto) p.produto = lido.produto;
  if (!p.periodoRotulo && lido.periodoRotulo) p.periodoRotulo = lido.periodoRotulo;
  if (!p.periodoInicio && lido.periodoInicio) p.periodoInicio = lido.periodoInicio;
  if (!p.periodoFim && lido.periodoFim) p.periodoFim = lido.periodoFim;
  if (lido.contexto) p.plano.contexto = lido.contexto;

  for (const lista of ['objetivos', 'estrategias', 'desafios', 'acoesPlanejadas', 'metas']) {
    const textos = lido[lista] || [];
    if (!textos.length) continue;
    p.plano[lista] = [];
    textos.forEach((t) => p.plano[lista].push(itemDePlano(lista, t)));
  }

  if (lido.totalPlanejadas) p.plano.totalPlanejadas = lido.totalPlanejadas;
  else if (!p.plano.totalPlanejadas && p.plano.acoesPlanejadas.length) {
    p.plano.totalPlanejadas = p.plano.acoesPlanejadas.length;
  }

  // reflete no formulário sem redesenhar a tela toda (o foco se perderia)
  ['#f-prod', '#f-per', '#f-ini', '#f-fim'].forEach((sel, i) => {
    const campo = $(sel);
    const valor = [p.produto, p.periodoRotulo, p.periodoInicio, p.periodoFim][i];
    if (campo && valor) campo.value = valor;
  });
}

function resumoDoQueFoiLido() {
  const plano = estado.projeto.plano;
  const partes = [
    ['objetivo', plano.objetivos.length],
    ['estratégia', plano.estrategias.length],
    ['desafio', plano.desafios.length],
    ['ação planejada', plano.acoesPlanejadas.length],
  ].filter(([, n]) => n > 0);

  if (!partes.length) {
    return {
      vazio: true,
      texto: 'Não reconheci as seções desse R2D. Escreva os objetivos e as estratégias à mão na próxima etapa — o relatório funciona igual.',
    };
  }
  const lista = partes.map(([nome, n]) => `<strong>${n}</strong> ${nome}${n > 1 ? (nome.endsWith('a') ? 's' : 's') : ''}`).join(', ');
  return { vazio: false, texto: `Reconheci ${lista}. Confira na próxima etapa antes de registrar as ações.` };
}
