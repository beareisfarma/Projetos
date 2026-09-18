/**
 * As mensagens que saem da escolinha, prontas para o WhatsApp.
 *
 * POR QUE WHATSAPP E NÃO NOTIFICAÇÃO DO APP: notificação push exige que cada
 * atleta instale o app e autorize. Numa escolinha com adolescentes isso não
 * acontece — e uma cobrança que não chega não é cobrança. O WhatsApp já está
 * instalado, já é lido, e o link `wa.me` abre a conversa com o texto pronto,
 * sem API, sem tarifa por mensagem e sem risco de bloqueio por disparo em massa,
 * porque quem aperta enviar é uma pessoa.
 *
 * O preço dessa escolha, dito na cara: o envio é um toque por atleta, não um
 * botão que dispara para trinta. Automatizar exige a API oficial do WhatsApp
 * Business, que é paga e exige modelo de mensagem aprovado pela Meta.
 *
 * Cobrança de menor de idade vai para o responsável — ver `destinatarioDaCobranca`.
 */

import { reais, dataBR, competenciaPorExtenso, telefoneInternacional, dataCurta, diaDaSemana } from './formato.js';
import { copiaECola } from './pix.js';
import { estaAtrasada, diasDeAtraso, destinatarioDaCobranca } from './modelo.js';

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

/** Junta uma lista em português: "a, b e c". */
const lista = (itens) => itens.length <= 1
  ? (itens[0] || '')
  : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;

/**
 * Texto da cobrança.
 *
 * O tom muda com a situação, de propósito: antes de vencer é lembrete, depois é
 * cobrança. Tratar as duas como a mesma coisa faz a escolinha parecer agressiva
 * com quem está em dia e frouxa com quem não está.
 */
export function mensagemDeCobranca(atleta, mensalidades, escola, referencia) {
  const pendentes = mensalidades
    .filter((m) => m.atletaId === atleta.id && m.status === 'pendente')
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
  if (!pendentes.length) return null;

  const destino = destinatarioDaCobranca(atleta);
  const total = pendentes.reduce((s, m) => s + m.valor, 0);
  const atrasadas = pendentes.filter((m) => estaAtrasada(m, referencia));
  const meses = pendentes.map((m) => competenciaPorExtenso(m.competencia));

  const abertura = destino?.paraResponsavel
    ? `Oi, ${primeiroNome(destino.nome)}! Aqui é da ${escola.nome}, sobre a mensalidade do(a) ${primeiroNome(atleta.nome)}.`
    : `Oi, ${primeiroNome(atleta.nome)}! Aqui é da ${escola.nome}.`;

  // Concordância: uma mensalidade "está", várias "estão". Cobrança com erro de
  // português passa a impressão de mensagem automática e perde autoridade.
  const varias = pendentes.length > 1;
  const corpo = atrasadas.length
    ? `${varias ? 'As mensalidades' : 'A mensalidade'} de ${lista(meses)} ${varias ? 'estão' : 'está'} em aberto`
      + ` — ${varias ? 'a mais antiga venceu' : 'venceu'} em ${dataBR(atrasadas[0].vencimento)}`
      + `${diasDeAtraso(atrasadas[0], referencia) > 1 ? `, há ${diasDeAtraso(atrasadas[0], referencia)} dias` : ''}.`
    : `Passando para lembrar ${varias ? 'das mensalidades' : 'da mensalidade'} de ${lista(meses)},`
      + ` que ${varias ? 'vencem' : 'vence'} em ${dataBR(pendentes[0].vencimento)}.`;

  const valor = pendentes.length > 1
    ? `São ${pendentes.length} mensalidades, ${reais(total)} no total.`
    : `O valor é ${reais(total)}.`;

  const linhas = [abertura, '', corpo, valor];

  if (escola.pixChave) {
    linhas.push('', 'Pode pagar no Pix por este código (copia e cola):', '',
      copiaECola({
        chave: escola.pixChave,
        nome: escola.pixNome || escola.nome,
        cidade: escola.pixCidade || '',
        centavos: total,
        txid: `${atleta.id}${pendentes[0].competencia}`.replace(/[^A-Za-z0-9]/g, ''),
      }));
  }

  linhas.push('', atrasadas.length
    ? 'Se já tiver pago, me avisa que eu dou baixa. Qualquer aperto, fala comigo que a gente combina.'
    : 'Qualquer dúvida é só chamar!');

  return { texto: linhas.join('\n'), destino, total, pendentes };
}

/**
 * Recibo. Existe porque o mesmo canal que cobra precisa confirmar — quem pagou
 * e não recebeu confirmação liga desconfiado, e quem recebe confirmação paga
 * mais fácil da próxima vez.
 */
export function mensagemDeRecibo(atleta, mensalidade, escola) {
  const destino = destinatarioDaCobranca(atleta);
  const nome = destino?.paraResponsavel ? primeiroNome(destino.nome) : primeiroNome(atleta.nome);
  const de = destino?.paraResponsavel ? ` do(a) ${primeiroNome(atleta.nome)}` : '';

  return {
    texto: [
      `Oi, ${nome}! Recebemos a mensalidade${de} de ${competenciaPorExtenso(mensalidade.competencia)}`
      + ` — ${reais(mensalidade.valor)}.`,
      '',
      `Baixa dada em ${dataBR(mensalidade.pagoEm)}. Obrigado!`,
      `— ${escola.nome}`,
    ].join('\n'),
    destino,
  };
}

/** Convocação para o jogo: quem foi escalado precisa saber onde e a que horas. */
export function mensagemDeConvocacao(atleta, jogo, time, escola) {
  const destino = destinatarioDaCobranca(atleta);
  const papel = (jogo.escalados || []).find((e) => e.atletaId === atleta.id)?.papel || 'relacionado';
  const quem = destino?.paraResponsavel
    ? `${primeiroNome(atleta.nome)} está ${papel === 'reserva' ? 'relacionado(a)' : 'escalado(a)'}`
    : `Você está ${papel === 'reserva' ? 'relacionado(a)' : 'escalado(a)'}`;

  return {
    texto: [
      `${destino?.paraResponsavel ? `Oi, ${primeiroNome(destino.nome)}!` : `Oi, ${primeiroNome(atleta.nome)}!`}`
      + ` ${quem} para o jogo do ${time?.nome || 'time'}${papel === 'titular' ? ' como titular' : ''}.`,
      '',
      `📅 ${diaDaSemana(jogo.data)}, ${dataBR(jogo.data)}${jogo.hora ? ` às ${jogo.hora}` : ''}`,
      `🆚 ${jogo.adversario || 'a definir'}`,
      `📍 ${jogo.local || 'local a confirmar'}`,
      ...(jogo.chegada ? [`⏰ Chegar às ${jogo.chegada}`] : []),
      '',
      `Confirma pra mim? — ${escola.nome}`,
    ].join('\n'),
    destino,
  };
}

/**
 * Chamada de treino. Enquanto o atleta não tiver login próprio, é isto que faz
 * ele confirmar presença: ele responde no WhatsApp e o dono marca na chamada.
 * Tosco? É. Mas funciona no primeiro dia e não depende de ninguém instalar nada.
 */
export function mensagemDeTreino(treino, time, escola) {
  return [
    `Treino do ${time?.nome || 'time'} — ${diaDaSemana(treino.data)}, ${dataCurta(treino.data)}`
    + `${treino.hora ? ` às ${treino.hora}` : ''}.`,
    ...(treino.local ? [`📍 ${treino.local}`] : []),
    ...(treino.foco ? [`Foco: ${treino.foco}`] : []),
    '',
    'Confirma presença respondendo aqui, por favor. Quem não confirmar até a véspera eu conto como fora.',
    `— ${escola.nome}`,
  ].join('\n');
}

/**
 * Link que abre a conversa no WhatsApp com o texto pronto.
 * Sem telefone devolve nulo: link `wa.me` sem número abre o seletor de contatos
 * e o dono manda a cobrança para a pessoa errada.
 */
export function linkWhatsApp(telefone, texto) {
  const numero = telefoneInternacional(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
