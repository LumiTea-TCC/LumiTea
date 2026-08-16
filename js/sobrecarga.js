/* ============================================================
   LumiTEA — sobrecarga.js
   FAB global "Estou sobrecarregado". Carregue em todas as
   páginas internas do adolescente. Aplica data-modo-calmo no
   <html>, banner persistente, anima off, brilho reduzido.
   ============================================================ */
(function () {
  function aplicarModoCalmo(ativo) {
    document.documentElement.setAttribute('data-modo-calmo', ativo ? 'true' : 'false');
    try {
      localStorage.setItem('lt_modo_calmo', ativo ? '1' : '0');
      localStorage.setItem('lt-modo-calmo', ativo ? '1' : '0');
    } catch (e) {}
  }

  // Chamada só nas trocas de verdade (clique do usuário), nunca ao só
  // restaurar o estado salvo num carregamento de página — senão o timestamp
  // ficaria sempre "recente" e o período de graça abaixo nunca expiraria.
  function marcarTrocaLocal() {
    try { localStorage.setItem('lt-modo-calmo-ts', String(Date.now())); } catch (e) {}
  }

  // O FAB só mexia em localStorage — nunca chegava a gravar no banco. Isso
  // fazia sincronizarModoCalmo() (config.js) reverter o modo calmo assim que
  // a página seguinte carregava e lia o valor antigo de preferencias_usuario.
  // Mesmo destino de escrita que conta.html usa (reduzAnim/anim), pra ligar
  // por aqui valer em qualquer página/aparelho, não só nesta aba.
  function persistirModoCalmo(ativo) {
    try {
      var sb = window.supabaseClient;
      if (!sb || !sb.auth) return;
      sb.auth.getSession().then(function (r) {
        var uid = r && r.data && r.data.session && r.data.session.user && r.data.session.user.id;
        if (!uid) return;
        return sb.from('preferencias_usuario')
          .upsert({ id_neurodivergente: uid, reduzAnim: ativo, anim: !ativo, updated_at: new Date().toISOString() }, { onConflict: 'id_neurodivergente' })
          .then(function (res) {
            if (res && res.error) console.warn('[Sobrecarga] Erro ao salvar modo calmo:', res.error.message);
          });
      }).catch(function () {});
    } catch (e) {}
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
        marcarTrocaLocal();
        persistirModoCalmo(false);
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
        marcarTrocaLocal();
        persistirModoCalmo(true);
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

  /* Modo calmo também é acionável de dentro da página (a home teen tem
     um "Preciso de uma pausa" no hero — o FAB é fácil de não ver). */
  window.LTCalmo = {
    ativar:   function () { aplicarModoCalmo(true); marcarTrocaLocal(); persistirModoCalmo(true); },
    desativar: function () { aplicarModoCalmo(false); marcarTrocaLocal(); persistirModoCalmo(false); },
    ativo:    function () { return document.documentElement.getAttribute('data-modo-calmo') === 'true'; }
  };
})();
