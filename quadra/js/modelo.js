/**
 * As regras do negócio, separadas da tela para poderem ser testadas.
 *
 * Duas decisões estruturais moram aqui:
 *
 * 1. MENSALIDADE PAGA VIRA ENTRADA NO CAIXA, SOZINHA. Sem isso o dono lança o
 *    dinheiro duas vezes (uma na mensalidade, outra no caixa) ou esquece de
 *    lançar e o caixa mente. O id do lançamento é DERIVADO do id da
 *    mensalidade, então gravar de novo sobrescreve em vez de duplicar — é o que
 *    torna a operação segura de repetir.
 *
 * 2. TUDO É ESCOPADO POR ESCOLA. Hoje só existe uma, mas a coluna já está aqui:
 *    acrescentar escola depois, num banco com dados, é migração dolorosa;
 *    acrescentar agora é um campo. Se um dia isso virar produto para várias
 *    escolinhas, o caminho já está aberto.
 */

import { hoje, competenciaDe, vencimentoEm, diasEntre, idade } from './formato.js';

/**
 * As modalidades. A RG Sports treina vôlei E handebol, e as duas têm regra
 * diferente de quem entra em quadra — 6 + líbero contra 6 de linha + goleiro.
 * Cravar a regra do vôlei no código faria o app mentir para metade dos times.
 *
 * `emQuadra` conta só os jogadores de linha; o especial (líbero/goleiro) é
 * contado à parte porque não é intercambiável com os outros.
 */
export const MODALIDADES = {
  volei: {
    nome: 'Vôlei',
    emQuadra: 6,
    posicoes: ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero'],
    especial: { chave: 'líbero', rotulo: 'Líbero', maximo: 1 },
    papeis: [['titular', 'Titular'], ['líbero', 'Líbero'], ['reserva', 'Reserva'], ['fora', 'Fora']],
    placar: { rotulo: 'Sets', maximo: 5 },
  },
  handebol: {
    nome: 'Handebol',
    emQuadra: 6,
    posicoes: ['Goleiro', 'Ponta esquerda', 'Ponta direita',
      'Armador esquerdo', 'Armador central', 'Armador direito', 'Pivô'],
    especial: { chave: 'goleiro', rotulo: 'Goleiro', maximo: 1 },
    papeis: [['titular', 'Linha'], ['goleiro', 'Goleiro'], ['reserva', 'Reserva'], ['fora', 'Fora']],
    placar: { rotulo: 'Gols', maximo: 60 },
  },
};

/** Time sem modalidade é vôlei — foi o que existia antes de o campo nascer. */
export const modalidadeDe = (time) => MODALIDADES[time?.modalidade] || MODALIDADES.volei;

export const posicoesDe = (time) => modalidadeDe(time).posicoes;

/** Compatibilidade: as posições de vôlei, para quem ainda importa a lista antiga. */
export const POSICOES = MODALIDADES.volei.posicoes;

export const PRESENCAS = {
  confirmado: 'Confirmou',
  presente: 'Presente',
  falta: 'Faltou',
  justificado: 'Falta justificada',
};

export const CATEGORIAS_ENTRADA = ['Mensalidade', 'Matrícula', 'Uniforme', 'Torneio',
  'Patrocínio', 'Aluguel de quadra', 'Outros'];

export const CATEGORIAS_SAIDA = ['Aluguel de quadra', 'Material esportivo', 'Uniforme',
  'Salário / comissão', 'Transporte', 'Arbitragem', 'Inscrição em competição',
  'Marketing', 'Impostos e taxas', 'Outros'];

export function novoId(prefixo = '') {
  return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Mensalidades ────────────────────────────────────────────────────────────

/** O valor do atleta vence o do time: é lá que mora o desconto de irmão, bolsa, etc. */
export function valorDaMensalidade(atleta, times) {
  if (atleta?.isento) return 0;
  if (Number.isFinite(atleta?.mensalidade) && atleta.mensalidade >= 0) return atleta.mensalidade;
  const time = times.find((t) => t.id === atleta?.timeIds?.[0]);
  return Number(time?.mensalidade) || 0;
}

export const cobravel = (atleta) => atleta?.status === 'ativo' && !atleta?.isento;

/**
 * Gera as mensalidades de uma competência.
 *
 * É IDEMPOTENTE de propósito: rodar duas vezes no mesmo mês não cria cobrança
 * repetida, porque atleta que já tem lançamento naquela competência é pulado.
 * O dono vai clicar duas vezes — é só uma questão de quando.
 */
export function gerarMensalidades({ atletas, times, competencia, existentes = [], escolaId = 'escola' }) {
  const jaTem = new Set(existentes.map((m) => `${m.atletaId}|${m.competencia}`));
  const novas = [];

  for (const atleta of atletas) {
    if (!cobravel(atleta)) continue;
    if (jaTem.has(`${atleta.id}|${competencia}`)) continue;

    const valor = valorDaMensalidade(atleta, times);
    if (valor <= 0) continue;   // sem valor definido não se inventa cobrança

    novas.push({
      id: novoId('m_'),
      escolaId,
      atletaId: atleta.id,
      competencia,
      valor,
      vencimento: vencimentoEm(competencia, atleta.vencimentoDia || 10),
      status: 'pendente',
      pagoEm: null,
      forma: '',
      observacao: '',
      criadoEm: new Date().toISOString(),
    });
  }
  return novas;
}

export const estaAtrasada = (m, referencia = hoje()) =>
  m.status === 'pendente' && diasEntre(m.vencimento, referencia) > 0;

export const diasDeAtraso = (m, referencia = hoje()) =>
  estaAtrasada(m, referencia) ? diasEntre(m.vencimento, referencia) : 0;

/**
 * Situação financeira de um atleta.
 * `status` é o que a bolinha da lista mostra: em dia, a vencer ou em atraso.
 */
export function situacaoFinanceira(atletaId, mensalidades, referencia = hoje()) {
  const dele = mensalidades.filter((m) => m.atletaId === atletaId && m.status === 'pendente');
  const atrasadas = dele.filter((m) => estaAtrasada(m, referencia));
  const devido = dele.reduce((s, m) => s + m.valor, 0);
  const emAtraso = atrasadas.reduce((s, m) => s + m.valor, 0);

  return {
    status: atrasadas.length ? 'atraso' : dele.length ? 'aberto' : 'dia',
    pendentes: dele.length,
    atrasadas: atrasadas.length,
    devido,
    emAtraso,
    diasDoMaisAntigo: atrasadas.length
      ? Math.max(...atrasadas.map((m) => diasDeAtraso(m, referencia)))
      : 0,
    competencias: atrasadas.map((m) => m.competencia).sort(),
  };
}

/** Id derivado: é isto que impede a mesma mensalidade de entrar duas vezes no caixa. */
export const idDoLancamento = (mensalidadeId) => `mens_${mensalidadeId}`;

/**
 * Dá baixa numa mensalidade e devolve, junto, a entrada de caixa correspondente.
 * Quem grava é o chamador — aqui não há efeito colateral, só o cálculo.
 */
export function pagarMensalidade(mensalidade, atleta, { pagoEm = hoje(), forma = 'Pix', valorPago = null } = {}) {
  const valor = valorPago === null ? mensalidade.valor : valorPago;
  const paga = { ...mensalidade, status: 'pago', pagoEm, forma, valor };

  const lancamento = {
    id: idDoLancamento(mensalidade.id),
    escolaId: mensalidade.escolaId,
    data: pagoEm,
    tipo: 'entrada',
    categoria: 'Mensalidade',
    descricao: `Mensalidade ${mensalidade.competencia} — ${atleta?.nome || 'atleta'}`,
    valor,
    forma,
    origem: 'mensalidade',
    refId: mensalidade.id,
    criadoEm: new Date().toISOString(),
  };
  return { mensalidade: paga, lancamento };
}

/** Desfaz a baixa. O caixa perde a entrada junto — senão o saldo fica inflado. */
export function desfazerPagamento(mensalidade) {
  return {
    mensalidade: { ...mensalidade, status: 'pendente', pagoEm: null, forma: '' },
    lancamentoRemovido: idDoLancamento(mensalidade.id),
  };
}

// ─── Caixa ───────────────────────────────────────────────────────────────────

export function resumoDoMes(lancamentos, competencia) {
  const doMes = lancamentos.filter((l) => competenciaDe(l.data) === competencia);
  const entradas = doMes.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const saidas = doMes.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);

  const porCategoria = {};
  for (const l of doMes) {
    const chave = `${l.tipo}|${l.categoria || 'Outros'}`;
    porCategoria[chave] = (porCategoria[chave] || 0) + l.valor;
  }
  return { entradas, saidas, saldo: entradas - saidas, lancamentos: doMes.length, porCategoria };
}

/** Saldo de tudo que aconteceu até o fim da competência dada (inclusive). */
export function saldoAcumulado(lancamentos, ateCompetencia) {
  return lancamentos
    .filter((l) => competenciaDe(l.data) <= ateCompetencia)
    .reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);
}

/**
 * A régua da cobrança do mês: quanto foi emitido, quanto entrou, quanto falta e
 * quanto já venceu. É o número que o dono quer ver antes de qualquer outro.
 */
export function previsaoDoMes(mensalidades, competencia, referencia = hoje()) {
  const doMes = mensalidades.filter((m) => m.competencia === competencia && m.status !== 'cancelado');
  const pagas = doMes.filter((m) => m.status === 'pago');
  const pendentes = doMes.filter((m) => m.status === 'pendente');
  const atrasadas = pendentes.filter((m) => estaAtrasada(m, referencia));

  const soma = (lista) => lista.reduce((s, m) => s + m.valor, 0);
  const emitido = soma(doMes);
  const recebido = soma(pagas);

  return {
    emitido,
    recebido,
    aReceber: soma(pendentes),
    emAtraso: soma(atrasadas),
    quantidade: doMes.length,
    pagas: pagas.length,
    pendentes: pendentes.length,
    atrasadas: atrasadas.length,
    // Sem cobrança emitida a taxa é 0, não NaN — ela vai para dentro de uma barra.
    taxa: emitido > 0 ? recebido / emitido : 0,
  };
}

/** Quem está devendo, do mais atrasado para o menos. É a fila de cobrança. */
export function filaDeCobranca(atletas, mensalidades, referencia = hoje()) {
  return atletas
    .map((atleta) => ({ atleta, situacao: situacaoFinanceira(atleta.id, mensalidades, referencia) }))
    .filter((linha) => linha.situacao.pendentes > 0)
    .sort((a, b) =>
      b.situacao.diasDoMaisAntigo - a.situacao.diasDoMaisAntigo
      || b.situacao.devido - a.situacao.devido
      || a.atleta.nome.localeCompare(b.atleta.nome, 'pt-BR'));
}

// ─── Times, jogos e treinos ──────────────────────────────────────────────────

export const atletasDoTime = (atletas, timeId) =>
  atletas.filter((a) => a.timeIds?.includes(timeId))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * Confere uma escalação contra a regra da modalidade do time.
 * Devolve avisos em vez de barrar — amistoso com time incompleto existe, e o
 * app não é quem decide se o jogo acontece.
 *
 * @param {Array} escalados
 * @param {object} [time] quando falta, vale a regra do vôlei (ver `modalidadeDe`)
 */
export function conferirEscalacao(escalados = [], time) {
  const modalidade = modalidadeDe(time);
  const { emQuadra, especial } = modalidade;

  const titulares = escalados.filter((e) => e.papel === 'titular').length;
  const especiais = escalados.filter((e) => e.papel === especial.chave).length;
  const avisos = [];

  if (titulares !== emQuadra) {
    const faltam = emQuadra - titulares;
    avisos.push(faltam > 0
      ? `${faltam === 1 ? 'Falta 1' : `Faltam ${faltam}`} para fechar a escalação.`
      : `${titulares} em quadra — entram ${emQuadra}.`);
  }
  if (!especiais) avisos.push(`Sem ${especial.rotulo.toLowerCase()} escalado.`);
  else if (especiais > especial.maximo) avisos.push(`Mais de um ${especial.rotulo.toLowerCase()} escalado.`);

  return {
    titulares,
    emQuadra,
    especiais,
    // `liberos` continua no retorno porque a tela antiga lia esse nome.
    liberos: especiais,
    reservas: escalados.filter((e) => e.papel === 'reserva').length,
    modalidade,
    avisos,
  };
}

export function resumoDePresenca(treino, atletas) {
  const lista = treino?.presencas || [];
  const conta = (status) => lista.filter((p) => p.status === status).length;
  const doTime = atletasDoTime(atletas, treino?.timeId).length;
  const respondidos = lista.length;

  return {
    confirmados: conta('confirmado'),
    presentes: conta('presente'),
    faltas: conta('falta'),
    justificadas: conta('justificado'),
    semResposta: Math.max(0, doTime - respondidos),
    elenco: doTime,
  };
}

/** Frequência de um atleta: só conta treino em que a chamada foi feita. */
export function frequencia(atletaId, treinos) {
  const chamados = treinos.filter((t) =>
    (t.presencas || []).some((p) => p.atletaId === atletaId && p.status !== 'confirmado'));
  if (!chamados.length) return { treinos: 0, presencas: 0, taxa: null };

  const presencas = chamados.filter((t) =>
    (t.presencas || []).some((p) => p.atletaId === atletaId && p.status === 'presente')).length;
  return { treinos: chamados.length, presencas, taxa: presencas / chamados.length };
}

/** O compromisso mais próximo que ainda não passou — jogo ou treino. */
export function proximoCompromisso(jogos, treinos, referencia = hoje()) {
  const futuros = [
    ...jogos.map((j) => ({ tipo: 'jogo', data: j.data, hora: j.hora, item: j })),
    ...treinos.map((t) => ({ tipo: 'treino', data: t.data, hora: t.hora, item: t })),
  ].filter((c) => c.data >= referencia)
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
  return futuros[0] || null;
}

/**
 * Menor de idade. Muda o que o app faz: a cobrança vai para o responsável, não
 * para o atleta — mandar cobrança de mensalidade no WhatsApp de um menino de 13
 * anos é errado antes de ser ineficaz. Ver a nota de LGPD no README.
 */
export const ehMenor = (atleta, referencia = hoje()) => {
  const anos = idade(atleta?.nascimento, referencia);
  return anos !== null && anos < 18;
};

/** Para quem a mensagem vai: responsável quando menor, o próprio quando adulto. */
export function destinatarioDaCobranca(atleta) {
  const responsavel = String(atleta?.responsavelTelefone || '').trim();
  if (ehMenor(atleta) && responsavel) {
    return { nome: atleta.responsavelNome || 'responsável', telefone: responsavel, paraResponsavel: true };
  }
  const proprio = String(atleta?.telefone || '').trim();
  if (proprio) return { nome: atleta.nome, telefone: proprio, paraResponsavel: false };
  if (responsavel) {
    return { nome: atleta.responsavelNome || 'responsável', telefone: responsavel, paraResponsavel: true };
  }
  return null;
}
