/**
 * Times. Além do cadastro, é aqui que mora o valor da mensalidade — é o valor do
 * time que vale para todo mundo, e o atleta só sobrescreve quando tem acerto
 * próprio (bolsa, desconto de irmão).
 */
import { estado, salvar } from '../estado.js';
import { esc, abrirFolha, fecharFolha, recado, opcoes, confirmar } from '../ui.js';
import { atualizar, ir } from '../rota.js';
import { novoId, atletasDoTime, situacaoFinanceira } from '../modelo.js';
import { reais, emCentavos } from '../formato.js';

const DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

function folhaDoTime(existente) {
  const t = existente || {
    id: novoId('tm_'), escolaId: 'escola', nome: '', categoria: '', mensalidade: 0,
    dias: [], hora: '', local: '', tecnico: '', ativo: true,
  };

  const miolo = abrirFolha(existente ? t.nome : 'Novo time', `
    <label class="campo"><span>Nome do time</span>
      <input id="nome" value="${esc(t.nome)}" placeholder="Sub-15 Feminino"></label>
    <div class="dupla">
      <label class="campo"><span>Categoria</span>
        <input id="categoria" value="${esc(t.categoria)}" placeholder="Sub-15"></label>
      <label class="campo"><span>Mensalidade</span>
        <input id="mensalidade" inputmode="decimal" value="${t.mensalidade ? (t.mensalidade / 100).toFixed(2).replace('.', ',') : ''}" placeholder="150,00"></label>
    </div>
    <label class="campo"><span>Dias de treino</span></label>
    <div class="filtros" style="flex-wrap:wrap;padding-bottom:.8rem">
      ${DIAS.map((d) => `<button type="button" data-dia="${d}" aria-pressed="${(t.dias || []).includes(d)}">${d}</button>`).join('')}
    </div>
    <div class="dupla">
      <label class="campo"><span>Horário</span><input id="hora" type="time" value="${esc(t.hora)}"></label>
      <label class="campo"><span>Técnico</span><input id="tecnico" value="${esc(t.tecnico)}"></label>
    </div>
    <label class="campo"><span>Local</span><input id="local" value="${esc(t.local)}" placeholder="Ginásio do Clube"></label>
    <label class="campo" style="display:flex;align-items:center;gap:.5rem">
      <input type="checkbox" id="ativo" style="width:auto"${t.ativo !== false ? ' checked' : ''}>
      <span style="margin:0;text-transform:none;font-size:.85rem;letter-spacing:0">Time em atividade</span></label>

    <div class="acoes"><button class="btn cheio largo" id="gravar">Gravar</button></div>
    ${existente ? '<div class="acoes"><button class="btn perigo" id="apagar">Apagar time</button></div>' : ''}`);

  const dias = new Set(t.dias || []);
  miolo.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => {
    const dia = b.dataset.dia;
    if (dias.has(dia)) dias.delete(dia); else dias.add(dia);
    b.setAttribute('aria-pressed', dias.has(dia));
  }));

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const nome = miolo.querySelector('#nome').value.trim();
    if (!nome) { recado('O nome do time é obrigatório.'); return; }

    const novo = {
      ...t, nome,
      categoria: miolo.querySelector('#categoria').value.trim(),
      mensalidade: emCentavos(miolo.querySelector('#mensalidade').value),
      dias: DIAS.filter((d) => dias.has(d)),
      hora: miolo.querySelector('#hora').value,
      tecnico: miolo.querySelector('#tecnico').value.trim(),
      local: miolo.querySelector('#local').value.trim(),
      ativo: miolo.querySelector('#ativo').checked,
    };
    const i = estado.times.findIndex((x) => x.id === t.id);
    if (i >= 0) estado.times[i] = novo; else estado.times.push(novo);
    await salvar(); fecharFolha(); recado(existente ? 'Time atualizado.' : 'Time criado.'); atualizar();
  });

  miolo.querySelector('#apagar')?.addEventListener('click', async () => {
    const elenco = atletasDoTime(estado.atletas, t.id);
    if (elenco.length) {
      recado(`${elenco.length} atleta(s) ainda estão neste time. Mova-os antes.`);
      return;
    }
    if (!confirmar(`Apagar o time ${t.nome}?`)) return;
    estado.times = estado.times.filter((x) => x.id !== t.id);
    await salvar(); fecharFolha(); recado('Time apagado.'); atualizar();
  });
}

export function render(alvo) {
  alvo.innerHTML = `
    <h2>Times</h2>
    <p class="legenda">O valor da mensalidade sai daqui. O atleta só tem valor próprio quando há acerto diferente.</p>

    <div class="acoes" style="margin-bottom:.9rem">
      <button class="btn cheio" id="novo">+ Novo time</button>
    </div>

    ${estado.times.length ? `<div class="lista">
      ${estado.times.map((t) => {
    const elenco = atletasDoTime(estado.atletas, t.id).filter((a) => a.status === 'ativo');
    const devendo = elenco.filter((a) => situacaoFinanceira(a.id, estado.mensalidades).pendentes > 0).length;
    const receita = elenco.reduce((s, a) => s + (a.isento ? 0
      : Number.isFinite(a.mensalidade) ? a.mensalidade : t.mensalidade), 0);
    return `<button class="item clicavel" data-time="${esc(t.id)}">
        <div class="corpo">
          <div class="nome">${esc(t.nome)} ${t.ativo === false ? '<span class="ficha">parado</span>' : ''}</div>
          <div class="det">${elenco.length} atleta(s)${t.tecnico ? ` · ${esc(t.tecnico)}` : ''}${
  (t.dias || []).length ? ` · ${esc(t.dias.join(', '))}${t.hora ? ` ${esc(t.hora)}` : ''}` : ''}</div>
          <div class="det">${devendo ? `<span style="color:var(--perigo)">${devendo} devendo</span>` : 'todos em dia'}</div>
        </div>
        <div class="direita">
          <div class="valor">${reais(t.mensalidade)}</div>
          <div class="det">${reais(receita)}/mês</div>
        </div></button>`;
  }).join('')}
    </div>` : '<div class="vazio">Nenhum time ainda. Crie o primeiro para começar.</div>'}`;

  alvo.querySelector('#novo').addEventListener('click', () => folhaDoTime(null));
  alvo.querySelectorAll('[data-time]').forEach((b) =>
    b.addEventListener('click', () => folhaDoTime(estado.times.find((t) => t.id === b.dataset.time))));
}
