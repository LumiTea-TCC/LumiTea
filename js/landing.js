/* ============================================================
   LumiTEA — landing.js
   Única peça de comportamento da landing: o menu mobile.
   O resto da página é HTML + CSS puro (nada a hidratar).

   O reveal on scroll e o float do mascote vêm de
   js/core/reveal.js + css/enhance.css, já gated por modo calmo
   e prefers-reduced-motion — não duplicar aqui.
   ============================================================ */
(function () {
  'use strict';

  var LARGURA_DESKTOP = '(min-width: 941px)'; /* par do breakpoint do landing.css */

  function init() {
    var botao = document.getElementById('lp-burger');
    var menu  = document.getElementById('lp-menu');
    if (!botao || !menu) return;

    function fechar() {
      menu.classList.remove('is-aberto');
      botao.setAttribute('aria-expanded', 'false');
    }

    botao.addEventListener('click', function () {
      var aberto = menu.classList.toggle('is-aberto');
      botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });

    /* Escolher um item fecha o menu — a âncora rola até a seção. */
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', fechar);
    });

    /* Esc fecha e devolve o foco pro botão (não deixa o teclado perdido). */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-aberto')) {
        fechar();
        botao.focus();
      }
    });

    /* Voltar pro desktop com o menu aberto não pode deixar estado preso. */
    if (window.matchMedia) {
      var mq = window.matchMedia(LARGURA_DESKTOP);
      var aoTrocar = function (e) { if (e.matches) fechar(); };
      if (mq.addEventListener) mq.addEventListener('change', aoTrocar);
      else if (mq.addListener) mq.addListener(aoTrocar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
