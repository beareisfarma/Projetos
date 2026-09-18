/**
 * O painel é a primeira tela e responde, sem rolagem, às três perguntas que o
 * dono de escolinha faz todo dia: quanto entrou, quanto falta entrar e quem
 * está devendo. Cada número é BOTÃO — número que não leva a lugar nenhum vira
 * enfeite, e o dono olha uma vez e para de olhar.
 */
import { estado } from '../estado.js';
import { esc, iniciais } from '../ui.js';
import { ir } from '../rota.js';
import {
  previsaoDoMes, resumoDoMes, saldoAcumulado, filaDeCobranca,
  proximoCompromisso, conferirEscalacao, atletasDoTime,
} from '../modelo.js';
import {
  reais, competenciaAtual, competenciaPorExtenso, hoje, dataBR,
  diaDaSemana, diasEntre,
} from '../formato.js';

const nomeDoTime = (id) => estado.times.find((t) => t.id === id)?.nome || 'time';

function cartaoDoCompromisso(proximo) {
  if (!proximo) {
    return `<div class="vazio">Nenhum jogo ou treino marcado.
      <br><button class="btn p" data-ir="jogos" style="margin-top:.6rem">Marcar um jogo</button></div>`;
  }
  const { tipo, item } = proximo;
  const dias = diasEntre(hoje(), item.data);
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;

  if (tipo === 'jogo') {
    const { titulares, avisos } = conferirEscalacao(item.escalados);
    return `<button class="item clicavel" data-ir="jogos" data-id="${esc(item.id)}">
      <div class="avatar">🏐</div>
      <div class="corpo">
        <div class="nome">${esc(nomeDoTime(item.timeId))} × ${esc(item.adversario || 'a definir')}</div>
        <div class="det">${esc(diaDaSemana(item.data))}, ${dataBR(item.data)}${item.hora ? ` às ${esc(item.hora)}` : ''} · ${esc(item.local || 'local a definir')}</div>
      </div>
      <div class="direita">
        <div class="ficha ${avisos.length ? 'alerta' : 'ok'}">${titulares}/6 escalados</div>
        <div class="det" style="margin-top:.2rem">${quando}</div>
      </div></button>`;
  }

  const confirmados = (item.presencas || []).filter((p) => p.status === 'confirmado').length;
  const elenco = atletasDoTime(estado.atletas, item.timeId).length;
  return `<button class="item clicavel" data-ir="treinos" data-id="${esc(item.id)}">
    <div class="avatar">🎽</div>
    <div class="corpo">
      <div class="nome">Treino — ${esc(nomeDoTime(item.timeId))}</div>
      <div class="det">${esc(diaDaSemana(item.data))}, ${dataBR(item.data)}${item.hora ? ` às ${esc(item.hora)}` : ''}${item.foco ? ` · ${esc(item.foco)}` : ''}</div>
    </div>
    <div class="direita">
      <div class="ficha ${confirmados >= 6 ? 'ok' : 'alerta'}">${confirmados}/${elenco} confirmados</div>
      <div class="det" style="margin-top:.2rem">${quando}</div>
    </div></button>`;
}

export function render(alvo) {
  const mes = competenciaAtual();
  const previsao = previsaoDoMes(estado.mensalidades, mes);
  const caixa = resumoDoMes(estado.lancamentos, mes);
  const acumulado = saldoAcumulado(estado.lancamentos, mes);
  const fila = filaDeCobranca(estado.atletas, estado.mensalidades);
  const atrasados = fila.filter((l) => l.situacao.atrasadas > 0);
  const ativos = estado.atletas.filter((a) => a.status === 'ativo').length;
  const proximo = proximoCompromisso(estado.jogos, estado.treinos);

  const semNada = !estado.atletas.length && !estado.times.length;

  alvo.innerHTML = `
    <h2>${esc(estado.escola.nome || 'Sua escolinha')}</h2>
    <p class="legenda">${competenciaPorExtenso(mes)} · atualizado em ${dataBR(hoje())}</p>

    ${semNada ? `<div class="faixa info">
      <strong>Comece por aqui.</strong> Crie um time, cadastre os atletas e o resto do app
      se enche sozinho. Se quiser ver tudo funcionando primeiro, use
      <button class="btn p" data-ir="ajustes" style="margin-left:.2rem">carregar o exemplo</button>.
    </div>` : ''}

    <div class="painel">
      <button class="bloco" data-ir="dinheiro" data-aba="caixa">
        <span class="rot">Saldo do mês</span>
        <span class="val ${caixa.saldo >= 0 ? 'ok' : 'perigo'}">${reais(caixa.saldo)}</span>
        <span class="pe">${reais(caixa.entradas)} entrou · ${reais(caixa.saidas)} saiu</span>
      </button>

      <button class="bloco" data-ir="dinheiro" data-aba="mensalidades">
        <span class="rot">A receber</span>
        <span class="val">${reais(previsao.aReceber)}</span>
        <span class="pe">${previsao.pendentes} de ${previsao.quantidade} mensalidades</span>
      </button>

      <button class="bloco ${previsao.emAtraso > 0 ? 'destaque' : ''}" data-ir="dinheiro" data-aba="cobrar">
        <span class="rot">Em atraso</span>
        <span class="val ${previsao.emAtraso > 0 ? '' : 'ok'}">${reais(atrasados.reduce((s, l) => s + l.situacao.emAtraso, 0))}</span>
        <span class="pe">${atrasados.length === 0 ? 'ninguém devendo 🎉'
          : `${atrasados.length} atleta${atrasados.length > 1 ? 's' : ''} · toque para cobrar`}</span>
      </button>

      <button class="bloco" data-ir="atletas">
        <span class="rot">Atletas</span>
        <span class="val">${ativos}</span>
        <span class="pe">em ${estado.times.filter((t) => t.ativo !== false).length} time${estado.times.length === 1 ? '' : 's'}</span>
      </button>
    </div>

    ${previsao.quantidade ? `
      <div class="cartao">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem">
          <strong style="font-size:.88rem">Recebimento de ${competenciaPorExtenso(mes)}</strong>
          <span class="ficha ${previsao.taxa >= 0.9 ? 'ok' : previsao.taxa >= 0.6 ? 'alerta' : 'perigo'}">
            ${Math.round(previsao.taxa * 100)}%
          </span>
        </div>
        <div class="barra"><i style="width:${Math.round(previsao.taxa * 100)}%"></i></div>
        <div class="det" style="font-size:.78rem;color:var(--tinta2);margin-top:.4rem">
          ${reais(previsao.recebido)} recebidos de ${reais(previsao.emitido)} emitidos
        </div>
      </div>` : ''}

    <h3>Próximo compromisso</h3>
    ${cartaoDoCompromisso(proximo)}

    ${atrasados.length ? `
      <h3>Cobrança pendente</h3>
      <div class="lista">
        ${atrasados.slice(0, 4).map(({ atleta, situacao }) => `
          <button class="item clicavel" data-ir="dinheiro" data-aba="cobrar">
            <div class="avatar">${esc(iniciais(atleta.nome))}</div>
            <div class="corpo">
              <div class="nome"><span class="bola atraso"></span>${esc(atleta.nome)}</div>
              <div class="det">${situacao.atrasadas} mensalidade${situacao.atrasadas > 1 ? 's' : ''} ·
                ${situacao.diasDoMaisAntigo} dia${situacao.diasDoMaisAntigo > 1 ? 's' : ''} de atraso</div>
            </div>
            <div class="direita"><div class="valor" style="color:var(--perigo)">${reais(situacao.emAtraso)}</div></div>
          </button>`).join('')}
      </div>
      ${atrasados.length > 4 ? `<div class="acoes">
        <button class="btn largo" data-ir="dinheiro" data-aba="cobrar">Ver os ${atrasados.length} em atraso</button>
      </div>` : ''}` : ''}

    ${estado.lancamentos.length ? `
      <h3>No acumulado</h3>
      <div class="cartao">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.85rem;color:var(--tinta2)">Saldo de tudo até hoje</span>
          <strong class="val ${acumulado >= 0 ? 'ok' : 'perigo'}"
            style="font-family:var(--nums);font-size:1.15rem">${reais(acumulado)}</strong>
        </div>
      </div>` : ''}
  `;

  alvo.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.addEventListener('click', () => ir(botao.dataset.ir, { ...botao.dataset }));
  });
}
