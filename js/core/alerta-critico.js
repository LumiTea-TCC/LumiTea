/* ================================================================
   LumiTEA — alerta-critico.js
   ─────────────────────────────────────────────────────────────────
   Modal BLOQUEANTE para alertas críticos (`alertas.tipo === 'crise'`)
   ainda não lidos. Diferente de LumiUI.painel()/confirm(): NÃO fecha
   no Esc, clique fora, ou X — só o botão "Entendi, vou ver" fecha, e
   é ele que marca o alerta como lido no banco (hoje isso só existia
   em massa, pelo botão "Marcar todos como lidos" de alertas-cuidador.html).

   Reusa as classes visuais de js/core/ui.js (.lt-dialog-*) + um
   modificador --critico (estilos em css/enhance.css), pelos mesmos
   princípios de acessibilidade (foco preso, foco vai pro botão ao
   abrir, overflow:hidden no body enquanto aberto).

   window.LUMITEA.checarAlertaCritico(teenId) — chamado por
   cuidador-shell.js sempre que a casca fica pronta ou o adolescente
   selecionado muda. Busca o alerta 'crise' não lido mais recente
   DESSE adolescente (mesmo escopo que a faixa/badge já usam) e,
   se achar, mostra o modal.
   ================================================================ */
(function (g) {
  'use strict';

  function esc(s) { return (g.LUMITEA && g.LUMITEA.esc) ? g.LUMITEA.esc(s) : String(s == null ? '' : s); }
  function hydrate(el) { if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(el); }

  var _aberto = false; // nunca mais de um ao mesmo tempo

  function abrirModal(alerta) {
    if (_aberto) return;
    _aberto = true;

    var sb = g.supabaseClient;
    var calmoOuReduz = document.documentElement.getAttribute('data-modo-calmo') === 'true' ||
      (g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var meta = alerta.metadata || {};
    var analise = meta.analise_ia || '';
    var imagem = meta.imagem || '';

    var ov = document.createElement('div');
    ov.className = 'lt-dialog-ov lt-dialog-ov--critico' + (calmoOuReduz ? '' : ' lt-anim');
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    var titId = 'lt-ac-titulo';
    ov.setAttribute('aria-labelledby', titId);

    ov.innerHTML =
      '<div class="lt-dialog-box lt-dialog-box--critico">' +
        '<div class="lt-ac-icone"><i class="lt-i lt-i--lg" data-lt-icon="alert-triangle" aria-hidden="true"></i></div>' +
        '<h2 id="' + titId + '" class="lt-dialog-tit">' + esc(alerta.titulo || 'Alerta crítico') + '</h2>' +
        '<p class="lt-dialog-msg lt-ac-desc">' + esc(alerta.descricao || '') + '</p>' +
        (imagem ? '<img class="lt-ac-imagem" src="' + esc(imagem) + '" alt="Desenho sinalizado pelo app">' : '') +
        (analise
          ? '<div class="lt-ac-analise">' + esc(analise).replace(/\n/g, '<br>') + '</div>'
          : '<div class="lt-ac-analise lt-ac-analise--carregando">Preparando uma análise mais detalhada. Pode levar alguns instantes — o alerta já está salvo e você pode continuar.</div>') +
        '<div class="lt-dialog-acoes"><button type="button" class="lt-dialog-btn lt-dialog-btn--primary" id="lt-ac-ok">Entendi, vou ver</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    hydrate(ov);

    var overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function trapFoco(e) {
      if (e.key !== 'Tab') return;
      var f = ov.querySelectorAll('button, a[href]');
      if (!f.length) return;
      var primeiro = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
    // Sem listener de Escape de propósito: um alerta crítico não fecha sozinho.
    document.addEventListener('keydown', trapFoco);

    ov.querySelector('#lt-ac-ok').addEventListener('click', async function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Um instante...';
      try {
        if (sb) await sb.from('alertas').update({ lido: true }).eq('id', alerta.id);
      } catch (e) {
        console.warn('[AlertaCritico] falha ao marcar como lido:', e);
      }
      document.removeEventListener('keydown', trapFoco);
      document.body.style.overflow = overflowAnterior;
      ov.classList.add('is-out');
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        _aberto = false;
      }, calmoOuReduz ? 0 : 180);

      // O resto da casca (badge/faixa) pode estar contando esse mesmo alerta.
      if (g.CUI && g.CUI.atualizarBadgeAlertas) g.CUI.atualizarBadgeAlertas();
    });

    requestAnimationFrame(function () {
      ov.classList.add('is-in');
      var btn = ov.querySelector('#lt-ac-ok');
      if (btn) btn.focus();
    });
  }

  async function checarAlertaCritico(teenId) {
    if (_aberto || !teenId) return;
    var sb = g.supabaseClient;
    if (!sb) return;
    var res = await sb.from('alertas')
      .select('id, titulo, descricao, metadata, timestamp')
      .eq('id_neurodivergente', teenId)
      .eq('tipo', 'crise')
      .eq('lido', false)
      .order('timestamp', { ascending: false })
      .limit(1);
    var alerta = res.data && res.data[0];
    if (alerta) abrirModal(alerta);
  }

  g.LUMITEA = g.LUMITEA || {};
  g.LUMITEA.checarAlertaCritico = checarAlertaCritico;
})(window);
