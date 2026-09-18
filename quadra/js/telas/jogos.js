/**
 * Jogos e escalação.
 *
 * A escalação é um toque por atleta, com quatro estados (titular, líbero,
 * reserva, fora). Nada de arrastar: o dono monta isso com uma mão só, no
 * ginásio, muitas vezes de pé.
 *
 * O app AVISA quando não há seis em quadra, mas não impede de salvar — amistoso
 * com time incompleto existe, e não é o software que decide se o jogo acontece.
 */
import { estado, salvar } from '../estado.js';
import { esc, iniciais, abrirFolha, fecharFolha, recado, opcoes, confirmar, copiar } from '../ui.js';
import { atualizar } from '../rota.js';
import { novoId, atletasDoTime, conferirEscalacao, destinatarioDaCobranca, modalidadeDe } from '../modelo.js';
import { mensagemDeConvocacao, linkWhatsApp } from '../cobranca.js';
import { empacotar, pacoteDaEscalacao, enderecoDoLink } from '../partilha.js';
import { hoje, dataBR, dataCurta, diaDaSemana } from '../formato.js';

const timePor = (id) => estado.times.find((t) => t.id === id);
const nomeDoTime = (id) => timePor(id)?.nome || 'time';

function folhaDoJogo(existente) {
  const j = existente || {
    id: novoId('jg_'), escolaId: 'escola', timeId: estado.times[0]?.id || '',
    data: hoje(), hora: '', chegada: '', adversario: '', local: '', mandante: true,
    competicao: '', escalados: [], placarNos: null, placarEles: null,
    status: 'agendado', observacoes: '',
  };

  const { placar } = modalidadeDe(timePor(j.timeId));

  const miolo = abrirFolha(existente ? `${nomeDoTime(j.timeId)} × ${j.adversario || 'a definir'}` : 'Novo jogo', `
    <div class="dupla">
      <label class="campo"><span>Time</span>
        <select id="timeId">${opcoes(estado.times.map((t) => [t.id, t.nome]), j.timeId)}</select></label>
      <label class="campo"><span>Adversário</span><input id="adversario" value="${esc(j.adversario)}"></label>
    </div>
    <div class="dupla">
      <label class="campo"><span>Data</span><input id="data" type="date" value="${esc(j.data)}"></label>
      <label class="campo"><span>Hora do jogo</span><input id="hora" type="time" value="${esc(j.hora)}"></label>
    </div>
    <div class="dupla">
      <label class="campo"><span>Chegar às</span><input id="chegada" type="time" value="${esc(j.chegada)}"></label>
      <label class="campo"><span>Competição</span><input id="competicao" value="${esc(j.competicao)}" placeholder="Amistoso"></label>
    </div>
    <label class="campo"><span>Local</span><input id="local" value="${esc(j.local)}"></label>
    <div class="dupla">
      <label class="campo"><span>Mando</span>
        <select id="mandante">${opcoes([['sim', 'Em casa'], ['nao', 'Fora']], j.mandante ? 'sim' : 'nao')}</select></label>
      <label class="campo"><span>Situação</span>
        <select id="status">${opcoes([['agendado', 'Agendado'], ['encerrado', 'Encerrado'], ['cancelado', 'Cancelado']], j.status)}</select></label>
    </div>
    <div class="dupla" id="placar" ${j.status === 'encerrado' ? '' : 'hidden'}>
      <label class="campo"><span>${esc(placar.rotulo)} nossos</span>
        <input id="placarNos" type="number" min="0" max="${placar.maximo}" value="${j.placarNos ?? ''}"></label>
      <label class="campo"><span>${esc(placar.rotulo)} deles</span>
        <input id="placarEles" type="number" min="0" max="${placar.maximo}" value="${j.placarEles ?? ''}"></label>
    </div>
    <label class="campo"><span>Observações</span><textarea id="observacoes">${esc(j.observacoes)}</textarea></label>
    <div class="acoes"><button class="btn cheio largo" id="gravar">Gravar</button></div>
    ${existente ? '<div class="acoes"><button class="btn perigo" id="apagar">Apagar jogo</button></div>' : ''}`);

  const selStatus = miolo.querySelector('#status');
  selStatus.addEventListener('change', () => {
    miolo.querySelector('#placar').hidden = selStatus.value !== 'encerrado';
  });

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const timeId = miolo.querySelector('#timeId').value;
    if (!timeId) { recado('Crie um time antes de marcar o jogo.'); return; }

    const novo = {
      ...j, timeId,
      adversario: miolo.querySelector('#adversario').value.trim(),
      data: miolo.querySelector('#data').value || hoje(),
      hora: miolo.querySelector('#hora').value,
      chegada: miolo.querySelector('#chegada').value,
      competicao: miolo.querySelector('#competicao').value.trim(),
      local: miolo.querySelector('#local').value.trim(),
      mandante: miolo.querySelector('#mandante').value === 'sim',
      status: selStatus.value,
      placarNos: miolo.querySelector('#placarNos').value === '' ? null : Number(miolo.querySelector('#placarNos').value),
      placarEles: miolo.querySelector('#placarEles').value === '' ? null : Number(miolo.querySelector('#placarEles').value),
      observacoes: miolo.querySelector('#observacoes').value.trim(),
      // Trocar o time zera a escalação: o elenco é outro.
      escalados: timeId === j.timeId ? (j.escalados || []) : [],
    };
    const i = estado.jogos.findIndex((x) => x.id === j.id);
    if (i >= 0) estado.jogos[i] = novo; else estado.jogos.push(novo);
    await salvar(); fecharFolha(); recado(existente ? 'Jogo atualizado.' : 'Jogo marcado.'); atualizar();
    if (!existente) folhaDaEscalacao(novo);
  });

  miolo.querySelector('#apagar')?.addEventListener('click', async () => {
    if (!confirmar('Apagar este jogo e a escalação dele?')) return;
    estado.jogos = estado.jogos.filter((x) => x.id !== j.id);
    await salvar(); fecharFolha(); recado('Jogo apagado.'); atualizar();
  });
}

function folhaDaEscalacao(jogo) {
  const time = timePor(jogo.timeId);
  const { papeis, nome: nomeModalidade } = modalidadeDe(time);
  const elenco = atletasDoTime(estado.atletas, jogo.timeId).filter((a) => a.status === 'ativo');
  const papelDe = (id) => (jogo.escalados || []).find((e) => e.atletaId === id)?.papel || 'fora';

  if (!elenco.length) {
    abrirFolha('Escalação', '<div class="vazio">Nenhum atleta ativo neste time.</div>');
    return;
  }

  const miolo = abrirFolha(`Escalação — ${nomeDoTime(jogo.timeId)}`, `
    <div id="aviso"></div>
    <div class="lista">
      ${elenco.map((a) => `<div class="item">
        <div class="avatar">${esc(a.numero || iniciais(a.nome))}</div>
        <div class="corpo">
          <div class="nome" style="font-size:.92rem">${esc(a.nome)}</div>
          <div class="det">${esc(a.posicao || 'sem posição')}</div>
        </div>
      </div>
      <div class="quadra-papeis" data-atleta="${esc(a.id)}" style="margin:-.3rem 0 .2rem;justify-content:flex-end">
        ${papeis.map(([valor, rotulo]) => `<button type="button" data-papel="${valor}"
          aria-pressed="${papelDe(a.id) === valor}">${rotulo}</button>`).join('')}
      </div>`).join('')}
    </div>
    <div class="acoes">
      <button class="btn cheio largo" id="gravar">Gravar escalação</button>
    </div>
    <div class="acoes">
      <button class="btn zap largo" id="convocar">Convocar os escalados no WhatsApp</button>
    </div>
    <div class="acoes">
      <button class="btn largo" id="link">Copiar link da escalação para o grupo</button>
    </div>
    <p class="dica" style="margin-top:.5rem">O link abre uma página só de leitura com a
      escalação, o local e a hora de chegada. Os dados viajam dentro do próprio link —
      não ficam guardados em servidor nenhum.</p>`,
  { subtitulo: `${nomeModalidade} · ${diaDaSemana(jogo.data)}, ${dataBR(jogo.data)} × ${jogo.adversario || 'a definir'}` });

  const escolhas = new Map(elenco.map((a) => [a.id, papelDe(a.id)]));

  const pintarAviso = () => {
    const escalados = [...escolhas.entries()]
      .filter(([, papel]) => papel !== 'fora')
      .map(([atletaId, papel]) => ({ atletaId, papel }));
    const { titulares, emQuadra, avisos } = conferirEscalacao(escalados, time);
    miolo.querySelector('#aviso').innerHTML = avisos.length
      ? `<div class="faixa">${esc(avisos.join(' '))}</div>`
      : `<div class="faixa" style="background:var(--ok-fraco);color:var(--ok)">
           ${titulares} em quadra e o ${esc(modalidadeDe(time).especial.rotulo.toLowerCase())} · escalação fechada.</div>`;
    return escalados;
  };
  pintarAviso();

  miolo.querySelectorAll('.quadra-papeis').forEach((grupo) => {
    grupo.addEventListener('click', (ev) => {
      const botao = ev.target.closest('[data-papel]');
      if (!botao) return;
      escolhas.set(grupo.dataset.atleta, botao.dataset.papel);
      grupo.querySelectorAll('[data-papel]').forEach((b) =>
        b.setAttribute('aria-pressed', b === botao));
      pintarAviso();
    });
  });

  const escaladosAgora = () => [...escolhas.entries()]
    .filter(([, papel]) => papel !== 'fora')
    .map(([atletaId, papel]) => ({ atletaId, papel }));

  miolo.querySelector('#gravar').addEventListener('click', async () => {
    const i = estado.jogos.findIndex((x) => x.id === jogo.id);
    estado.jogos[i] = { ...estado.jogos[i], escalados: escaladosAgora() };
    await salvar(); fecharFolha();
    recado(`${escaladosAgora().length} atleta(s) relacionados.`);
    atualizar();
  });

  miolo.querySelector('#link').addEventListener('click', async () => {
    const i = estado.jogos.findIndex((x) => x.id === jogo.id);
    estado.jogos[i] = { ...estado.jogos[i], escalados: escaladosAgora() };
    await salvar();

    const carga = await empacotar(
      pacoteDaEscalacao(estado.jogos[i], time, estado.escola, estado.atletas));
    const endereco = enderecoDoLink(location.href.split('#')[0], carga);
    recado(await copiar(endereco)
      ? 'Link copiado — cole no grupo do time.'
      : 'Não consegui copiar o link.');
  });

  miolo.querySelector('#convocar').addEventListener('click', async () => {
    const i = estado.jogos.findIndex((x) => x.id === jogo.id);
    estado.jogos[i] = { ...estado.jogos[i], escalados: escaladosAgora() };
    await salvar();
    fecharFolha();
    folhaDeConvocacao(estado.jogos[i]);
  });
}

/**
 * Convocação: uma lista com um botão por atleta.
 * Não existe "mandar para todos de uma vez" de propósito — quem dispara em
 * massa pelo WhatsApp comum toma bloqueio. Aqui cada envio é um toque, e o app
 * marca visualmente quem já recebeu para o dono não se perder.
 */
function folhaDeConvocacao(jogo) {
  const time = estado.times.find((t) => t.id === jogo.timeId);
  const escalados = (jogo.escalados || [])
    .map((e) => ({ ...e, atleta: estado.atletas.find((a) => a.id === e.atletaId) }))
    .filter((e) => e.atleta);

  const miolo = abrirFolha('Convocar', `
    <p class="legenda">Um toque por atleta. De menor de idade a mensagem vai para o responsável.</p>
    <div class="lista">
      ${escalados.map(({ atleta, papel }) => {
    const destino = destinatarioDaCobranca(atleta);
    return `<div class="item">
        <div class="avatar">${esc(atleta.numero || iniciais(atleta.nome))}</div>
        <div class="corpo">
          <div class="nome" style="font-size:.92rem">${esc(atleta.nome)}</div>
          <div class="det">${esc(papel)}${destino?.paraResponsavel ? ` · via ${esc(destino.nome)}` : ''}</div>
        </div>
        <div class="direita">
          <button class="btn p zap" data-zap="${esc(atleta.id)}"${destino ? '' : ' disabled'}>
            ${destino ? 'Enviar' : 'sem telefone'}</button>
        </div></div>`;
  }).join('')}
    </div>`, { subtitulo: `${escalados.length} relacionado(s)` });

  miolo.querySelectorAll('[data-zap]').forEach((b) => b.addEventListener('click', () => {
    const atleta = estado.atletas.find((a) => a.id === b.dataset.zap);
    const msg = mensagemDeConvocacao(atleta, jogo, time, estado.escola);
    const link = msg.destino && linkWhatsApp(msg.destino.telefone, msg.texto);
    if (!link) { recado('Sem telefone.'); return; }
    window.open(link, '_blank');
    b.textContent = 'Enviado ✓';
    b.classList.remove('zap');
  }));
}

export function render(alvo, params = {}) {
  const futuros = estado.jogos.filter((j) => j.data >= hoje() && j.status !== 'cancelado')
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const passados = estado.jogos.filter((j) => j.data < hoje() || j.status === 'cancelado')
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));

  const cartao = (j) => {
    const time = timePor(j.timeId);
    const { titulares, emQuadra, reservas, avisos } = conferirEscalacao(j.escalados, time);
    const resultado = j.status === 'encerrado' && j.placarNos !== null
      ? `<div class="ficha ${j.placarNos > j.placarEles ? 'ok' : 'perigo'}">${j.placarNos} × ${j.placarEles}</div>`
      : `<div class="ficha ${avisos.length ? 'alerta' : 'ok'}">${titulares}/${emQuadra}${reservas ? ` +${reservas}` : ''}</div>`;

    return `<div class="item">
      <div class="corpo">
        <div class="nome" style="font-size:.93rem">${esc(nomeDoTime(j.timeId))} × ${esc(j.adversario || 'a definir')}</div>
        <div class="det">${esc(modalidadeDe(time).nome)} · ${esc(diaDaSemana(j.data))}, ${dataCurta(j.data)}${j.hora ? ` às ${esc(j.hora)}` : ''}
          · ${j.mandante ? 'em casa' : 'fora'}${j.competicao ? ` · ${esc(j.competicao)}` : ''}</div>
        <div class="det">${esc(j.local || 'local a definir')}</div>
      </div>
      <div class="direita">
        ${resultado}
        <div style="display:flex;gap:.3rem;margin-top:.4rem;justify-content:flex-end">
          <button class="btn p" data-editar="${esc(j.id)}">Editar</button>
          <button class="btn p cheio" data-escalar="${esc(j.id)}">Escalar</button>
        </div>
      </div></div>`;
  };

  alvo.innerHTML = `
    <h2>Jogos</h2>
    <p class="legenda">Quem está escalado, onde e a que horas — e a convocação sai pronta.</p>

    <div class="acoes" style="margin-bottom:.9rem">
      <button class="btn cheio" id="novo"${estado.times.length ? '' : ' disabled'}>+ Novo jogo</button>
    </div>
    ${estado.times.length ? '' : '<div class="faixa">Crie um time antes de marcar jogos.</div>'}

    ${futuros.length ? `<h3>Próximos</h3><div class="lista">${futuros.map(cartao).join('')}</div>` : ''}
    ${passados.length ? `<h3>Já aconteceram</h3><div class="lista">${passados.slice(0, 12).map(cartao).join('')}</div>` : ''}
    ${!estado.jogos.length ? '<div class="vazio">Nenhum jogo marcado ainda.</div>' : ''}`;

  alvo.querySelector('#novo').addEventListener('click', () => folhaDoJogo(null));
  alvo.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => folhaDoJogo(estado.jogos.find((j) => j.id === b.dataset.editar))));
  alvo.querySelectorAll('[data-escalar]').forEach((b) =>
    b.addEventListener('click', () => folhaDaEscalacao(estado.jogos.find((j) => j.id === b.dataset.escalar))));

  // Chegando do painel com um jogo específico, abre direto a escalação dele.
  if (params.id) {
    const jogo = estado.jogos.find((j) => j.id === params.id);
    delete params.id;
    if (jogo) folhaDaEscalacao(jogo);
  }
}
