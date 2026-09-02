/* ============================================================
   LumiTEA — tema.js
   Controla o modo escuro (html[data-tema]). Carregue com `defer`
   em qualquer página — não depende de config.js nem do Supabase,
   então funciona também em index.html (landing, sem sessão).

   Como usar numa página:
     1. <script src="js/core/tema.js" defer></script>
     2. Em algum lugar da nav: <span class="lt-tema-slot"></span>
        (o switch inteiro é montado aqui dentro, não duplicado em cada
        .html; mesmo espírito do js/core/icons.js com data-lt-icon).

   Persistência: localStorage['lt-tema'] ('escuro' | 'default'),
   MESMA chave que js/core/config.js já lê bem cedo (linha "Aplica
   preferências de acessibilidade salvas") e que a paleta "Tema de
   cores" de conta.html já grava — não é um sistema novo por baixo,
   só o switch/CSS que faltavam. Ver CLAUDE.md.
   ============================================================ */
(function (g) {
  'use strict';
  g.LUMITEA = g.LUMITEA || {};

  var CHAVE = 'lt-tema';
  var ESCURO = 'escuro';
  var CLARO = 'default';

  var MARCACAO_SWITCH =
    '<input type="checkbox" aria-label="Alternar modo escuro">' +
    '<div class="slider"><div class="circle"></div></div>';

  function atual() {
    var v = document.documentElement.getAttribute('data-tema');
    return v === ESCURO ? ESCURO : CLARO;
  }

  // Aplicação "rápida" (localStorage + atributo). Usada por qualquer página
  // sem sessão (landing) e como fallback nas páginas do app/cuidador.
  function aplicarLocal(v) {
    document.documentElement.setAttribute('data-tema', v);
    try { localStorage.setItem(CHAVE, v); } catch (e) {}
    sincronizarSwitches();
  }

  function alternar() {
    var novo = atual() === ESCURO ? CLARO : ESCURO;
    // conta.html já tem um seletor de tema completo (4 opções) que também
    // grava em preferencias_usuario pra sincronizar entre aparelhos — se ele
    // existir nesta página, o switch usa o MESMO caminho em vez de um atalho
    // paralelo só local, pra não desalinhar os dois controles.
    if (typeof g.setTema === 'function') {
      g.setTema(novo);
    } else {
      aplicarLocal(novo);
    }
  }

  function sincronizarSwitches() {
    var ligado = atual() === ESCURO;
    document.querySelectorAll('.ui-switch input[type="checkbox"]').forEach(function (chk) {
      chk.checked = ligado;
    });
  }

  function montarSlots() {
    document.querySelectorAll('.lt-tema-slot').forEach(function (slot) {
      var label = document.createElement('label');
      label.className = 'ui-switch';
      label.title = 'Alternar modo escuro';
      label.innerHTML = MARCACAO_SWITCH;
      slot.replaceWith(label);
    });
  }

  function ligarSwitches() {
    montarSlots();
    sincronizarSwitches();
    document.querySelectorAll('.ui-switch input[type="checkbox"]').forEach(function (chk) {
      if (chk.dataset.ltLigado) return;
      chk.dataset.ltLigado = '1';
      chk.addEventListener('change', function () { alternar(); });
    });
  }

  g.LUMITEA.tema = {
    atual: atual,
    aplicar: aplicarLocal,
    alternar: alternar,
    sincronizarSwitches: sincronizarSwitches
  };

  // tema.js carrega com `defer`: por spec, scripts deferred rodam quando
  // document.readyState JÁ é "interactive" (não mais "loading") — ou seja,
  // ANTES do evento DOMContentLoaded, não depois. Numa checagem ingênua de
  // readyState==='loading' isso cai direto no ligarSwitches() imediato, cedo
  // demais para páginas do cuidador: a sidebar (com o .lt-tema-slot dela) só
  // é injetada dentro do PRÓPRIO listener de DOMContentLoaded do
  // cuidador-shell.js, que ainda nem rodou nesse ponto. Por isso o switch
  // ficava invisível no rodapé da sidebar (bug pego só no screenshot).
  // "complete" é o único caso em que já é seguro rodar na hora (script
  // anexado tarde demais, depois de tudo já ter assentado).
  if (document.readyState === 'complete') {
    ligarSwitches();
  } else {
    document.addEventListener('DOMContentLoaded', ligarSwitches);
  }
})(window);
