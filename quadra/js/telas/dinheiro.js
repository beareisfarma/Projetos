/**
 * Dinheiro: mensalidades, cobrança e caixa. Três abas porque são três momentos
 * diferentes do mesmo mês — emitir, cobrar quem não pagou, e olhar o que sobrou.
 *
 * O ponto que costura tudo: dar baixa numa mensalidade LANÇA A ENTRADA NO CAIXA
 * sozinha, com id derivado do id da mensalidade. Por isso apertar duas vezes não
 * duplica receita, e desfazer a baixa tira a entrada junto.
 */
import { estado, salvar } from '../estado.js';
import { esc, iniciais, abrirFolha, fecharFolha, recado, opcoes, confirmar, copiar } from '../ui.js';
import { atualizar } from '../rota.js';
import {
  gerarMensalidades, previsaoDoMes, resumoDoMes, filaDeCobranca, saldoAcumulado,
  pagarMensalidade, desfazerPagamento, idDoLancamento, estaAtrasada, diasDeAtraso,
  novoId, CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, destinatarioDaCobranca,
} from '../modelo.js';
import { mensagemDeCobranca, mensagemDeRecibo, linkWhatsApp } from '../cobranca.js';
import { copiaECola } from '../pix.js';
import {
  reais, reaisComSinal, emCentavos, competenciaAtual, competenciaPorExtenso,
  somarMeses, hoje, dataBR, dataCurta, telefoneBonito,
} from '../formato.js';

let mes = competenciaAtual();
let aba = 'mensalidades';

const atletaPor = (id) => estado.atletas.find((a) => a.id === id);
const nomeDoAtleta = (id) => atletaPor(id)?.nome || 'atleta removido';

// ─── Ações ───────────────────────────────────────────────────────────────────

async function gerarDoMes() {
  const novas = gerarMensalidades({
    atletas: estado.atletas, times: estado.times, competencia: mes,
    existentes: estado.mensalidades,
  });
  if (!novas.length) {
    recado('Nada a gerar — todo mundo já tem cobrança neste mês.');
    return;
  }
  estado.mensalidades.push(...novas);
  await salvar();
  recado(`${novas.length} mensalidade${novas.length > 1 ? 's geradas' : ' gerada'}.`);
  atualizar();
}

/** Grava o lançamento substituindo o de mesmo id — é o que torna a baixa repetível. */
function gravarLancamento(lancamento) {
  const i = estado.lancamentos.findIndex((l) => l.id === lancamento.id);
  if (i >= 0) estado.lancamentos[i] = lancamento;
  else estado.lancamentos.push(lancamento);
}

async function darBaixa(mensalidade, { pagoEm, forma, valorPago }) {
  const atleta = atletaPor(mensalidade.atletaId);
  const { mensalidade: paga, lancamento } = pagarMensalidade(mensalidade, atleta, { pagoEm, forma, valorPago });
  const i = estado.mensalidades.findIndex((m) => m.id === mensalidade.id);
  estado.mensalidades[i] = paga;
  gravarLancamento(lancamento);
  await salvar();
  fecharFolha();
  recado(`Baixa dada — ${reais(paga.valor)} no caixa.`);
  atualizar();
  return paga;
}

async function desfazer(mensalidade) {
  if (!confirmar(`Desfazer a baixa de ${competenciaPorExtenso(mensalidade.competencia)} de ${nomeDoAtleta(mensalidade.atletaId)}?\n\nA entrada some do caixa junto.`)) return;
  const { mensalidade: pendente, lancamentoRemovido } = desfazerPagamento(mensalidade);
  const i = estado.mensalidades.findIndex((m) => m.id === mensalidade.id);
  estado.mensalidades[i] = pendente;
  estado.lancamentos = estado.lancamentos.filter((l) => l.id !== lancamentoRemovido);
  await salvar();
  fecharFolha();
  recado('Baixa desfeita.');
  atualizar();
}

// ─── Folhas ──────────────────────────────────────────────────────────────────

function folhaDaMensalidade(mensalidade) {
  const atleta = atletaPor(mensalidade.atletaId);
  const paga = mensalidade.status === 'pago';
  const atrasada = estaAtrasada(mensalidade);

  const miolo = abrirFolha(
    nomeDoAtleta(mensalidade.atletaId),
    paga ? `
      <div class="faixa" style="background:var(--ok-fraco);color:var(--ok)">
        <strong>Pago em ${dataBR(mensalidade.pagoEm)}</strong> · ${esc(mensalidade.forma || 'forma não informada')} · ${reais(mensalidade.valor)}
      </div>
      <div class="acoes">
        <button class="btn zap" id="recibo">Mandar recibo no WhatsApp</button>
        <button class="btn perigo" id="desfazer">Desfazer baixa</button>
      </div>`
      : `
      ${atrasada ? `<div class="faixa"><strong>Venceu em ${dataBR(mensalidade.vencimento)}</strong> — ${diasDeAtraso(mensalidade)} dia(s) de atraso.</div>` : ''}
      <label class="campo"><span>Valor recebido</span>
        <input id="valor" inputmode="decimal" value="${(mensalidade.valor / 100).toFixed(2).replace('.', ',')}"></label>
      <p class="dica">Mude se houve desconto ou pagamento parcial acertado.</p>
      <div class="dupla">
        <label class="campo"><span>Recebido em</span><input id="pagoEm" type="date" value="${hoje()}"></label>
        <label class="campo"><span>Forma</span>
          <select id="forma">${opcoes(['Pix', 'Dinheiro', 'Transferência', 'Cartão', 'Outro'], 'Pix')}</select></label>
      </div>
      <div class="acoes">
        <button class="btn cheio largo" id="pagar">Dar baixa e lançar no caixa</button>
      </div>
      <div class="acoes">
        <button class="btn zap" id="cobrar">Cobrar no WhatsApp</button>
        ${estado.escola.pixChave ? '<button class="btn" id="pix">Copiar Pix</button>' : ''}
        <button class="btn perigo" id="cancelar">Cancelar cobrança</button>
      </div>`,
    { subtitulo: `${competenciaPorExtenso(mensalidade.competencia)} · vence ${dataBR(mensalidade.vencimento)}` },
  );

  miolo.querySelector('#pagar')?.addEventListener('click', () => darBaixa(mensalidade, {
    pagoEm: miolo.querySelector('#pagoEm').value || hoje(),
    forma: miolo.querySelector('#forma').value,
    valorPago: emCentavos(miolo.querySelector('#valor').value),
  }));

  miolo.querySelector('#desfazer')?.addEventListener('click', () => desfazer(mensalidade));

  miolo.querySelector('#cobrar')?.addEventListener('click', () => {
    const msg = mensagemDeCobranca(atleta, estado.mensalidades, estado.escola, hoje());
    const link = msg?.destino && linkWhatsApp(msg.destino.telefone, msg.texto);
    if (!link) { recado('Este atleta não tem telefone cadastrado.'); return; }
    window.open(link, '_blank');
  });

  miolo.querySelector('#recibo')?.addEventListener('click', () => {
    const msg = mensagemDeRecibo(atleta, mensalidade, estado.escola);
    const link = msg?.destino && linkWhatsApp(msg.destino.telefone, msg.texto);
    if (!link) { recado('Este atleta não tem telefone cadastrado.'); return; }
    window.open(link, '_blank');
  });

  miolo.querySelector('#pix')?.addEventListener('click', async () => {
    const codigo = copiaECola({
      chave: estado.escola.pixChave, nome: estado.escola.pixNome || estado.escola.nome,
      cidade: estado.escola.pixCidade, centavos: mensalidade.valor,
      txid: `${mensalidade.atletaId}${mensalidade.competencia}`,
    });
    recado(await copiar(codigo) ? 'Código Pix copiado.' : 'Não consegui copiar.');
  });

  miolo.querySelector('#cancelar')?.addEventListener('click', async () => {
    if (!confirmar('Cancelar esta cobrança? Ela some da lista de pendentes.')) return;
    const i = estado.mensalidades.findIndex((m) => m.id === mensalidade.id);
    estado.mensalidades[i] = { ...mensalidade, status: 'cancelado' };
    await salvar(); fecharFolha(); recado('Cobrança cancelada.'); atualizar();
  });
}

function folhaDeLancamento(existente, tipoPadrao = 'saida') {
  const l = existente || {
    id: novoId('l_'), escolaId: 'escola', data: hoje(), tipo: tipoPadrao,
    categoria: '', descricao: '', valor: 0, forma: 'Pix', origem: 'manual', refId: null,
  };
  const daMensalidade = l.origem === 'mensalidade';

  const miolo = abrirFolha(
    existente ? 'Editar lançamento' : (tipoPadrao === 'entrada' ? 'Nova entrada' : 'Nova saída'),
    `
    ${daMensalidade ? `<div class="faixa info">Esta entrada veio da baixa de uma mensalidade.
      Para mexer nela, desfaça a baixa na aba Mensalidades — assim a cobrança e o caixa não se
      contradizem.</div>` : ''}
    <div class="dupla">
      <label class="campo"><span>Tipo</span>
        <select id="tipo"${daMensalidade ? ' disabled' : ''}>${opcoes([['entrada', 'Entrada'], ['saida', 'Saída']], l.tipo)}</select></label>
      <label class="campo"><span>Data</span><input id="data" type="date" value="${esc(l.data)}"${daMensalidade ? ' disabled' : ''}></label>
    </div>
    <label class="campo"><span>Categoria</span><select id="categoria"${daMensalidade ? ' disabled' : ''}></select></label>
    <label class="campo"><span>Descrição</span>
      <input id="descricao" value="${esc(l.descricao)}" placeholder="Aluguel do ginásio"${daMensalidade ? ' disabled' : ''}></label>
    <div class="dupla">
      <label class="campo"><span>Valor</span>
        <input id="valor" inputmode="decimal" value="${l.valor ? (l.valor / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"${daMensalidade ? ' disabled' : ''}></label>
      <label class="campo"><span>Forma</span>
        <select id="forma"${daMensalidade ? ' disabled' : ''}>${opcoes(['Pix', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto', 'Outro'], l.forma)}</select></label>
    </div>
    ${daMensalidade ? '' : `<div class="acoes">
      <button class="btn cheio largo" id="gravar">Gravar</button>
    </div>`}
    ${existente && !daMensalidade ? '<div class="acoes"><button class="btn perigo" id="apagar">Apagar lançamento</button></div>' : ''}`,
  );

  const selTipo = miolo.querySelector('#tipo');
  const selCat = miolo.querySelector('#categoria');
  const encherCategorias = () => {
    selCat.innerHTML = opcoes(selTipo.value === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA, l.categoria);
  };
  encherCategorias();
  selTipo.addEventListener('change', encherCategorias);

  miolo.querySelector('#gravar')?.addEventListener('click', async () => {
    const valor = emCentavos(miolo.querySelector('#valor').value);
    if (valor <= 0) { recado('Informe um valor maior que zero.'); return; }

    const novo = {
      ...l,
      data: miolo.querySelector('#data').value || hoje(),
      tipo: selTipo.value,
      categoria: selCat.value,
      descricao: miolo.querySelector('#descricao').value.trim() || selCat.value,
      valor,
      forma: miolo.querySelector('#forma').value,
      criadoEm: l.criadoEm || new Date().toISOString(),
    };
    gravarLancamento(novo);
    await salvar(); fecharFolha(); recado('Lançamento gravado.'); atualizar();
  });

  miolo.querySelector('#apagar')?.addEventListener('click', async () => {
    if (!confirmar('Apagar este lançamento?')) return;
    estado.lancamentos = estado.lancamentos.filter((x) => x.id !== l.id);
    await salvar(); fecharFolha(); recado('Lançamento apagado.'); atualizar();
  });
}

// ─── Abas ────────────────────────────────────────────────────────────────────

function abaMensalidades() {
  const doMes = estado.mensalidades
    .filter((m) => m.competencia === mes && m.status !== 'cancelado')
    .sort((a, b) => {
      const peso = (m) => (estaAtrasada(m) ? 0 : m.status === 'pendente' ? 1 : 2);
      return peso(a) - peso(b) || nomeDoAtleta(a.atletaId).localeCompare(nomeDoAtleta(b.atletaId), 'pt-BR');
    });
  const p = previsaoDoMes(estado.mensalidades, mes);

  if (!doMes.length) {
    return `<div class="vazio">
      Nenhuma mensalidade emitida em ${competenciaPorExtenso(mes)}.
      <br><button class="btn cheio" id="gerar" style="margin-top:.8rem">Gerar as mensalidades do mês</button>
      <div class="det" style="margin-top:.6rem;font-size:.75rem">
        Uma por atleta ativo, pelo valor do time (ou o valor próprio do atleta).</div>
    </div>`;
  }

  return `
    <div class="painel tres">
      <div class="bloco" style="cursor:default"><span class="rot">Emitido</span>
        <span class="val" style="font-size:1.05rem">${reais(p.emitido)}</span>
        <span class="pe">${p.quantidade} cobranças</span></div>
      <div class="bloco" style="cursor:default"><span class="rot">Recebido</span>
        <span class="val ok" style="font-size:1.05rem">${reais(p.recebido)}</span>
        <span class="pe">${p.pagas} pagas</span></div>
      <div class="bloco" style="cursor:default"><span class="rot">Em aberto</span>
        <span class="val ${p.atrasadas ? 'perigo' : ''}" style="font-size:1.05rem">${reais(p.aReceber)}</span>
        <span class="pe">${p.atrasadas} em atraso</span></div>
    </div>
    <div class="acoes" style="margin-bottom:.8rem">
      <button class="btn p" id="gerar">Gerar as que faltam</button>
    </div>
    <div class="lista">
      ${doMes.map((m) => {
    const atrasada = estaAtrasada(m);
    const paga = m.status === 'pago';
    return `<button class="item clicavel" data-mens="${esc(m.id)}">
          <div class="avatar">${esc(iniciais(nomeDoAtleta(m.atletaId)))}</div>
          <div class="corpo">
            <div class="nome"><span class="bola ${paga ? 'dia' : atrasada ? 'atraso' : 'aberto'}"></span>${esc(nomeDoAtleta(m.atletaId))}</div>
            <div class="det">${paga ? `pago em ${dataCurta(m.pagoEm)} · ${esc(m.forma || '—')}`
      : atrasada ? `venceu ${dataCurta(m.vencimento)} · ${diasDeAtraso(m)} dia(s)`
        : `vence ${dataCurta(m.vencimento)}`}</div>
          </div>
          <div class="direita">
            <div class="valor" ${paga ? 'style="color:var(--ok)"' : atrasada ? 'style="color:var(--perigo)"' : ''}>${reais(m.valor)}</div>
          </div></button>`;
  }).join('')}
    </div>`;
}

function abaCobrar() {
  const fila = filaDeCobranca(estado.atletas, estado.mensalidades);
  if (!fila.length) {
    return '<div class="vazio">Ninguém devendo. Aproveita. 🏐</div>';
  }
  const total = fila.reduce((s, l) => s + l.situacao.devido, 0);
  const emAtraso = fila.reduce((s, l) => s + l.situacao.emAtraso, 0);

  return `
    <div class="faixa ${emAtraso ? '' : 'info'}">
      <strong>${reais(total)}</strong> em aberto com ${fila.length} atleta${fila.length > 1 ? 's' : ''}${emAtraso ? ` — ${reais(emAtraso)} já vencido` : ''}.
    </div>
    <p class="legenda">A mensagem sai pronta, com os meses em aberto e o Pix copia e cola.
      De menor de idade vai para o responsável.</p>
    <div class="lista">
      ${fila.map(({ atleta, situacao }) => {
    const destino = destinatarioDaCobranca(atleta);
    return `<div class="item">
          <div class="avatar">${esc(iniciais(atleta.nome))}</div>
          <div class="corpo">
            <div class="nome"><span class="bola ${situacao.status}"></span>${esc(atleta.nome)}</div>
            <div class="det">${situacao.pendentes} mensalidade${situacao.pendentes > 1 ? 's' : ''}${
  situacao.diasDoMaisAntigo ? ` · ${situacao.diasDoMaisAntigo} dia(s) de atraso` : ' · a vencer'}</div>
            <div class="det">${destino
    ? `${esc(destino.paraResponsavel ? `${destino.nome} (responsável)` : 'WhatsApp')} · ${esc(telefoneBonito(destino.telefone))}`
    : '<span style="color:var(--perigo)">sem telefone cadastrado</span>'}</div>
          </div>
          <div class="direita">
            <div class="valor" style="color:${situacao.emAtraso ? 'var(--perigo)' : 'var(--alerta)'}">${reais(situacao.devido)}</div>
            <div style="display:flex;gap:.3rem;margin-top:.35rem;justify-content:flex-end">
              <button class="btn p" data-ver="${esc(atleta.id)}">Ver</button>
              <button class="btn p zap" data-zap="${esc(atleta.id)}"${destino ? '' : ' disabled'}>WhatsApp</button>
            </div>
          </div></div>`;
  }).join('')}
    </div>`;
}

function abaCaixa() {
  const r = resumoDoMes(estado.lancamentos, mes);
  const doMes = estado.lancamentos
    .filter((l) => l.data.slice(0, 7) === mes)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || '').localeCompare(a.criadoEm || ''));

  const categorias = Object.entries(r.porCategoria)
    .map(([chave, valor]) => ({ tipo: chave.split('|')[0], nome: chave.split('|')[1], valor }))
    .sort((a, b) => b.valor - a.valor);

  return `
    <div class="painel tres">
      <div class="bloco" style="cursor:default"><span class="rot">Entrou</span>
        <span class="val ok" style="font-size:1.05rem">${reais(r.entradas)}</span></div>
      <div class="bloco" style="cursor:default"><span class="rot">Saiu</span>
        <span class="val perigo" style="font-size:1.05rem">${reais(r.saidas)}</span></div>
      <div class="bloco" style="cursor:default"><span class="rot">Saldo</span>
        <span class="val ${r.saldo >= 0 ? 'ok' : 'perigo'}" style="font-size:1.05rem">${reais(r.saldo)}</span>
        <span class="pe">acumulado ${reais(saldoAcumulado(estado.lancamentos, mes))}</span></div>
    </div>

    <div class="acoes" style="margin-bottom:.9rem">
      <button class="btn cheio" id="nova-saida">− Saída</button>
      <button class="btn" id="nova-entrada">+ Entrada</button>
    </div>

    ${categorias.length ? `
      <h3>Por categoria</h3>
      <div class="cartao"><table>
        <tbody>${categorias.map((c) => `<tr>
          <td>${esc(c.nome)}</td>
          <td class="n" style="color:${c.tipo === 'entrada' ? 'var(--ok)' : 'var(--perigo)'}">
            ${c.tipo === 'entrada' ? '+' : '−'} ${reais(c.valor)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}

    <h3>Movimento de ${competenciaPorExtenso(mes)}</h3>
    ${doMes.length ? `<div class="lista">
      ${doMes.map((l) => `<button class="item clicavel" data-lanc="${esc(l.id)}">
        <div class="corpo">
          <div class="nome" style="font-size:.92rem">${esc(l.descricao || l.categoria)}</div>
          <div class="det">${dataCurta(l.data)} · ${esc(l.categoria)}${l.origem === 'mensalidade' ? ' · automático' : ''}</div>
        </div>
        <div class="direita">
          <div class="valor" style="color:${l.tipo === 'entrada' ? 'var(--ok)' : 'var(--perigo)'}">
            ${reaisComSinal(l.tipo === 'entrada' ? l.valor : -l.valor)}</div>
        </div></button>`).join('')}
    </div>` : '<div class="vazio">Nenhum lançamento neste mês.</div>'}`;
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function render(alvo, params = {}) {
  if (params.aba) { aba = params.aba; delete params.aba; }
  if (params.mes) { mes = params.mes; delete params.mes; }

  const conteudo = aba === 'cobrar' ? abaCobrar() : aba === 'caixa' ? abaCaixa() : abaMensalidades();
  const emAtraso = filaDeCobranca(estado.atletas, estado.mensalidades).filter((l) => l.situacao.atrasadas).length;

  alvo.innerHTML = `
    <h2>Dinheiro</h2>
    <p class="legenda">Mensalidades, cobrança e caixa da escolinha.</p>

    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.7rem">
      <button class="icone" id="mes-anterior" aria-label="Mês anterior">‹</button>
      <strong style="flex:1;text-align:center;font-size:.95rem;text-transform:capitalize">${competenciaPorExtenso(mes)}</strong>
      <button class="icone" id="mes-seguinte" aria-label="Próximo mês">›</button>
    </div>

    <div class="filtros">
      <button data-aba="mensalidades" aria-pressed="${aba === 'mensalidades'}">Mensalidades</button>
      <button data-aba="cobrar" aria-pressed="${aba === 'cobrar'}">Cobrar${emAtraso ? ` (${emAtraso})` : ''}</button>
      <button data-aba="caixa" aria-pressed="${aba === 'caixa'}">Caixa</button>
    </div>

    ${conteudo}`;

  alvo.querySelector('#mes-anterior').addEventListener('click', () => { mes = somarMeses(mes, -1); atualizar(); });
  alvo.querySelector('#mes-seguinte').addEventListener('click', () => { mes = somarMeses(mes, 1); atualizar(); });
  alvo.querySelectorAll('[data-aba]').forEach((b) =>
    b.addEventListener('click', () => { aba = b.dataset.aba; atualizar(); }));

  alvo.querySelector('#gerar')?.addEventListener('click', gerarDoMes);
  alvo.querySelector('#nova-saida')?.addEventListener('click', () => folhaDeLancamento(null, 'saida'));
  alvo.querySelector('#nova-entrada')?.addEventListener('click', () => folhaDeLancamento(null, 'entrada'));

  alvo.querySelectorAll('[data-mens]').forEach((b) => b.addEventListener('click', () =>
    folhaDaMensalidade(estado.mensalidades.find((m) => m.id === b.dataset.mens))));

  alvo.querySelectorAll('[data-lanc]').forEach((b) => b.addEventListener('click', () =>
    folhaDeLancamento(estado.lancamentos.find((l) => l.id === b.dataset.lanc))));

  alvo.querySelectorAll('[data-zap]').forEach((b) => b.addEventListener('click', () => {
    const atleta = atletaPor(b.dataset.zap);
    const msg = mensagemDeCobranca(atleta, estado.mensalidades, estado.escola, hoje());
    const link = msg?.destino && linkWhatsApp(msg.destino.telefone, msg.texto);
    if (!link) { recado('Sem telefone cadastrado.'); return; }
    window.open(link, '_blank');
  }));

  alvo.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const atleta = atletaPor(b.dataset.ver);
    const msg = mensagemDeCobranca(atleta, estado.mensalidades, estado.escola, hoje());
    const miolo = abrirFolha(atleta.nome, `
      <p class="legenda">É este o texto que vai para
        ${esc(msg.destino ? (msg.destino.paraResponsavel ? `${msg.destino.nome}, responsável` : 'o atleta') : 'ninguém — falta telefone')}.
        Dá para editar antes de mandar.</p>
      <textarea id="texto" style="min-height:230px;font-size:.84rem">${esc(msg.texto)}</textarea>
      <div class="acoes">
        <button class="btn zap" id="mandar"${msg.destino ? '' : ' disabled'}>Abrir no WhatsApp</button>
        <button class="btn" id="copiar-texto">Copiar texto</button>
      </div>`, { subtitulo: `${reais(msg.total)} em ${msg.pendentes.length} mensalidade(s)` });

    miolo.querySelector('#mandar')?.addEventListener('click', () => {
      window.open(linkWhatsApp(msg.destino.telefone, miolo.querySelector('#texto').value), '_blank');
      fecharFolha();
    });
    miolo.querySelector('#copiar-texto').addEventListener('click', async () => {
      recado(await copiar(miolo.querySelector('#texto').value) ? 'Texto copiado.' : 'Não consegui copiar.');
    });
  }));
}
