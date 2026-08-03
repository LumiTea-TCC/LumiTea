/* ============================================================
   LumiTEA — ui.js
   Substitui alert()/confirm() nativos (abruptos, sem controle de
   linguagem/contraste/foco — ruins para usuários TEA) por:
     • LumiUI.toast(msg, {type})        → aviso não-bloqueante
     • LumiUI.alert(msg, {titulo})      → Promise<void>
     • LumiUI.confirm(msg, {...})       → Promise<boolean>

   Acessível: role/aria corretos, foco gerenciado, fecha no Esc,
   respeita prefers-reduced-motion e [data-modo-calmo] (sem entrada
   animada nesses casos). Sem dependências. Estilos em enhance.css.
   ============================================================ */
(function (g) {
  'use strict';
  var LumiUI = {};

  function esc(s) {
    return (g.LUMITEA && g.LUMITEA.esc) ? g.LUMITEA.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }
  function hydrate(el) { if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(el); }

  /* ── TOAST ───────────────────────────────────────────────── */
  function toastWrap() {
    var w = document.getElementById('lt-toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'lt-toast-wrap';
      w.className = 'lt-toast-wrap';
      document.body.appendChild(w);
    }
    return w;
  }

  LumiUI.toast = function (msg, opts) {
    opts = opts || {};
    var tipo = opts.type || 'info';   // info | success | error
    var t = document.createElement('div');
    t.className = 'lt-toast lt-toast--' + tipo;
    // erros são assertivos; o resto é polido (não interrompe leitor de tela)
    t.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    t.setAttribute('aria-live', tipo === 'error' ? 'assertive' : 'polite');
    var ico = tipo === 'error' ? 'alert-circle' : tipo === 'success' ? 'check-circle' : 'info';
    t.innerHTML = '<span class="lt-toast-ic"><i class="lt-i" data-lt-icon="' + ico + '" aria-hidden="true"></i></span>' +
                  '<span class="lt-toast-msg">' + esc(msg) + '</span>';
    toastWrap().appendChild(t);
    hydrate(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    var dur = opts.duration || (tipo === 'error' ? 5200 : 3400);
    var fechar = function () {
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 240);
    };
    setTimeout(fechar, dur);
    t.addEventListener('click', fechar);
    return fechar;
  };

  /* ── DIÁLOGO (alert / confirm) ───────────────────────────── */
  function abrirDialogo(opts) {
    return new Promise(function (resolve) {
      var antesFoco = document.activeElement;
      var calmoOuReduz = document.documentElement.getAttribute('data-modo-calmo') === 'true' ||
        (g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

      var ov = document.createElement('div');
      ov.className = 'lt-dialog-ov' + (calmoOuReduz ? '' : ' lt-anim');
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      var titId = 'lt-dlg-tit-' + Date.now();
      ov.setAttribute('aria-labelledby', titId);

      var confirmar = !!opts.confirm;
      ov.innerHTML =
        '<div class="lt-dialog-box">' +
          (opts.mascote ? '<div class="lt-dialog-mascote"><img src="' + esc(opts.mascote) + '" alt=""></div>' : '') +
          '<h2 id="' + titId + '" class="lt-dialog-tit">' + esc(opts.titulo || (confirmar ? 'Confirmar' : 'Aviso')) + '</h2>' +
          '<p class="lt-dialog-msg">' + esc(opts.msg || '') + '</p>' +
          '<div class="lt-dialog-acoes">' +
            (confirmar ? '<button type="button" class="lt-dialog-btn lt-dialog-btn--ghost" data-act="cancel">' + esc(opts.cancelar || 'Cancelar') + '</button>' : '') +
            '<button type="button" class="lt-dialog-btn lt-dialog-btn--primary" data-act="ok">' + esc(opts.ok || 'OK') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      hydrate(ov);

      function fechar(valor) {
        document.removeEventListener('keydown', onKey);
        ov.classList.add('is-out');
        setTimeout(function () {
          if (ov.parentNode) ov.parentNode.removeChild(ov);
          if (antesFoco && antesFoco.focus) antesFoco.focus();
          resolve(valor);
        }, calmoOuReduz ? 0 : 180);
      }
      function onKey(e) {
        if (e.key === 'Escape') { fechar(confirmar ? false : undefined); }
        else if (e.key === 'Tab') { trapFoco(e); }
      }
      function focaveis() { return ov.querySelectorAll('button'); }
      function trapFoco(e) {
        var f = focaveis(); if (!f.length) return;
        var primeiro = f[0], ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }

      ov.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') fechar(confirmar ? true : undefined);
        else if (act === 'cancel') fechar(false);
        else if (e.target === ov && confirmar) fechar(false); // clicar fora cancela
      });
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(function () {
        ov.classList.add('is-in');
        var btn = ov.querySelector('[data-act="ok"]');
        if (btn) btn.focus();
      });
    });
  }

  LumiUI.alert = function (msg, opts) {
    opts = opts || {};
    return abrirDialogo({ msg: msg, titulo: opts.titulo, ok: opts.ok, mascote: opts.mascote, confirm: false });
  };
  LumiUI.confirm = function (msg, opts) {
    opts = opts || {};
    return abrirDialogo({ msg: msg, titulo: opts.titulo, ok: opts.ok, cancelar: opts.cancelar, mascote: opts.mascote, confirm: true });
  };

  g.LumiUI = LumiUI;
})(window);
