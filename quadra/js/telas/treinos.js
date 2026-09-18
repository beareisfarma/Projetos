/**
 * Treinos e chamada.
 *
 * Dois momentos diferentes, e o app separa os dois de propósito:
 *
 *  ANTES — "confirmou": quem avisou que vem. Serve para planejar (dá seis para
 *  treinar coletivo ou vai ser fundamento?). Hoje isso chega pelo WhatsApp do
 *  grupo e o dono marca aqui; quando existir login de atleta, o próprio marca.
 *
 *  DEPOIS — "presente/faltou": a chamada, feita na quadra. É o que alimenta a
 *  frequência do atleta.
 *
 * Misturar os dois faria a frequência mentir — por isso `frequencia()` só conta
 * treino em que a chamada foi realmente feita.
 */
import { estado, salvar } from '../estado.js';
import { esc, iniciais, abrirFolha, fecharFolha, recado, opcoes, confirmar, copiar } from '../ui.js';
import { atualizar } from '../rota.js';
import { novoId, atletasDoTime, resumoDePresenca, destinatarioDaCobranca } from '../modelo.js';
import { mensagemDeTreino, linkWhatsApp } from '../cobranca.js';
import { empacotar, pacoteDoTreino, enderecoDoLink } from '../partilha.js';
import { hoje, dataBR, dataCurta, diaDaSemana } from '../formato.js';

const ESTADOS = [
  ['confirmado', 'Confirmou'],
  ['presente', 'Veio'],
  ['falta', 'Faltou'],
  ['justificado', 'Justificou'],
];

const nomeDoTime = (id) => estado.times.find((t) => t.id === id)?.nome || 'time';

function folhaDoTreino(existente) {
  const time = estado.times.find((t) => t.id === (existente?.timeId || estado.times[0]?.id));
  const t = existente || {
    id: novoId('tr_'), escolaId: 'escola', timeId: time?.id || '',
    data: hoje(), hora: time?.hora || '', local: time?.local || '', foco: '', presencas: [],
  };

  const miolo = abrirFolha(existente ? `Treino — ${nomeDoTime(t.timeId)}` : 'Novo treino', `
    <div class="dupla">
      <label class="campo"><span>Time</span>
        <select id="timeId">${opcoes(estado.times.map((x) => [x.id, x.nome]), t.timeId)}</select></label>
      <label class="campo"><span>Data</span><input id="data" type="date" value="${esc(t.data)}"></label>
    </div>
    <div class="dupla">
      <label class="campo"><span>Hora</span><input id="hora" type="time" value="${esc(t.hora)}"></label>
      <label class="campo"><span>Local</span><input id="local" value="${esc(t.local)}"></label>
    </div>
    <label class="campo"><span>Foco do treino</span>
      <input id="foco" value="${esc(t.foco)}" placeholder="Recepção e passe"></label>
    <div class="acoes"><button class="btn cheio largo" id="gravar">Gravar</button></div>
    ${existente ? '<div class="acoes"><button class="btn perigo" id="apagar">Apagar treino</button></div>' : ''}`);

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const timeId = miolo.querySelector('#timeId').value;
    if (!timeId) { recado('Crie um time antes.'); return; }

    const novo = {
      ...t, timeId,
      data: miolo.querySelector('#data').value || hoje(),
      hora: miolo.querySelector('#hora').value,
      local: miolo.querySelector('#local').value.trim(),
      foco: miolo.querySelector('#foco').value.trim(),
      presencas: timeId === t.timeId ? (t.presencas || []) : [],
    };
    const i = estado.treinos.findIndex((x) => x.id === t.id);
    if (i >= 0) estado.treinos[i] = novo; else estado.treinos.push(novo);
    await salvar(); fecharFolha(); recado(existente ? 'Treino atualizado.' : 'Treino marcado.'); atualizar();
    if (!existente) folhaDaChamada(novo);
  });

  miolo.querySelector('#apagar')?.addEventListener('click', async () => {
    if (!confirmar('Apagar este treino e a chamada dele?')) return;
    estado.treinos = estado.treinos.filter((x) => x.id !== t.id);
    await salvar(); fecharFolha(); recado('Treino apagado.'); atualizar();
  });
}

function folhaDaChamada(treino) {
  const elenco = atletasDoTime(estado.atletas, treino.timeId).filter((a) => a.status === 'ativo');
  const statusDe = (id) => (treino.presencas || []).find((p) => p.atletaId === id)?.status || '';

  if (!elenco.length) {
    abrirFolha('Chamada', '<div class="vazio">Nenhum atleta ativo neste time.</div>');
    return;
  }

  const passado = treino.data <= hoje();
  const miolo = abrirFolha(`Chamada — ${nomeDoTime(treino.timeId)}`, `
    <div id="contador" class="faixa info"></div>
    ${passado ? '' : `<p class="legenda">Treino ainda não aconteceu — marque quem
      <strong>confirmou</strong> que vem. A presença de verdade você marca no dia.</p>`}
    <div class="acoes" style="margin-top:0">
      <button class="btn p" id="todos-presentes">Todos vieram</button>
      <button class="btn p" id="limpar">Limpar</button>
    </div>
    <div class="lista" style="margin-top:.7rem">
      ${elenco.map((a) => `<div class="item">
        <div class="avatar">${esc(a.numero || iniciais(a.nome))}</div>
        <div class="corpo"><div class="nome" style="font-size:.92rem">${esc(a.nome)}</div>
          <div class="det">${esc(a.posicao || '—')}</div></div>
      </div>
      <div class="quadra-papeis" data-atleta="${esc(a.id)}" style="margin:-.3rem 0 .2rem;justify-content:flex-end">
        ${ESTADOS.map(([valor, rotulo]) => `<button type="button" data-estado="${valor}"
          aria-pressed="${statusDe(a.id) === valor}">${rotulo}</button>`).join('')}
      </div>`).join('')}
    </div>
    <div class="acoes"><button class="btn cheio largo" id="gravar">Gravar chamada</button></div>
    <div class="acoes">
      <button class="btn zap largo" id="link">Copiar link de confirmação para o grupo</button>
    </div>
    <div class="acoes"><button class="btn largo" id="recado-grupo">Copiar só o recado</button></div>
    <p class="dica" style="margin-top:.5rem">No link o atleta acha o próprio nome e toca em
      "Vou" ou "Não vou" — abre o WhatsApp com a resposta pronta para você. Depois é só
      marcar aqui.${estado.escola.telefone ? '' : ' <strong>Cadastre o WhatsApp da escolinha em Ajustes</strong> para os botões funcionarem.'}</p>`,
  { subtitulo: `${diaDaSemana(treino.data)}, ${dataBR(treino.data)}${treino.hora ? ` às ${treino.hora}` : ''}` });

  const marcas = new Map(elenco.map((a) => [a.id, statusDe(a.id)]));

  const pintarContador = () => {
    const valores = [...marcas.values()];
    const conta = (s) => valores.filter((v) => v === s).length;
    const semResposta = valores.filter((v) => !v).length;
    miolo.querySelector('#contador').innerHTML = passado
      ? `<strong>${conta('presente')}</strong> presentes · ${conta('falta')} faltas ·
         ${conta('justificado')} justificadas · ${semResposta} sem marcar`
      : `<strong>${conta('confirmado')}</strong> confirmaram de ${elenco.length} ·
         ${conta('justificado')} já avisaram que não vêm`;
  };
  pintarContador();

  miolo.querySelectorAll('.quadra-papeis').forEach((grupo) => {
    grupo.addEventListener('click', (ev) => {
      const botao = ev.target.closest('[data-estado]');
      if (!botao) return;
      const atual = marcas.get(grupo.dataset.atleta);
      // Tocar de novo no mesmo desmarca — engano de dedo é comum na beira da quadra.
      const novo = atual === botao.dataset.estado ? '' : botao.dataset.estado;
      marcas.set(grupo.dataset.atleta, novo);
      grupo.querySelectorAll('[data-estado]').forEach((b) =>
        b.setAttribute('aria-pressed', b.dataset.estado === novo));
      pintarContador();
    });
  });

  const aplicarTodos = (valor) => {
    elenco.forEach((a) => marcas.set(a.id, valor));
    miolo.querySelectorAll('.quadra-papeis').forEach((grupo) =>
      grupo.querySelectorAll('[data-estado]').forEach((b) =>
        b.setAttribute('aria-pressed', b.dataset.estado === valor)));
    pintarContador();
  };
  miolo.querySelector('#todos-presentes').addEventListener('click', () => aplicarTodos('presente'));
  miolo.querySelector('#limpar').addEventListener('click', () => aplicarTodos(''));

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const presencas = [...marcas.entries()]
      .filter(([, status]) => status)
      .map(([atletaId, status]) => ({ atletaId, status }));
    const i = estado.treinos.findIndex((x) => x.id === treino.id);
    estado.treinos[i] = { ...estado.treinos[i], presencas };
    await salvar(); fecharFolha(); recado('Chamada gravada.'); atualizar();
  });

  miolo.querySelector('#link').addEventListener('click', async () => {
    const carga = await empacotar(pacoteDoTreino(
      treino, estado.times.find((t) => t.id === treino.timeId), estado.escola, elenco));
    const endereco = enderecoDoLink(location.href.split('#')[0], carga);
    recado(await copiar(endereco)
      ? 'Link copiado — cole no grupo do time.'
      : 'Não consegui copiar o link.');
  });

  // Um texto só, para colar no grupo do time. É assim que escolinha se comunica
  // de verdade — mandar individual para trinta pessoas ninguém faz duas vezes.
  miolo.querySelector('#recado-grupo').addEventListener('click', async () => {
    const texto = mensagemDeTreino(treino, estado.times.find((t) => t.id === treino.timeId), estado.escola);
    recado(await copiar(texto) ? 'Recado copiado — cole no grupo do time.' : 'Não consegui copiar.');
  });
}

export function render(alvo, params = {}) {
  const futuros = estado.treinos.filter((t) => t.data >= hoje())
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const passados = estado.treinos.filter((t) => t.data < hoje())
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));

  const cartao = (t) => {
    const r = resumoDePresenca(t, estado.atletas);
    const futuro = t.data >= hoje();
    const ficha = futuro
      ? `<div class="ficha ${r.confirmados >= 6 ? 'ok' : 'alerta'}">${r.confirmados}/${r.elenco} confirmados</div>`
      : `<div class="ficha ${r.presentes >= 6 ? 'ok' : r.presentes ? 'alerta' : ''}">${r.presentes}/${r.elenco} vieram</div>`;

    return `<div class="item">
      <div class="corpo">
        <div class="nome" style="font-size:.93rem">${esc(nomeDoTime(t.timeId))}</div>
        <div class="det">${esc(diaDaSemana(t.data))}, ${dataCurta(t.data)}${t.hora ? ` às ${esc(t.hora)}` : ''}${
  t.local ? ` · ${esc(t.local)}` : ''}</div>
        <div class="det">${t.foco ? esc(t.foco) : 'sem foco definido'}${
  !futuro && r.faltas ? ` · <span style="color:var(--perigo)">${r.faltas} falta(s)</span>` : ''}</div>
      </div>
      <div class="direita">
        ${ficha}
        <div style="display:flex;gap:.3rem;margin-top:.4rem;justify-content:flex-end">
          <button class="btn p" data-editar="${esc(t.id)}">Editar</button>
          <button class="btn p cheio" data-chamada="${esc(t.id)}">${futuro ? 'Confirmar' : 'Chamada'}</button>
        </div>
      </div></div>`;
  };

  alvo.innerHTML = `
    <h2>Treinos</h2>
    <p class="legenda">Quem confirmou que vem, e quem de fato veio.</p>

    <div class="acoes" style="margin-bottom:.9rem">
      <button class="btn cheio" id="novo"${estado.times.length ? '' : ' disabled'}>+ Novo treino</button>
    </div>
    ${estado.times.length ? '' : '<div class="faixa">Crie um time antes de marcar treinos.</div>'}

    ${futuros.length ? `<h3>Próximos</h3><div class="lista">${futuros.map(cartao).join('')}</div>` : ''}
    ${passados.length ? `<h3>Já aconteceram</h3><div class="lista">${passados.slice(0, 12).map(cartao).join('')}</div>` : ''}
    ${!estado.treinos.length ? '<div class="vazio">Nenhum treino marcado ainda.</div>' : ''}`;

  alvo.querySelector('#novo').addEventListener('click', () => folhaDoTreino(null));
  alvo.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => folhaDoTreino(estado.treinos.find((t) => t.id === b.dataset.editar))));
  alvo.querySelectorAll('[data-chamada]').forEach((b) =>
    b.addEventListener('click', () => folhaDaChamada(estado.treinos.find((t) => t.id === b.dataset.chamada))));

  if (params.id) {
    const treino = estado.treinos.find((t) => t.id === params.id);
    delete params.id;
    if (treino) folhaDaChamada(treino);
  }
}
