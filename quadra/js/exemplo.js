/**
 * Uma escolinha de exemplo, montada em relação à data de HOJE.
 *
 * Existe por um motivo prático: app de gestão aberto vazio não se demonstra.
 * Quem vai vender a ferramenta precisa abrir e já ver mensalidade em atraso,
 * caixa com movimento e um jogo escalado — senão a conversa vira "imagina que
 * aqui teria...". Fixar datas em 2026 estragaria isso em dois meses, então tudo
 * é calculado a partir de hoje.
 */
import { hoje, competenciaAtual, somarMeses, vencimentoEm, diaLocal } from './formato.js';
import { novoId } from './modelo.js';

const emDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return diaLocal(d);
};

export function escolinhaDeExemplo() {
  const mesAtual = competenciaAtual();
  const mesPassado = somarMeses(mesAtual, -1);
  const retrasado = somarMeses(mesAtual, -2);

  const escola = {
    id: 'escola',
    nome: 'Escolinha Saque e Viagem',
    responsavel: 'Rodrigo Menezes',
    telefone: '21988887777',
    pixChave: 'saqueeviagem@exemplo.com.br',
    pixNome: 'Saque e Viagem Volei',
    pixCidade: 'Niteroi',
    vencimentoPadrao: 10,
  };

  const times = [
    { id: 'tm_sub13', nome: 'Sub-13 Misto', categoria: 'Sub-13', mensalidade: 12000,
      dias: ['terça', 'quinta'], hora: '17:00', local: 'Ginásio do Clube', tecnico: 'Rodrigo Menezes', ativo: true },
    { id: 'tm_sub15', nome: 'Sub-15 Feminino', categoria: 'Sub-15', mensalidade: 15000,
      dias: ['segunda', 'quarta', 'sexta'], hora: '18:00', local: 'Ginásio do Clube', tecnico: 'Paula Andrade', ativo: true },
    { id: 'tm_adulto', nome: 'Adulto Feminino', categoria: 'Adulto', mensalidade: 18000,
      dias: ['terça', 'quinta'], hora: '20:00', local: 'Quadra da Praia', tecnico: 'Paula Andrade', ativo: true },
  ];

  const anoBase = Number(hoje().slice(0, 4));
  const nasc = (anos, mes, dia) => `${anoBase - anos}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  const brutos = [
    // Sub-13 — menores: a cobrança vai para o responsável.
    ['Ana Clara Ribeiro', 'tm_sub13', 12, 'Ponteiro', 7, 'Marcia Ribeiro', '21988880001', null],
    ['Beatriz Nunes Lima', 'tm_sub13', 12, 'Levantador', 5, 'Carlos Lima', '21988880002', null],
    ['Caio Ferreira', 'tm_sub13', 13, 'Central', 12, 'Sandra Ferreira', '21988880003', null],
    ['Duda Carvalho', 'tm_sub13', 13, 'Líbero', 3, 'Renata Carvalho', '21988880004', null],
    // Sub-15
    ['Elisa Monteiro', 'tm_sub15', 14, 'Ponteiro', 9, 'Vera Monteiro', '21988880005', null],
    ['Fernanda Prado', 'tm_sub15', 15, 'Oposto', 11, 'Jorge Prado', '21988880006', null],
    ['Giovana Alves', 'tm_sub15', 15, 'Central', 4, 'Lucia Alves', '21988880007', null],
    ['Helena Torres', 'tm_sub15', 14, 'Levantador', 6, 'Marcos Torres', '21988880008', null],
    ['Isabela Rocha', 'tm_sub15', 15, 'Líbero', 2, 'Cristina Rocha', '21988880009', 0], // bolsista
    ['Julia Sampaio', 'tm_sub15', 14, 'Ponteiro', 10, 'Andre Sampaio', '21988880010', 12000], // desconto de irmã
    // Adulto — maiores: falam por si.
    ['Karina Duarte', 'tm_adulto', 24, 'Ponteiro', 8, '', '', null],
    ['Larissa Peixoto', 'tm_adulto', 27, 'Central', 14, '', '', null],
    ['Marina Bastos', 'tm_adulto', 22, 'Levantador', 1, '', '', null],
    ['Natalia Guedes', 'tm_adulto', 31, 'Oposto', 17, '', '', null],
    ['Olivia Castro', 'tm_adulto', 26, 'Líbero', 13, '', '', null],
  ];

  const atletas = brutos.map(([nome, timeId, anos, posicao, numero, respNome, respTel, valor], i) => ({
    id: `at_${String(i + 1).padStart(2, '0')}`,
    escolaId: 'escola',
    nome,
    nascimento: nasc(anos, ((i * 3) % 12) + 1, ((i * 7) % 27) + 1),
    timeIds: [timeId],
    posicao,
    numero,
    telefone: respNome ? '' : `2198888${String(1000 + i)}`,
    responsavelNome: respNome,
    responsavelTelefone: respTel,
    mensalidade: valor,
    isento: valor === 0,
    vencimentoDia: 10,
    status: 'ativo',
    entradaEm: emDias(-120 - i * 5),
    observacoes: valor === 0 ? 'Bolsa integral — projeto social.' : '',
  }));

  // ── Mensalidades: três meses, com um retrato realista de inadimplência ──
  const mensalidades = [];
  const lancamentos = [];

  const valorDe = (a) => (a.isento ? 0
    : Number.isFinite(a.mensalidade) ? a.mensalidade
      : times.find((t) => t.id === a.timeIds[0]).mensalidade);

  // Quem está devendo: duas de dois meses, duas só do mês corrente.
  const devendoAntigo = new Set(['at_03', 'at_06']);
  const devendoAtual = new Set(['at_03', 'at_09', 'at_06', 'at_11', 'at_14']);

  for (const competencia of [retrasado, mesPassado, mesAtual]) {
    for (const atleta of atletas) {
      const valor = valorDe(atleta);
      if (valor <= 0) continue;

      const atrasadoAqui = competencia !== mesAtual
        ? (competencia === mesPassado && devendoAntigo.has(atleta.id))
        : devendoAtual.has(atleta.id);

      const m = {
        id: `m_${atleta.id}_${competencia}`,
        escolaId: 'escola',
        atletaId: atleta.id,
        competencia,
        valor,
        vencimento: vencimentoEm(competencia, atleta.vencimentoDia),
        status: atrasadoAqui ? 'pendente' : 'pago',
        pagoEm: null,
        forma: '',
        observacao: '',
        criadoEm: new Date().toISOString(),
      };

      if (m.status === 'pago') {
        m.pagoEm = vencimentoEm(competencia, Math.max(1, atleta.vencimentoDia - 2));
        m.forma = ['Pix', 'Pix', 'Pix', 'Dinheiro', 'Transferência'][atleta.numero % 5];
        lancamentos.push({
          id: `mens_${m.id}`,
          escolaId: 'escola',
          data: m.pagoEm,
          tipo: 'entrada',
          categoria: 'Mensalidade',
          descricao: `Mensalidade ${competencia} — ${atleta.nome}`,
          valor,
          forma: m.forma,
          origem: 'mensalidade',
          refId: m.id,
          criadoEm: new Date().toISOString(),
        });
      }
      mensalidades.push(m);
    }
  }

  // ── Caixa: as saídas que uma escolinha tem de verdade ──
  const saidas = [
    ['Aluguel de quadra', 'Aluguel do ginásio', 60000],
    ['Salário / comissão', 'Técnica Paula — mensal', 120000],
    ['Material esportivo', '6 bolas Mikasa MVA300', 84000],
    ['Arbitragem', 'Arbitragem do amistoso', 15000],
    ['Impostos e taxas', 'DAS do mês', 7500],
  ];
  const entradasExtras = [
    ['Matrícula', 'Matrícula — 2 atletas novos', 16000],
    ['Uniforme', 'Venda de 8 uniformes', 64000],
  ];

  for (const competencia of [retrasado, mesPassado, mesAtual]) {
    saidas.forEach(([categoria, descricao, valor], i) => {
      if (competencia === mesAtual && i > 1) return;   // o mês corrente ainda está andando
      lancamentos.push({
        id: novoId('l_'), escolaId: 'escola', data: vencimentoEm(competencia, 5 + i * 3),
        tipo: 'saida', categoria, descricao, valor, forma: 'Pix', origem: 'manual', refId: null,
        criadoEm: new Date().toISOString(),
      });
    });
    if (competencia !== mesAtual) {
      entradasExtras.forEach(([categoria, descricao, valor], i) => {
        lancamentos.push({
          id: novoId('l_'), escolaId: 'escola', data: vencimentoEm(competencia, 12 + i * 4),
          tipo: 'entrada', categoria, descricao, valor, forma: 'Pix', origem: 'manual', refId: null,
          criadoEm: new Date().toISOString(),
        });
      });
    }
  }

  // ── Agenda ──
  const escalar = (ids, papeis) => ids.map((id, i) => ({ atletaId: id, papel: papeis[i] }));

  const jogos = [
    {
      id: 'jg_1', escolaId: 'escola', timeId: 'tm_sub15', data: emDias(4), hora: '10:00', chegada: '09:15',
      adversario: 'AABB Niterói', local: 'Ginásio da AABB', mandante: false, competicao: 'Copa Metropolitana',
      escalados: escalar(
        ['at_05', 'at_06', 'at_07', 'at_08', 'at_10', 'at_09', 'at_04'],
        ['titular', 'titular', 'titular', 'titular', 'titular', 'líbero', 'reserva']),
      placarNos: null, placarEles: null, status: 'agendado', observacoes: '',
    },
    {
      id: 'jg_2', escolaId: 'escola', timeId: 'tm_adulto', data: emDias(11), hora: '19:30', chegada: '18:45',
      adversario: 'Vôlei Icaraí', local: 'Quadra da Praia', mandante: true, competicao: 'Amistoso',
      escalados: escalar(
        ['at_11', 'at_12', 'at_13', 'at_14', 'at_15'],
        ['titular', 'titular', 'titular', 'titular', 'líbero']),
      placarNos: null, placarEles: null, status: 'agendado', observacoes: '',
    },
    {
      id: 'jg_3', escolaId: 'escola', timeId: 'tm_sub15', data: emDias(-9), hora: '10:00', chegada: '',
      adversario: 'Colégio Salesiano', local: 'Ginásio do Clube', mandante: true, competicao: 'Copa Metropolitana',
      escalados: escalar(
        ['at_05', 'at_06', 'at_07', 'at_08', 'at_10', 'at_09'],
        ['titular', 'titular', 'titular', 'titular', 'titular', 'líbero']),
      placarNos: 3, placarEles: 1, status: 'encerrado', observacoes: 'Boa virada no terceiro set.',
    },
  ];

  const treinos = [
    { id: 'tr_1', escolaId: 'escola', timeId: 'tm_sub15', data: emDias(1), hora: '18:00',
      local: 'Ginásio do Clube', foco: 'Recepção e passe', presencas: [
        { atletaId: 'at_05', status: 'confirmado' }, { atletaId: 'at_06', status: 'confirmado' },
        { atletaId: 'at_08', status: 'confirmado' }, { atletaId: 'at_09', status: 'justificado' },
      ] },
    { id: 'tr_2', escolaId: 'escola', timeId: 'tm_sub15', data: emDias(-2), hora: '18:00',
      local: 'Ginásio do Clube', foco: 'Saque viagem', presencas: [
        { atletaId: 'at_05', status: 'presente' }, { atletaId: 'at_06', status: 'presente' },
        { atletaId: 'at_07', status: 'falta' }, { atletaId: 'at_08', status: 'presente' },
        { atletaId: 'at_09', status: 'presente' }, { atletaId: 'at_10', status: 'justificado' },
      ] },
    { id: 'tr_3', escolaId: 'escola', timeId: 'tm_sub13', data: emDias(-1), hora: '17:00',
      local: 'Ginásio do Clube', foco: 'Fundamentos — manchete', presencas: [
        { atletaId: 'at_01', status: 'presente' }, { atletaId: 'at_02', status: 'presente' },
        { atletaId: 'at_03', status: 'presente' }, { atletaId: 'at_04', status: 'falta' },
      ] },
  ];

  return { versao: 1, escola, times, atletas, mensalidades, lancamentos, jogos, treinos };
}
