/**
 * A página que o ATLETA abre. Só leitura, sem login, sem app instalado.
 *
 * Os dados vêm do fragmento da URL — nunca de um servidor, porque não existe
 * servidor. Isso tem uma consequência boa e uma ruim, e as duas estão na tela:
 * nada é guardado nem trafega (bom), e o que ela mostra é o retrato de quando o
 * link foi gerado (ruim, e por isso a data da geração aparece).
 */
import { desempacotar } from './partilha.js';
import { esc, recado, copiar } from './ui.js';
import { dataBR, diaDaSemana, telefoneInternacional } from './formato.js';

const $ = (s) => document.querySelector(s);

// ─── Tema ────────────────────────────────────────────────────────────────────
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('#tema').textContent = tema === 'escuro' ? '☀︎' : '☽︎';
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'escuro' ? '#1a1d23' : '#ffffff');
  try { localStorage.setItem('quadra:tema', tema); } catch { /* aba privada */ }
}

function temaInicial() {
  try {
    const guardado = localStorage.getItem('quadra:tema');
    if (guardado) return guardado;
  } catch { /* aba privada */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

const GRUPOS = [
  ['titular', 'Em quadra'],
  ['líbero', 'Líbero'],
  ['goleiro', 'Goleiro'],
  ['reserva', 'Banco'],
];

const linhaDoAtleta = (nome, numero, detalhe) => `
  <div class="item">
    <div class="avatar">${esc(numero || nome[0] || '?')}</div>
    <div class="corpo">
      <div class="nome" style="font-size:.93rem">${esc(nome)}</div>
      ${detalhe ? `<div class="det">${esc(detalhe)}</div>` : ''}
    </div>
  </div>`;

function desenharJogo(d) {
  $('#titulo').childNodes[0].nodeValue = d.e;
  $('#subtitulo').textContent = 'escalação do jogo';

  const grupos = GRUPOS
    .map(([papel, rotulo]) => [rotulo, d.p.filter((linha) => linha[2] === papel)])
    .filter(([, lista]) => lista.length);

  $('#tela').innerHTML = `
    <h2>${esc(d.m)} × ${esc(d.a || 'a definir')}</h2>
    <p class="legenda">${esc(d.k || 'Jogo')} · ${d.n ? 'em casa' : 'fora'}</p>

    <div class="cartao" style="margin-bottom:1rem">
      <div style="display:grid;gap:.45rem;font-size:.9rem">
        <div><strong>${esc(diaDaSemana(d.d))}, ${dataBR(d.d)}</strong>${d.h ? ` · jogo às ${esc(d.h)}` : ''}</div>
        ${d.c ? `<div style="color:var(--perigo);font-weight:650">Chegar às ${esc(d.c)}</div>` : ''}
        ${d.l ? `<div style="color:var(--tinta2)">${esc(d.l)}</div>` : ''}
      </div>
    </div>

    ${grupos.map(([rotulo, lista]) => `
      <h3>${esc(rotulo)}</h3>
      <div class="lista">
        ${lista.map(([nome, numero, , posicao]) => linhaDoAtleta(nome, numero, posicao)).join('')}
      </div>`).join('')}

    ${d.p.length ? '' : '<div class="vazio">A escalação ainda não foi definida.</div>'}

    ${d.z ? `<div class="acoes" style="margin-top:1.4rem">
      <a class="btn zap largo" id="falar" href="#">Falar com a ${esc(d.e)}</a>
    </div>` : ''}`;

  if (d.z) ligarWhatsApp(d, `Oi! Sobre o jogo contra ${d.a || 'o adversário'} em ${dataBR(d.d)}:`);
}

function desenharTreino(d) {
  $('#titulo').childNodes[0].nodeValue = d.e;
  $('#subtitulo').textContent = 'confirmar presença';

  $('#tela').innerHTML = `
    <h2>Treino — ${esc(d.m)}</h2>
    <p class="legenda">${esc(diaDaSemana(d.d))}, ${dataBR(d.d)}${d.h ? ` às ${esc(d.h)}` : ''}</p>

    <div class="cartao" style="margin-bottom:1rem">
      <div style="display:grid;gap:.45rem;font-size:.9rem">
        ${d.l ? `<div>${esc(d.l)}</div>` : ''}
        ${d.f ? `<div style="color:var(--tinta2)">Foco: ${esc(d.f)}</div>` : ''}
      </div>
    </div>

    <div class="faixa info">Ache seu nome e toque em <strong>Vou</strong> ou
      <strong>Não vou</strong>. ${d.z
    ? 'Abre o WhatsApp com a mensagem pronta — é só enviar.'
    : 'A resposta é copiada para você colar no grupo do time.'}</div>

    <div class="lista">
      ${d.p.map(([nome, numero], i) => `
        <div class="item">
          <div class="avatar">${esc(numero || nome[0] || '?')}</div>
          <div class="corpo"><div class="nome" style="font-size:.93rem">${esc(nome)}</div></div>
          <div class="direita" style="display:flex;gap:.3rem">
            <button class="btn p zap" data-vou="${i}">Vou</button>
            <button class="btn p" data-falto="${i}">Não vou</button>
          </div>
        </div>`).join('')}
    </div>

    ${d.p.length ? '' : '<div class="vazio">Nenhum atleta na lista.</div>'}`;

  // Sem telefone da escolinha cadastrado a resposta é COPIADA, nunca mandada
  // para um número adivinhado: abrir conversa com um desconhecido é pior do que
  // pedir para colar no grupo.
  const numero = telefoneInternacional(d.z);

  const responder = async (indice, vai) => {
    const [nome] = d.p[indice];
    const texto = vai
      ? `Oi! Aqui é ${nome} — confirmo presença no treino de ${diaDaSemana(d.d)}, ${dataBR(d.d)}${d.h ? ` às ${d.h}` : ''}. 👍`
      : `Oi! Aqui é ${nome} — não vou conseguir ir ao treino de ${diaDaSemana(d.d)}, ${dataBR(d.d)}. Desculpa!`;

    if (numero) {
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
      return;
    }
    recado(await copiar(texto) ? 'Resposta copiada — cole no grupo.' : texto);
  };

  $('#tela').addEventListener('click', (ev) => {
    const vou = ev.target.closest('[data-vou]');
    const falto = ev.target.closest('[data-falto]');
    if (vou) responder(Number(vou.dataset.vou), true);
    else if (falto) responder(Number(falto.dataset.falto), false);
  });
}

function ligarWhatsApp(d, texto) {
  const link = $('#falar');
  if (!link) return;
  link.href = `https://wa.me/${telefoneInternacional(d.z)}?text=${encodeURIComponent(texto)}`;
  link.target = '_blank';
}

function semDados(mensagem) {
  $('#titulo').childNodes[0].nodeValue = 'Quadra';
  $('#tela').innerHTML = `<div class="vazio" style="margin-top:2rem">${esc(mensagem)}</div>`;
}

async function desenhar() {
  const carga = location.hash.slice(1);
  if (!carga) {
    semDados('Este endereço precisa do link completo, com tudo que vem depois do #. '
      + 'Alguns aplicativos cortam links longos — peça para reenviar.');
    return;
  }

  try {
    const dados = await desempacotar(carga);
    if (dados.t === 'jogo') desenharJogo(dados);
    else if (dados.t === 'treino') desenharTreino(dados);
    else semDados('Não reconheci o conteúdo deste link.');
  } catch (erro) {
    // Aviso, não erro: link cortado no caminho é condição de uso, não defeito.
    console.warn('[ver] link ilegível', erro);
    semDados('Não consegui ler este link. Ele pode ter sido cortado no caminho — peça o link de novo.');
  }
}

async function iniciar() {
  aplicarTema(temaInicial());
  $('#tema').addEventListener('click', () =>
    aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'));

  // Abrir o link do treino tendo o da escalação já aberto muda só o fragmento, e
  // o navegador NÃO recarrega o documento nesse caso — a página continuaria
  // mostrando o jogo. Acontece de verdade: o navegador interno do WhatsApp
  // reaproveita a mesma aba para o link seguinte.
  window.addEventListener('hashchange', () => {
    $('#tela').innerHTML = '';
    desenhar();
  });

  await desenhar();
}

iniciar();
