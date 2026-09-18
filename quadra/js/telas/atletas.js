/**
 * Atletas. A lista mostra a situação financeira na própria linha (a bolinha),
 * porque "quem está devendo" é a pergunta que o dono faz olhando a lista de
 * gente, não um relatório à parte.
 */
import { estado, salvar } from '../estado.js';
import { esc, iniciais, abrirFolha, fecharFolha, recado, opcoes, confirmar } from '../ui.js';
import { atualizar, ir } from '../rota.js';
import {
  situacaoFinanceira, novoId, posicoesDe, valorDaMensalidade, frequencia,
  ehMenor, destinatarioDaCobranca, atletasDoTime, modalidadeDe,
} from '../modelo.js';
import { mensagemDeCobranca, linkWhatsApp } from '../cobranca.js';
import { reais, emCentavos, idade, hoje, telefoneBonito, dataBR, plural } from '../formato.js';

let filtro = 'todos';

const nomeDoTime = (id) => estado.times.find((t) => t.id === id)?.nome || '—';

function folhaDoAtleta(existente) {
  const a = existente || {
    id: novoId('at_'), escolaId: 'escola', nome: '', nascimento: '', timeIds: [],
    posicao: '', numero: '', telefone: '', responsavelNome: '', responsavelTelefone: '',
    mensalidade: null, isento: false, vencimentoDia: estado.escola.vencimentoPadrao || 10,
    status: 'ativo', entradaEm: hoje(), observacoes: '',
  };
  const timeDoAtleta = estado.times.find((t) => t.id === a.timeIds?.[0]);
  const situacao = existente ? situacaoFinanceira(a.id, estado.mensalidades) : null;
  const freq = existente ? frequencia(a.id, estado.treinos) : null;

  const miolo = abrirFolha(existente ? a.nome : 'Novo atleta', `
    ${situacao && situacao.pendentes ? `<div class="faixa">
      <strong>${reais(situacao.devido)}</strong> em aberto ·
      ${plural(situacao.pendentes, 'mensalidade')}${situacao.diasDoMaisAntigo ? ` · ${plural(situacao.diasDoMaisAntigo, 'dia')} de atraso` : ''}
      <button class="btn p zap" id="cobrar" style="margin-left:.4rem">Cobrar</button>
    </div>` : ''}
    ${freq && freq.taxa !== null ? `<p class="legenda">Frequência nos treinos:
      <strong>${Math.round(freq.taxa * 100)}%</strong> (${freq.presencas} de ${freq.treinos}).</p>` : ''}

    <label class="campo"><span>Nome completo</span>
      <input id="nome" value="${esc(a.nome)}" placeholder="Ana Clara Ribeiro"></label>

    <div class="dupla">
      <label class="campo"><span>Nascimento</span><input id="nascimento" type="date" value="${esc(a.nascimento)}"></label>
      <label class="campo"><span>Time</span>
        <select id="time">${opcoes([['', '— sem time —'], ...estado.times.map((t) => [t.id, t.nome])], a.timeIds?.[0] || '')}</select></label>
    </div>

    <div class="dupla">
      <label class="campo"><span>Posição</span>
        <select id="posicao">${opcoes([['', '—'], ...posicoesDe(timeDoAtleta)], a.posicao)}</select></label>
      <label class="campo"><span>Camisa</span><input id="numero" inputmode="numeric" value="${esc(a.numero)}"></label>
    </div>

    <h3 style="margin-top:1rem">Contato</h3>
    <label class="campo"><span>WhatsApp do atleta</span>
      <input id="telefone" inputmode="tel" value="${esc(telefoneBonito(a.telefone))}" placeholder="(21) 98888-7777"></label>
    <div class="dupla">
      <label class="campo"><span>Responsável</span><input id="respNome" value="${esc(a.responsavelNome)}"></label>
      <label class="campo"><span>WhatsApp do responsável</span>
        <input id="respTel" inputmode="tel" value="${esc(telefoneBonito(a.responsavelTelefone))}"></label>
    </div>
    <p class="dica">Menor de idade: a cobrança vai para o responsável, nunca para o atleta.</p>

    <h3 style="margin-top:1rem">Mensalidade</h3>
    <div class="dupla">
      <label class="campo"><span>Valor próprio</span>
        <input id="mensalidade" inputmode="decimal" value="${Number.isFinite(a.mensalidade) && a.mensalidade > 0 ? (a.mensalidade / 100).toFixed(2).replace('.', ',') : ''}"
          placeholder="usa o do time"></label>
      <label class="campo"><span>Vence todo dia</span><input id="vencimentoDia" type="number" min="1" max="31" value="${esc(a.vencimentoDia)}"></label>
    </div>
    <label class="campo" style="display:flex;align-items:center;gap:.5rem">
      <input type="checkbox" id="isento" style="width:auto"${a.isento ? ' checked' : ''}>
      <span style="margin:0;text-transform:none;font-size:.85rem;letter-spacing:0">Bolsista / isento — não gera cobrança</span></label>

    <div class="dupla">
      <label class="campo"><span>Situação</span>
        <select id="status">${opcoes([['ativo', 'Ativo'], ['inativo', 'Inativo']], a.status)}</select></label>
      <label class="campo"><span>Entrou em</span><input id="entradaEm" type="date" value="${esc(a.entradaEm)}"></label>
    </div>
    <label class="campo"><span>Observações</span><textarea id="observacoes">${esc(a.observacoes)}</textarea></label>

    <div class="acoes"><button class="btn cheio largo" id="gravar">Gravar</button></div>
    ${existente ? '<div class="acoes"><button class="btn perigo" id="apagar">Apagar atleta</button></div>' : ''}`,
    { subtitulo: existente
      ? `${nomeDoTime(a.timeIds?.[0])}${timeDoAtleta ? ` · ${modalidadeDe(timeDoAtleta).nome}` : ''}${
        a.nascimento ? ` · ${idade(a.nascimento)} anos` : ''}`
      : '' });

  miolo.querySelector('#cobrar')?.addEventListener('click', () => {
    const msg = mensagemDeCobranca(a, estado.mensalidades, estado.escola, hoje());
    const link = msg?.destino && linkWhatsApp(msg.destino.telefone, msg.texto);
    if (!link) { recado('Sem telefone cadastrado.'); return; }
    window.open(link, '_blank');
  });

  // Trocar o time troca a modalidade, e handebol não tem "Ponteiro". Sem isto a
  // posição continuaria mostrando a lista do esporte anterior.
  const selTime = miolo.querySelector('#time');
  const selPosicao = miolo.querySelector('#posicao');
  selTime.addEventListener('change', () => {
    const novoTime = estado.times.find((t) => t.id === selTime.value);
    const atual = selPosicao.value;
    const lista = posicoesDe(novoTime);
    selPosicao.innerHTML = opcoes([['', '—'], ...lista], lista.includes(atual) ? atual : '');
  });

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const nome = miolo.querySelector('#nome').value.trim();
    if (!nome) { recado('O nome é obrigatório.'); return; }

    const valorProprio = emCentavos(miolo.querySelector('#mensalidade').value);
    const time = miolo.querySelector('#time').value;
    const novo = {
      ...a,
      nome,
      nascimento: miolo.querySelector('#nascimento').value,
      timeIds: time ? [time] : [],
      posicao: miolo.querySelector('#posicao').value,
      numero: miolo.querySelector('#numero').value.trim(),
      telefone: miolo.querySelector('#telefone').value.replace(/\D/g, ''),
      responsavelNome: miolo.querySelector('#respNome').value.trim(),
      responsavelTelefone: miolo.querySelector('#respTel').value.replace(/\D/g, ''),
      // Vazio vira null, não 0: null é "usa o do time", 0 seria "não paga nada".
      mensalidade: valorProprio > 0 ? valorProprio : null,
      isento: miolo.querySelector('#isento').checked,
      vencimentoDia: Number(miolo.querySelector('#vencimentoDia').value) || 10,
      status: miolo.querySelector('#status').value,
      entradaEm: miolo.querySelector('#entradaEm').value,
      observacoes: miolo.querySelector('#observacoes').value.trim(),
    };

    const i = estado.atletas.findIndex((x) => x.id === a.id);
    if (i >= 0) estado.atletas[i] = novo; else estado.atletas.push(novo);
    await salvar(); fecharFolha(); recado(existente ? 'Atleta atualizado.' : 'Atleta cadastrado.'); atualizar();
  });

  miolo.querySelector('#apagar')?.addEventListener('click', async () => {
    const dele = estado.mensalidades.filter((m) => m.atletaId === a.id);
    if (!confirmar(`Apagar ${a.nome}?\n\n${plural(dele.length, 'mensalidade')} e o histórico de presença vão junto. Não dá para desfazer.`)) return;
    estado.atletas = estado.atletas.filter((x) => x.id !== a.id);
    estado.mensalidades = estado.mensalidades.filter((m) => m.atletaId !== a.id);
    estado.lancamentos = estado.lancamentos.filter((l) => !dele.some((m) => l.refId === m.id));
    estado.jogos.forEach((j) => { j.escalados = (j.escalados || []).filter((e) => e.atletaId !== a.id); });
    estado.treinos.forEach((t) => { t.presencas = (t.presencas || []).filter((p) => p.atletaId !== a.id); });
    await salvar(); fecharFolha(); recado('Atleta apagado.'); atualizar();
  });
}

export function render(alvo, params = {}) {
  if (params.filtro) { filtro = params.filtro; delete params.filtro; }

  let lista = [...estado.atletas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (filtro === 'devendo') {
    lista = lista.filter((a) => situacaoFinanceira(a.id, estado.mensalidades).pendentes > 0);
  } else if (filtro === 'inativos') {
    lista = lista.filter((a) => a.status !== 'ativo');
  } else if (filtro !== 'todos') {
    lista = lista.filter((a) => a.timeIds?.includes(filtro));
  }
  if (filtro !== 'inativos') lista = lista.filter((a) => a.status === 'ativo' || filtro === 'todos');

  const devendo = estado.atletas.filter((a) => situacaoFinanceira(a.id, estado.mensalidades).pendentes > 0).length;

  alvo.innerHTML = `
    <h2>Atletas</h2>
    <p class="legenda">${estado.atletas.filter((a) => a.status === 'ativo').length} ativos · a bolinha mostra a situação da mensalidade.</p>

    <div class="filtros">
      <button data-filtro="todos" aria-pressed="${filtro === 'todos'}">Todos</button>
      <button data-filtro="devendo" aria-pressed="${filtro === 'devendo'}">Devendo${devendo ? ` (${devendo})` : ''}</button>
      ${estado.times.map((t) => `<button data-filtro="${esc(t.id)}" aria-pressed="${filtro === t.id}">${esc(t.nome)}</button>`).join('')}
      <button data-filtro="inativos" aria-pressed="${filtro === 'inativos'}">Inativos</button>
    </div>

    <div class="acoes" style="margin-bottom:.9rem">
      <button class="btn cheio" id="novo">+ Novo atleta</button>
    </div>

    ${lista.length ? `<div class="lista">
      ${lista.map((a) => {
    const s = situacaoFinanceira(a.id, estado.mensalidades);
    const anos = idade(a.nascimento);
    return `<button class="item clicavel" data-atleta="${esc(a.id)}">
        <div class="avatar">${esc(iniciais(a.nome))}</div>
        <div class="corpo">
          <div class="nome"><span class="bola ${s.status}"></span>${esc(a.nome)}
            ${a.isento ? '<span class="ficha accent">bolsista</span>' : ''}
            ${a.status !== 'ativo' ? '<span class="ficha">inativo</span>' : ''}</div>
          <div class="det">${esc(nomeDoTime(a.timeIds?.[0]))}${a.posicao ? ` · ${esc(a.posicao)}` : ''}${
  a.numero ? ` · nº ${esc(a.numero)}` : ''}${anos !== null ? ` · ${anos} anos` : ''}</div>
        </div>
        <div class="direita">
          ${s.pendentes
    ? `<div class="valor" style="color:${s.atrasadas ? 'var(--perigo)' : 'var(--alerta)'};font-size:.9rem">${reais(s.devido)}</div>
             <div class="det">${s.atrasadas ? 'em atraso' : 'a vencer'}</div>`
    : `<div class="ficha ok">em dia</div>`}
        </div></button>`;
  }).join('')}
    </div>` : `<div class="vazio">${estado.times.length
    ? 'Nenhum atleta neste filtro.'
    : 'Crie um time antes de cadastrar atletas — é dele que sai o valor da mensalidade.<br><button class="btn p" id="ir-times" style="margin-top:.6rem">Ir para Times</button>'}</div>`}`;

  alvo.querySelectorAll('[data-filtro]').forEach((b) =>
    b.addEventListener('click', () => { filtro = b.dataset.filtro; atualizar(); }));
  alvo.querySelector('#novo').addEventListener('click', () => folhaDoAtleta(null));
  alvo.querySelector('#ir-times')?.addEventListener('click', () => ir('times'));
  alvo.querySelectorAll('[data-atleta]').forEach((b) =>
    b.addEventListener('click', () => folhaDoAtleta(estado.atletas.find((a) => a.id === b.dataset.atleta))));
}
