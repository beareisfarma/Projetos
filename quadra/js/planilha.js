/**
 * Exportação em CSV.
 *
 * Existe por um motivo declarado pelo cliente: hoje ele controla entradas e
 * saídas numa planilha à mão, e é isso que o sobrecarrega. Trocar uma planilha
 * por um app só funciona se o app devolver a planilha quando ele quiser — para
 * mandar ao contador, para conferir, ou para ir embora. Ferramenta que prende
 * dado é ferramenta que ele vai recusar, e com razão.
 *
 * Separador `;` e decimal com vírgula: é o que o Excel em português abre com
 * duplo clique. Vírgula como separador quebraria as colunas no computador dele.
 */
import { dataBR, competenciaPorExtenso } from './formato.js';

/** Aspas duplicadas e campo entre aspas — o CSV padrão (RFC 4180). */
const celula = (valor) => {
  const texto = String(valor ?? '');
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const linha = (campos) => campos.map(celula).join(';');

/** Centavos viram "1234,56": o Excel em pt-BR lê como número, não como texto. */
const valorBR = (centavos) => (Math.abs(centavos) / 100).toFixed(2).replace('.', ',');

/**
 * O BOM (﻿) no começo não é enfeite: sem ele o Excel no Windows lê o
 * arquivo como latin-1 e "Mensalidade de março" chega torto.
 */
const arquivo = (linhas) => `﻿${linhas.join('\r\n')}\r\n`;

export function caixaEmCsv(lancamentos) {
  const ordenados = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data));
  return arquivo([
    linha(['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Forma', 'Origem']),
    ...ordenados.map((l) => linha([
      dataBR(l.data),
      l.tipo === 'entrada' ? 'Entrada' : 'Saída',
      l.categoria || '',
      l.descricao || '',
      // Saída vai negativa: somar a coluna inteira já dá o saldo.
      (l.tipo === 'saida' ? '-' : '') + valorBR(l.valor),
      l.forma || '',
      l.origem === 'mensalidade' ? 'Mensalidade' : 'Manual',
    ])),
  ]);
}

export function mensalidadesEmCsv(mensalidades, atletas, times) {
  const nomeDoAtleta = (id) => atletas.find((a) => a.id === id)?.nome || 'atleta removido';
  const timeDoAtleta = (id) => {
    const atleta = atletas.find((a) => a.id === id);
    return times.find((t) => t.id === atleta?.timeIds?.[0])?.nome || '';
  };
  const ROTULO = { pago: 'Pago', pendente: 'Em aberto', cancelado: 'Cancelado', isento: 'Isento' };

  const ordenadas = [...mensalidades].sort((a, b) =>
    a.competencia.localeCompare(b.competencia)
    || nomeDoAtleta(a.atletaId).localeCompare(nomeDoAtleta(b.atletaId), 'pt-BR'));

  return arquivo([
    linha(['Mês', 'Atleta', 'Time', 'Valor', 'Vencimento', 'Situação', 'Pago em', 'Forma']),
    ...ordenadas.map((m) => linha([
      competenciaPorExtenso(m.competencia),
      nomeDoAtleta(m.atletaId),
      timeDoAtleta(m.atletaId),
      valorBR(m.valor),
      dataBR(m.vencimento),
      ROTULO[m.status] || m.status,
      m.pagoEm ? dataBR(m.pagoEm) : '',
      m.forma || '',
    ])),
  ]);
}

export const nomeDoCsv = (escola, tipo) => {
  const apelido = String(escola?.nome || 'escolinha')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'escolinha';
  return `${apelido}-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
};
