/* ============================================================
   LumiTEA — hero-bolhas.js
   Injeta a camada decorativa (bolhas + Theo orbitando) em qualquer
   cabeçalho .lt-hero-bolhas — mesma receita do fundo de conversa.html,
   em escala de card. Reutilizável em qualquer página interna.

   Acessibilidade / essência:
   • Camada é aria-hidden e pointer-events:none — puramente decorativa.
   • Sob [data-modo-calmo], o CSS já esconde a camada inteira
     (html[data-modo-calmo="true"] .hb-camada { display:none }).
   • Sob prefers-reduced-motion, o CSS já congela o Theo num ponto de
     descanso — aqui só injetamos o markup, o motion é todo CSS.
   ============================================================ */
(function () {
  function montarCamada() {
    var camada = document.createElement('div');
    camada.className = 'hb-camada';
    camada.setAttribute('aria-hidden', 'true');
    camada.innerHTML =
      '<span class="hb-bolha b1"></span>' +
      '<span class="hb-bolha b2"></span>' +
      '<span class="hb-bolha b3"></span>' +
      '<span class="hb-bolha b4"></span>' +
      '<img class="hb-urso" src="img/urso-estrelhinha.png" alt="">';
    return camada;
  }

  function init() {
    var heros = document.querySelectorAll('.lt-hero-bolhas');
    heros.forEach(function (hero) {
      if (hero.querySelector('.hb-camada')) return;
      hero.insertBefore(montarCamada(), hero.firstChild);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
