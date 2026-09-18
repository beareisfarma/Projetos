/**
 * Pix "copia e cola" (BR Code estático), gerado aqui dentro — sem API, sem
 * intermediário e sem custo. O padrão é o EMV-QRCPS adotado pelo Banco Central:
 * uma sequência de campos `IDLLVALOR` (dois dígitos de id, dois de tamanho,
 * valor), fechada por um CRC-16/CCITT-FALSE dos próprios dados.
 *
 * O que ele NÃO faz, e é importante dizer: BR Code estático não avisa ninguém
 * quando o dinheiro cai. A baixa da mensalidade continua sendo um toque do dono
 * da escolinha. Confirmação automática exigiria API de banco/PSP, que é paga —
 * a decisão de ficar no estático é o que mantém o app em custo zero.
 *
 * Referência: Manual de Padrões para Iniciação do Pix (BCB) e Manual do BR Code.
 */

/** Tira acento e qualquer coisa fora do ASCII imprimível: o payload é ASCII. */
export function ascii(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/** Um campo do payload. O tamanho é contado em caracteres, sempre com 2 dígitos. */
export const campo = (id, valor) => {
  const v = String(valor);
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
};

/**
 * CRC-16/CCITT-FALSE: polinômio 0x1021, valor inicial 0xFFFF, sem reflexão e
 * sem xor final. É o que o BR Code exige — outras variantes de CRC-16 dão um
 * número diferente e o banco recusa o código.
 */
export function crc16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Só letras e números no identificador: o campo 05 do template 62 é restrito. */
export const txidLimpo = (texto) => {
  const limpo = ascii(texto).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  return limpo || '***';
};

/**
 * Monta o "copia e cola".
 *
 * @param {object} p
 * @param {string} p.chave      chave Pix do recebedor (CPF/CNPJ, telefone, e-mail ou aleatória)
 * @param {string} p.nome       nome do recebedor (o padrão corta em 25 caracteres)
 * @param {string} p.cidade     cidade do recebedor (corta em 15)
 * @param {number} [p.centavos] valor em centavos; 0 ou ausente deixa o pagador digitar
 * @param {string} [p.txid]     identificador da cobrança, até 25 alfanuméricos
 * @returns {string}
 */
export function copiaECola({ chave, nome, cidade, centavos = 0, txid = '' }) {
  const pix = ascii(chave);
  if (!pix) throw new Error('Chave Pix não informada.');

  // O template 26 carrega o domínio do arranjo e a chave, aninhados.
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', pix);

  const partes = [
    campo('00', '01'),          // versão do payload
    campo('01', '11'),          // estático: pode ser lido quantas vezes precisar
    campo('26', conta),
    campo('52', '0000'),        // categoria do estabelecimento: não especificada
    campo('53', '986'),         // real
  ];

  // Valor em reais com duas casas. Vem de centavos para não passar por float.
  if (centavos > 0) {
    partes.push(campo('54', `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`));
  }

  partes.push(
    campo('58', 'BR'),
    campo('59', ascii(nome).slice(0, 25) || 'RECEBEDOR'),
    campo('60', ascii(cidade).slice(0, 15) || 'BRASIL'),
    campo('62', campo('05', txidLimpo(txid))),
  );

  // O CRC é calculado sobre o payload inteiro JÁ COM o "6304" no fim.
  const semCrc = `${partes.join('')}6304`;
  return semCrc + crc16(semCrc);
}

/** Confere um payload recebido: o CRC do fim tem que bater com o resto. */
export function crcConfere(payload) {
  const texto = String(payload || '');
  if (texto.length < 8) return false;
  const corpo = texto.slice(0, -4);
  if (!corpo.endsWith('6304')) return false;
  return crc16(corpo) === texto.slice(-4).toUpperCase();
}
