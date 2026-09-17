/**
 * Entrada de evidências fotográficas.
 *
 * Toda foto é reduzida antes de ser guardada. Foto de celular hoje chega com
 * 4000px e 5 MB; num relatório de 20 evidências isso é 100 MB no IndexedDB e
 * uma exportação que trava o aparelho. 1600px no lado maior já é mais do que
 * os ~34 mm que a foto ocupa na página impressa.
 *
 * A orientação vem do próprio decodificador do navegador (createImageBitmap
 * com imageOrientation:'from-image'), então foto tirada de lado não sai
 * deitada — erro clássico quando se desenha o arquivo direto no canvas.
 */

const LADO_MAX = 1600;
const QUALIDADE = 0.86;

/**
 * @param {File} arquivo
 * @returns {Promise<Blob>} JPEG reduzido
 */
export async function prepararFoto(arquivo) {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Esse arquivo não é uma imagem.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await viaTag(arquivo);   // Safari antigo
  }

  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const l = Math.round(bitmap.width * escala);
  const a = Math.round(bitmap.height * escala);

  const tela = document.createElement('canvas');
  tela.width = l; tela.height = a;
  const ctx = tela.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, l, a);
  bitmap.close?.();

  const blob = await new Promise((ok) => tela.toBlob(ok, 'image/jpeg', QUALIDADE));
  if (!blob) throw new Error('Não consegui processar essa imagem.');
  return blob;
}

function viaTag(arquivo) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('imagem ilegível')); };
    img.src = url;
  });
}
