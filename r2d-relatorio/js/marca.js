/**
 * Marca institucional — fonte única.
 *
 * O símbolo é desenhado em SVG (só paths, sem <text>) e o logotipo "APSEN"
 * mais a assinatura saem como texto HTML. Isso é de propósito: o html2canvas,
 * que gera o PDF e as imagens, serializa <svg> como imagem e nesse caminho as
 * webfonts não carregam — <text> dentro de SVG sairia com a fonte errada na
 * exportação. Texto em HTML ele rasteriza com a fonte certa.
 *
 * Esta marca é FIXA. Não existe caminho no app para trocá-la, e é de propósito:
 * a identidade da empresa é padronizada em todo relatório gerado.
 *
 * Para substituir pelo arquivo oficial da empresa, troque SIMBOLO por aquele
 * SVG (mesma proporção 148x74) — nada mais no app precisa mudar.
 */

/** Símbolo: as duas montanhas, a gota vazada, a estrela e o clarão. */
export const SIMBOLO = `
<svg viewBox="0 0 148 74" role="img" aria-label="APSEN" focusable="false">
  <g fill="currentColor">
    <!-- pico menor, à esquerda; a borda direita é o lado esquerdo da gota -->
    <path d="M0 74 L58 13 C54 36 48 52 33 74 Z"/>
    <!-- pico principal; a borda esquerda é o lado direito da gota.
         O clarão é vazado com fill-rule evenodd. -->
    <path fill-rule="evenodd" d="M74 0 L148 74 L97 74 C76 54 64 36 58 13 Z
      M114.6 3.2 L115 18.1 L123.7 13.1 L118.1 21.4 L132.1 22.9 L118.3 25.9
      L123.4 32.6 L115.6 29.5 L116.9 45.3 L111.2 30.6 L105.1 37.5 L107.2 28.5
      L94.6 31.4 L105.4 24.3 L95.9 19.1 L106.7 20 L100.6 6.4 L110.5 17.6 Z"/>
    <!-- estrela de oito pontas, no ponto mais largo da gota -->
    <path d="M57 37.5 L58.5 46.5 L65.8 41.2 L60.5 48.5 L69.5 50 L60.5 51.5
      L65.8 58.8 L58.5 53.5 L57 62.5 L55.5 53.5 L48.2 58.8 L53.5 51.5
      L44.5 50 L53.5 48.5 L48.2 41.2 L55.5 46.5 Z"/>
  </g>
</svg>`.trim();

/**
 * Lockup completo: símbolo + logotipo + assinatura.
 * @param {{assinatura?: boolean, classe?: string}} [opcoes]
 */
export function marcaInstitucional({ assinatura = true, classe = '' } = {}) {
  return `
<div class="marca ${classe}">
  <div class="marca__simbolo">${SIMBOLO}</div>
  <div class="marca__nome">APSEN</div>
  ${assinatura ? '<div class="marca__assinatura">Inspirados<br>pela saúde</div>' : ''}
</div>`.trim();
}

/** Assinatura de rodapé usada nas páginas do relatório. */
export const SLOGAN = 'Ciência para uma vida mais possível';
