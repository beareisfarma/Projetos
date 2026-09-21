/* =========================================================
   MOTOR DO SITE — idioma, tema, revelação.

   IDIOMA: quem manda é a URL, não o JavaScript.
     /     → português   (é o que está escrito no HTML)
     /en   → inglês      (trocado por este arquivo)

   Foi escolhido assim de propósito. Um seletor que só troca
   o texto na memória deixa as duas versões no mesmo endereço,
   e aí o Google indexa uma só — em português. Com dois
   endereços de verdade + hreflang, cada idioma tem a própria
   página para ser encontrada.

   E por isso o seletor PT|EN são dois LINKS, não dois botões:
   funciona sem JavaScript e dá ao buscador um caminho para
   descobrir a versão em inglês.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 1. Qual idioma ---------- */
  var caminho = location.pathname.replace(/\/+$/, '');
  var idioma  = (caminho === '/en') ? 'en' : 'pt';
  var dic     = CONTEUDO[idioma] || CONTEUDO.pt;

  /* Chave que não existe volta o próprio nome da chave, bem visível.
     Devolver string vazia esconderia o erro até alguém abrir o site. */
  function t(chave) {
    if (Object.prototype.hasOwnProperty.call(dic, chave)) return dic[chave];
    if (Object.prototype.hasOwnProperty.call(CONTEUDO.pt, chave)) return CONTEUDO.pt[chave];
    return '[' + chave + ']';
  }

  /* ---------- 2. Texto ---------- */
  function aplicarTextos() {
    var i, nos;

    nos = document.querySelectorAll('[data-i18n]');
    for (i = 0; i < nos.length; i++) nos[i].textContent = t(nos[i].getAttribute('data-i18n'));

    /* Só as chaves terminadas em .html carregam marcação, e todas
       vêm de conteudo.js — nenhuma entrada de visitante chega aqui. */
    nos = document.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < nos.length; i++) nos[i].innerHTML = t(nos[i].getAttribute('data-i18n-html'));

    nos = document.querySelectorAll('[data-i18n-alt]');
    for (i = 0; i < nos.length; i++) nos[i].setAttribute('alt', t(nos[i].getAttribute('data-i18n-alt')));

    nos = document.querySelectorAll('[data-i18n-rotulo]');
    for (i = 0; i < nos.length; i++) nos[i].setAttribute('aria-label', t(nos[i].getAttribute('data-i18n-rotulo')));

    /* Fichas de tecnologia guardadas como "um|dois|três" viram <span class="tecla">.
       Ficam no dicionário porque nem toda ficha é nome próprio: "Multiusuário"
       e "Gráficos em SVG" precisam virar "Multi-user" e "SVG charts", enquanto
       "pdf.js" e "IndexedDB" são os mesmos nos dois idiomas. */
    nos = document.querySelectorAll('[data-i18n-pilha]');
    for (i = 0; i < nos.length; i++) {
      var fichas = t(nos[i].getAttribute('data-i18n-pilha')).split('|');
      nos[i].innerHTML = '';
      for (var k = 0; k < fichas.length; k++) {
        var ficha = document.createElement('span');
        ficha.className = 'tecla';
        ficha.textContent = fichas[k];
        nos[i].appendChild(ficha);
      }
    }

    /* Listas guardadas como "um|dois|três" viram <li> */
    nos = document.querySelectorAll('[data-i18n-lista]');
    for (i = 0; i < nos.length; i++) {
      var itens = t(nos[i].getAttribute('data-i18n-lista')).split('|');
      nos[i].innerHTML = '';
      for (var j = 0; j < itens.length; j++) {
        var li = document.createElement('li');
        li.textContent = itens[j];
        nos[i].appendChild(li);
      }
    }
  }

  /* ---------- 3. Cabeça do documento ---------- */
  function definirMeta(seletor, atributo, valor) {
    var el = document.querySelector(seletor);
    if (el) el.setAttribute(atributo, valor);
  }

  function aplicarCabeca() {
    var url = BASE_URL + (idioma === 'en' ? '/en' : '/');

    document.documentElement.setAttribute('lang', idioma === 'en' ? 'en' : 'pt-BR');
    document.title = t('meta.titulo');

    definirMeta('meta[name="description"]',      'content', t('meta.descricao'));
    definirMeta('link[rel="canonical"]',         'href',    url);
    definirMeta('meta[property="og:title"]',     'content', t('meta.titulo'));
    definirMeta('meta[property="og:description"]','content', t('meta.descricao'));
    definirMeta('meta[property="og:url"]',       'content', url);
    definirMeta('meta[property="og:locale"]',    'content', idioma === 'en' ? 'en_US' : 'pt_BR');
    definirMeta('meta[name="twitter:title"]',    'content', t('meta.titulo'));
    definirMeta('meta[name="twitter:description"]','content', t('meta.descricao'));
  }

  /* ---------- 4. Seletor de idioma ---------- */
  function marcarIdioma() {
    var nos = document.querySelectorAll('[data-idioma]');
    for (var i = 0; i < nos.length; i++) {
      var ativo = nos[i].getAttribute('data-idioma') === idioma;
      if (ativo) nos[i].setAttribute('aria-current', 'true');
      else nos[i].removeAttribute('aria-current');
    }
  }

  /* ---------- 5. Contato ---------- */
  /* Canal sem endereço cadastrado some da página. Link quebrado num
     site que recrutador vai abrir é pior do que canal a menos. */
  function montarContatos() {
    var mapa = {
      email:    CONTATO.email    ? 'mailto:' + CONTATO.email : '',
      linkedin: CONTATO.linkedin,
      github:   CONTATO.github,
      whatsapp: CONTATO.whatsapp,
    };
    var nos = document.querySelectorAll('[data-canal]');
    for (var i = 0; i < nos.length; i++) {
      var nome = nos[i].getAttribute('data-canal');
      var href = mapa[nome];
      if (!href) { nos[i].remove(); continue; }
      nos[i].setAttribute('href', href);
      var valor = nos[i].querySelector('.canal-val');
      if (valor) {
        valor.textContent = (nome === 'email')
          ? CONTATO.email
          : href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      }
    }
  }

  /* ---------- 6. Tema ---------- */
  /* Cada glifo leva U+FE0E (seletor de apresentação de TEXTO) grudado,
     senão o iOS desenha o sol como emoji colorido e largo e a lua como
     texto estreito — e o bloco de controles muda de largura ao trocar de
     tema. O que de fato garante a largura, porém, é o CSS: 34px fixos no
     botão. Fica escrito em \u para o arquivo continuar legível mesmo num
     editor que não mostre caractere invisível. */
  var SOL = '\u2600\uFE0E';
  var LUA = '\u263E\uFE0E';

  function temaAtual() {
    var forcado = document.documentElement.getAttribute('data-theme');
    if (forcado === 'light' || forcado === 'dark') return forcado;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function pintarBotaoTema(botao) {
    botao.textContent = temaAtual() === 'dark' ? SOL : LUA;
  }

  function ligarTema() {
    var botao = document.getElementById('btnTema');
    if (!botao) return;
    pintarBotaoTema(botao);
    botao.addEventListener('click', function () {
      var novo = temaAtual() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      try { localStorage.setItem('bcr-tema', novo); } catch (e) { /* aba privativa */ }
      pintarBotaoTema(botao);
    });
  }

  /* ---------- 7. Revelação e barra ---------- */
  function ligarRevelacao() {
    var alvos = document.querySelectorAll('.revelar');
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < alvos.length; i++) alvos[i].classList.add('vista');
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vista'); obs.unobserve(e.target); }
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    for (var j = 0; j < alvos.length; j++) obs.observe(alvos[j]);
  }

  function ligarNav() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var aplicar = function () { nav.classList.toggle('rolou', window.scrollY > 8); };
    aplicar();
    window.addEventListener('scroll', aplicar, { passive: true });
  }

  /* ---------- 8. Partida ---------- */
  function iniciar() {
    /* O texto é reaplicado nos DOIS idiomas, inclusive no português que já
       está escrito no HTML. É redundante de propósito: garante que
       conteudo.js seja a única fonte da verdade e que o texto do HTML não
       possa divergir em silêncio. O HTML continua trazendo o português
       completo porque é ele que o visitante sem JavaScript (e o buscador,
       antes de renderizar) enxerga. */
    aplicarTextos();
    aplicarCabeca();
    marcarIdioma();
    montarContatos();
    ligarTema();
    ligarRevelacao();
    ligarNav();
    document.documentElement.classList.remove('i18n-pendente');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
