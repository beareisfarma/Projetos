/**
 * Etapa 5 — resultados, pendências e próximos passos.
 *
 * O botão de IA é atalho, não obrigação: ele lê o que já está registrado e
 * escreve o fechamento. Sem chave configurada, sem internet, ou se a pessoa
 * preferir escrever, os mesmos campos estão aqui para preencher à mão.
 */

import { estado, mudou, acoesEmOrdem, cobertura, execucao, INDICADORES, acharItemDoPlano } from '../estado.js';
import { $, esc, recado } from '../ui.js';
import { listaEditavel } from '../componentes.js';
import { ia } from '../ia.js';
import { irPara } from '../app.js';

const LISTAS = [
  { chave: 'entregas', titulo: 'Principais entregas', ph: 'O que essa execução produziu' },
  { chave: 'pendencias', titulo: 'Pendências', ph: 'O que do plano ainda não foi feito' },
  { chave: 'proximosPassos', titulo: 'Próximos passos', ph: 'O que vem a seguir' },
  { chave: 'atencao', titulo: 'Pontos de atenção', ph: 'O que o gestor precisa saber' },
];

export function desenhar(raiz) {
  const f = estado.projeto.fechamento;

  raiz.innerHTML = `
    <div class="secao">
      <div class="secao__cab">
        <div>
          <h2 class="secao__titulo">Resultados e próximos passos</h2>
          <p class="secao__desc">Fecha o relatório. É a última página do documento.</p>
        </div>
        <button class="btn" type="button" id="b-ia">✨ Escrever com IA</button>
      </div>

      <div class="cartao">
        <label class="rotulo" for="f-res">Resumo executivo</label>
        <textarea id="f-res" rows="4"
          placeholder="Três a cinco frases: o que foi executado no período e o que isso produziu.">${esc(f.resumo)}</textarea>
        <div class="dica">Abre a última página, em destaque.</div>
      </div>

      <div id="listas"></div>

      <div class="btn-linha" style="margin-top:22px">
        <button class="btn btn--principal btn--grande" type="button" id="b-seguir">Ver o relatório →</button>
        <button class="btn btn--fantasma" type="button" id="b-voltar">← Voltar</button>
      </div>
    </div>`;

  $('#f-res', raiz).addEventListener('input', (e) => { f.resumo = e.target.value; mudou(); });
  $('#b-seguir', raiz).addEventListener('click', () => irPara('previa'));
  $('#b-voltar', raiz).addEventListener('click', () => irPara('indicadores'));
  $('#b-ia', raiz).addEventListener('click', () => escreverComIa(raiz));

  const caixa = $('#listas', raiz);
  LISTAS.forEach(({ chave, titulo, ph }) => {
    const cartao = document.createElement('div');
    cartao.className = 'cartao';
    cartao.style.marginTop = '14px';
    cartao.innerHTML = `<h3 class="secao__titulo" style="font-size:17px;margin-bottom:10px">${esc(titulo)}</h3><div data-l></div>`;
    caixa.appendChild(cartao);
    listaEditavel({
      raiz: $('[data-l]', cartao),
      itens: f[chave],
      placeholder: ph,
      rotuloNovo: 'Adicionar',
      aoMudar: () => mudou(),
    });
  });

  sugerirPendencias(raiz);
}

/** Mostra, sem escrever nada sozinho, os itens do plano ainda sem ação. */
function sugerirPendencias(raiz) {
  const semAcao = cobertura().filter((c) => c.quantas === 0);
  if (!semAcao.length) return;
  const caixa = document.createElement('div');
  caixa.className = 'aviso aviso--atencao';
  caixa.style.marginTop = '14px';
  caixa.innerHTML = `<span>⚠️</span><span><strong>${semAcao.length}
    ${semAcao.length === 1 ? 'item do plano ainda sem ação registrada' : 'itens do plano ainda sem ação registrada'}:</strong>
    ${semAcao.slice(0, 5).map((c) => esc(c.item.sigla)).join(', ')}${semAcao.length > 5 ? ` e mais ${semAcao.length - 5}` : ''}.
    Vale citar em <em>Pendências</em>.</span>`;
  $('#listas', raiz).prepend(caixa);
}

async function escreverComIa(raiz) {
  const p = estado.projeto;
  if (!p.acoes.length) { recado('Registre pelo menos uma ação antes.', 'erro'); return; }

  const botao = $('#b-ia', raiz);
  botao.disabled = true;
  botao.textContent = 'Escrevendo…';

  const e = execucao();
  const material = {
    produto: p.produto,
    periodo: p.periodoRotulo,
    plano: {
      contexto: p.plano.contexto,
      objetivos: p.plano.objetivos.map((i) => `${i.sigla}: ${i.texto}`),
      estrategias: p.plano.estrategias.map((i) => `${i.sigla}: ${i.texto}`),
      desafios: p.plano.desafios.map((i) => i.texto),
      acoesPlanejadas: p.plano.acoesPlanejadas.map((i) => `${i.sigla}: ${i.texto}`),
    },
    execucao: { previstas: e.previstas, realizadas: e.feitas, percentual: e.pct },
    itensDoPlanoSemAcao: cobertura().filter((c) => !c.quantas).map((c) => `${c.item.sigla}: ${c.item.texto}`),
    acoes: acoesEmOrdem().map((a) => ({
      data: a.data,
      titulo: a.titulo,
      categoria: a.categoria,
      vinculos: a.vinculos.map((v) => acharItemDoPlano(v)?.sigla).filter(Boolean),
      objetivo: a.objetivo,
      local: a.local,
      descricao: a.descricao,
      resultado: a.resultado,
      proximoPasso: a.proximoPasso,
      fotos: a.fotos.length,
    })),
    indicadores: p.indicadores.map((i) => ({
      periodo: i.rotulo,
      ...Object.fromEntries(INDICADORES.map((d) => [d.nome, i[d.chave]])),
    })),
  };

  const r = await ia.resumir(material);
  botao.disabled = false;
  botao.textContent = '✨ Escrever com IA';

  if (!r.ok) { recado(r.mensagem, r.motivo === 'sem-ia' ? '' : 'erro'); return; }

  const vindo = r.dados.fechamento;
  const f = p.fechamento;
  // não apaga o que a pessoa já escreveu: só preenche o que está vazio
  if (!f.resumo && vindo.resumo) f.resumo = vindo.resumo;
  ['entregas', 'pendencias', 'proximosPassos', 'atencao'].forEach((k) => {
    if (!f[k].length && (vindo[k] || []).length) f[k] = vindo[k];
  });
  mudou();
  desenhar(raiz);
  recado('Fechamento escrito. Revise antes de gerar o relatório.');
}
