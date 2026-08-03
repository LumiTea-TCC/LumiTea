/* ============================================================
   LumiTEA — reveal.js
   Revela elementos .lt-reveal quando entram na viewport (entrada
   suave de baixo pra cima). Reutilizável em qualquer página interna.

   Acessibilidade / essência:
   • Sob prefers-reduced-motion ou [data-modo-calmo], o CSS já deixa
     os .lt-reveal totalmente visíveis — aqui só garantimos isso.
   • Se IntersectionObserver não existir, revela tudo na hora
     (nunca deixa conteúdo preso invisível).
   ============================================================ */
(function () {
  function revelarTudo(els) {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }

  function init() {
    var els = document.querySelectorAll('.lt-reveal');
    if (!els.length) return;

    // Respeita quem reduz movimento ou está em modo calmo: mostra na hora.
    var semMovimento = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var calmo = document.documentElement.getAttribute('data-modo-calmo') === 'true';
    if (semMovimento || calmo || !('IntersectionObserver' in window)) {
      revelarTudo(els);
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { obs.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
