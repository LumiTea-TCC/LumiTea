/* ============================================================
   LumiTEA — sobrecarga.js
   FAB global "Estou sobrecarregado". Carregue em todas as
   páginas internas do adolescente. Aplica data-modo-calmo no
   <html>, banner persistente, anima off, brilho reduzido.
   ============================================================ */
(function () {
  function aplicarModoCalmo(ativo) {
    document.documentElement.setAttribute('data-modo-calmo', ativo ? 'true' : 'false');
    try { localStorage.setItem('lt_modo_calmo', ativo ? '1' : '0'); } catch (e) {}
  }

  function montar() {
    // Banner
    if (!document.getElementById('lt-calmo-banner')) {
      var banner = document.createElement('div');
      banner.id = 'lt-calmo-banner';
      banner.className = 'lt-calmo-banner';
      banner.innerHTML = 'Modo calmo ativo · respira, tá tudo bem aqui <button type="button" id="lt-sair-calmo">Sair do modo</button>';
      document.body.appendChild(banner);
      banner.querySelector('#lt-sair-calmo').addEventListener('click', function () {
        aplicarModoCalmo(false);
      });
    }

    // FAB
    if (!document.getElementById('lt-sobrecarga')) {
      var btn = document.createElement('button');
      btn.id = 'lt-sobrecarga';
      btn.className = 'lt-sobrecarga-fab';
      btn.type = 'button';
      btn.innerHTML = '<span class="lt-i" data-lt-icon="heart" aria-hidden="true"></span><span>Estou sobrecarregado</span>';
      btn.setAttribute('aria-label', 'Ativar modo calmo');
      if (window.LUMI && window.LUMI.hydrateIcons) window.LUMI.hydrateIcons(btn);
      btn.addEventListener('click', function () {
        aplicarModoCalmo(true);
        // Scroll suave pro topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      document.body.appendChild(btn);
    }

    // Restaurar estado anterior
    try {
      if (localStorage.getItem('lt_modo_calmo') === '1') aplicarModoCalmo(true);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();
