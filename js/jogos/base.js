/* ============================================================
   LumiTEA — js/jogos/base.js
   Motor comum dos 4 jogos (memória, classificar, encaixe,
   imagem-palavra). Cuida do que se repete em todos:

     · sessão do usuário, nome na nav, sair, menu mobile;
     · som (tom suave de acerto + narração) — DESLIGADO por
       padrão e sempre silenciado no modo calmo;
     · painel de ajustes montado a partir de uma lista de campos,
       com a escolha salva no aparelho;
     · arrastar-e-soltar que funciona com mouse, dedo, clique em
       duas etapas e teclado;
     · registro da partida em sessoes_jogo.

   Carregar DEPOIS de js/core/config.js e js/core/icons.js.
   ============================================================ */
(function (g) {
  'use strict';
  var LT = g.LUMITEA || {};
  var esc = LT.esc || function (s) { return String(s == null ? '' : s); };
  var J = g.LUMIJOGOS = g.LUMIJOGOS || {};

  /* ============================================================
     ESTADO CALMO — soberano sobre motion e som
     ============================================================ */
  J.calmo = function () {
    return document.documentElement.getAttribute('data-modo-calmo') === 'true' ||
      (g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  J.modoCalmoLigado = function () {
    return document.documentElement.getAttribute('data-modo-calmo') === 'true';
  };

  /* ============================================================
     UTILIDADES
     ============================================================ */
  J.embaralhar = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  J.icone = function (nome) {
    return (g.LUMI && g.LUMI.icon) ? g.LUMI.icon(nome) : '';
  };
  /* Espera o DOM (e o icons.js, que é `defer`) antes de montar o jogo. */
  J.pronto = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };
  J.hidratar = function (el) {
    if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(el || document);
  };

  /* ============================================================
     PREFERÊNCIAS POR JOGO (ficam só neste aparelho)
     ============================================================ */
  J.prefs = function (jogoId) {
    var chave = 'lt-jogo-' + jogoId;
    var dados = {};
    try { dados = JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch (e) { dados = {}; }
    return {
      get: function (k, padrao) { return dados[k] === undefined ? padrao : dados[k]; },
      set: function (k, v) {
        dados[k] = v;
        try { localStorage.setItem(chave, JSON.stringify(dados)); } catch (e) {}
      }
    };
  };

  /* ============================================================
     SOM — tom suave de acerto + narração pela voz do navegador
     Nunca há som de erro: errar é neutro.
     ============================================================ */
  var CHAVE_SOM = 'lt-jogos-som';
  var ctxAudio = null;

  function ligadoBruto() {
    try { return localStorage.getItem(CHAVE_SOM) === '1'; } catch (e) { return false; }
  }

  var som = {
    /* O modo calmo silencia tudo, independentemente da preferência. */
    ligado: function () { return ligadoBruto() && !J.modoCalmoLigado(); },
    disponivel: function () { return !J.modoCalmoLigado(); },
    alternar: function () {
      var novo = ligadoBruto() ? '0' : '1';
      try { localStorage.setItem(CHAVE_SOM, novo); } catch (e) {}
      if (novo === '1') som.destravar();
      return som.ligado();
    },
    /* Navegadores só liberam áudio depois de um gesto do usuário. */
    destravar: function () {
      try {
        var AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) return;
        if (!ctxAudio) ctxAudio = new AC();
        if (ctxAudio.state === 'suspended') ctxAudio.resume();
      } catch (e) {}
    },
    /* Duas notas curtas e macias, em volume baixo. */
    acerto: function () {
      if (!som.ligado()) return;
      tocar([587.33, 880], 0.16);
    },
    encaixe: function () {
      if (!som.ligado()) return;
      tocar([659.25], 0.12);
    },
    fim: function () {
      if (!som.ligado()) return;
      tocar([523.25, 659.25, 783.99], 0.2);
    },
    /* Narração: voz do próprio navegador, sem rede e sem custo. */
    falar: function (texto) {
      if (!som.ligado() || !texto) return;
      try {
        if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return;
        g.speechSynthesis.cancel();
        var u = new g.SpeechSynthesisUtterance(String(texto));
        u.lang = 'pt-BR';
        u.rate = 0.92;
        u.pitch = 1;
        u.volume = 0.9;
        var vozes = g.speechSynthesis.getVoices() || [];
        for (var i = 0; i < vozes.length; i++) {
          if (/pt[-_]BR/i.test(vozes[i].lang)) { u.voice = vozes[i]; break; }
        }
        g.speechSynthesis.speak(u);
      } catch (e) {}
    },
    calar: function () {
      try { if (g.speechSynthesis) g.speechSynthesis.cancel(); } catch (e) {}
    }
  };

  function tocar(notas, dur) {
    try {
      som.destravar();
      if (!ctxAudio) return;
      var t0 = ctxAudio.currentTime;
      notas.forEach(function (hz, i) {
        var osc = ctxAudio.createOscillator();
        var gain = ctxAudio.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        var ini = t0 + i * (dur * 0.62);
        gain.gain.setValueAtTime(0.0001, ini);
        gain.gain.exponentialRampToValueAtTime(0.075, ini + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
        osc.connect(gain); gain.connect(ctxAudio.destination);
        osc.start(ini); osc.stop(ini + dur + 0.02);
      });
    } catch (e) {}
  }
  J.som = som;

  /* Botão de som da barra de controle. */
  J.ligarBotaoSom = function (btn) {
    if (!btn) return;
    function pintar() {
      var on = som.ligado();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = J.icone(on ? 'radio' : 'x');
      if (!som.disponivel()) {
        btn.disabled = true;
        btn.title = 'Som desligado pelo modo calmo';
        btn.setAttribute('aria-label', 'Som desligado pelo modo calmo');
      } else {
        btn.disabled = false;
        btn.title = on ? 'Desligar som' : 'Ligar som';
        btn.setAttribute('aria-label', on ? 'Desligar som e narração' : 'Ligar som e narração');
      }
      J.hidratar(btn);
    }
    btn.addEventListener('click', function () {
      var on = som.alternar();
      pintar();
      if (on) som.acerto(); else som.calar();
    });
    pintar();
    return pintar;   /* devolve o repintor: útil se o som mudar por outro caminho */
  };

  /* ============================================================
     PAINEL DE AJUSTES
     campos: [{ chave, titulo, dica, padrao, opcoes:[{valor,rotulo}] }]
     ============================================================ */
  J.montarAjustes = function (container, campos, prefs, aoMudar) {
    if (!container) return;
    var html = '';
    campos.forEach(function (campo) {
      var atual = prefs.get(campo.chave, campo.padrao);
      html += '<div class="jg-campo" data-campo="' + esc(campo.chave) + '">' +
        '<span class="titulo">' + esc(campo.titulo) + '</span>' +
        (campo.dica ? '<span class="dica">' + esc(campo.dica) + '</span>' : '') +
        '<div class="jg-opcoes" role="group" aria-label="' + esc(campo.titulo) + '">';
      campo.opcoes.forEach(function (op) {
        var sel = String(op.valor) === String(atual);
        html += '<button type="button" class="jg-opcao" data-valor="' + esc(op.valor) + '" ' +
          'aria-pressed="' + (sel ? 'true' : 'false') + '">' + esc(op.rotulo) + '</button>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.jg-campo').forEach(function (bloco) {
      var chave = bloco.getAttribute('data-campo');
      bloco.querySelectorAll('.jg-opcao').forEach(function (btn) {
        btn.addEventListener('click', function () {
          bloco.querySelectorAll('.jg-opcao').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          var v = btn.getAttribute('data-valor');
          prefs.set(chave, v);
          if (aoMudar) aoMudar(chave, v);
        });
      });
    });
  };

  /* Lê os valores atuais dos campos (sempre string). */
  J.valorAjuste = function (prefs, campo) {
    return prefs.get(campo.chave, campo.padrao);
  };

  /* ============================================================
     ARRASTAR E SOLTAR
     Funciona de quatro jeitos, porque motricidade fina varia:
       1. arrastar com o mouse;
       2. arrastar com o dedo;
       3. tocar na peça e depois tocar no destino;
       4. teclado (Enter/Espaço na peça, Enter/Espaço no destino).
     A área de acerto do destino é ampliada em `tolerancia` px.
     ============================================================ */
  J.arrastar = function (op) {
    var raiz = op.raiz || document;
    var selPeca = op.peca;
    var selAlvo = op.alvo;
    var tolerancia = op.tolerancia === undefined ? 28 : op.tolerancia;
    var escolhida = null;
    var fantasma = null;
    var arrastando = false;
    var origem = { x: 0, y: 0 };
    var pecaAtiva = null;
    var fimDoArraste = 0;   /* evita que o clique pós-arraste conte como 2ª etapa */

    function pecas() { return Array.prototype.slice.call(raiz.querySelectorAll(selPeca)); }
    function alvos() { return Array.prototype.slice.call(raiz.querySelectorAll(selAlvo)); }

    function selecionar(el) {
      if (escolhida === el) el = null;
      pecas().forEach(function (p) { p.classList.remove('escolhida'); });
      escolhida = el;
      if (el) el.classList.add('escolhida');
      if (op.aoSelecionar) op.aoSelecionar(el);
    }

    function limparPerto() {
      alvos().forEach(function (a) { a.classList.remove('perto'); });
    }

    /* Destino sob o ponteiro; se não houver, o mais próximo dentro da tolerância. */
    function alvoEm(x, y) {
      var direto = document.elementFromPoint(x, y);
      if (direto) {
        var fechado = direto.closest(selAlvo);
        if (fechado && raiz.contains(fechado)) return fechado;
      }
      var melhor = null, melhorD = Infinity;
      alvos().forEach(function (a) {
        var r = a.getBoundingClientRect();
        var dx = Math.max(r.left - x, 0, x - r.right);
        var dy = Math.max(r.top - y, 0, y - r.bottom);
        var d = Math.hypot(dx, dy);
        if (d <= tolerancia && d < melhorD) { melhorD = d; melhor = a; }
      });
      return melhor;
    }

    function criarFantasma(el, x, y) {
      fantasma = document.createElement('div');
      fantasma.className = 'jg-fantasma';
      fantasma.innerHTML = el.innerHTML;
      document.body.appendChild(fantasma);
      moverFantasma(x, y);
    }
    function moverFantasma(x, y) {
      if (!fantasma) return;
      var m = fantasma.offsetWidth / 2, n = fantasma.offsetHeight / 2;
      fantasma.style.left = (x - m) + 'px';
      fantasma.style.top = (y - n) + 'px';
    }
    function matarFantasma() {
      if (fantasma && fantasma.parentNode) fantasma.parentNode.removeChild(fantasma);
      fantasma = null;
    }

    function aoMover(e) {
      if (!pecaAtiva) return;
      var x = e.clientX, y = e.clientY;
      if (!arrastando) {
        if (Math.hypot(x - origem.x, y - origem.y) < 7) return;
        arrastando = true;
        pecaAtiva.classList.add('arrastando');
        criarFantasma(pecaAtiva, x, y);
      }
      moverFantasma(x, y);
      limparPerto();
      var a = alvoEm(x, y);
      if (a) a.classList.add('perto');
    }

    function aoSoltar(e) {
      document.removeEventListener('pointermove', aoMover);
      document.removeEventListener('pointerup', aoSoltar);
      document.removeEventListener('pointercancel', aoCancelar);
      if (!pecaAtiva) return;
      var peca = pecaAtiva;
      pecaAtiva = null;
      peca.classList.remove('arrastando');
      matarFantasma();
      limparPerto();

      if (!arrastando) {           // foi um toque simples → seleção em duas etapas
        selecionar(peca);
        return;
      }
      arrastando = false;
      fimDoArraste = Date.now();
      var alvo = alvoEm(e.clientX, e.clientY);
      if (alvo) {
        var ok = op.aoSoltar(peca, alvo);
        if (ok) selecionar(null);
      }
    }

    function aoCancelar() {
      document.removeEventListener('pointermove', aoMover);
      document.removeEventListener('pointerup', aoSoltar);
      document.removeEventListener('pointercancel', aoCancelar);
      if (pecaAtiva) pecaAtiva.classList.remove('arrastando');
      pecaAtiva = null; arrastando = false;
      matarFantasma(); limparPerto();
    }

    raiz.addEventListener('pointerdown', function (e) {
      var p = e.target.closest ? e.target.closest(selPeca) : null;
      if (!p || !raiz.contains(p)) return;
      e.preventDefault();
      som.destravar();
      pecaAtiva = p; arrastando = false;
      origem.x = e.clientX; origem.y = e.clientY;
      document.addEventListener('pointermove', aoMover);
      document.addEventListener('pointerup', aoSoltar);
      document.addEventListener('pointercancel', aoCancelar);
    });

    /* Clique no destino com uma peça já escolhida (etapa 2). */
    raiz.addEventListener('click', function (e) {
      if (Date.now() - fimDoArraste < 350) return;
      var a = e.target.closest ? e.target.closest(selAlvo) : null;
      if (!a || !escolhida) return;
      var ok = op.aoSoltar(escolhida, a);
      if (ok) selecionar(null);
    });

    /* Teclado. */
    raiz.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var alvo = e.target.closest ? e.target.closest(selAlvo) : null;
      var peca = e.target.closest ? e.target.closest(selPeca) : null;
      if (peca) { e.preventDefault(); selecionar(peca); return; }
      if (alvo && escolhida) {
        e.preventDefault();
        var ok = op.aoSoltar(escolhida, alvo);
        if (ok) selecionar(null);
      }
    });

    return {
      limparSelecao: function () { selecionar(null); },
      selecionada: function () { return escolhida; }
    };
  };

  /* ============================================================
     REGISTRO DA PARTIDA (sessoes_jogo) + XP/NÍVEL (neurodivergente)
     Mesma tabela e mesmos limiares de nível usados em app-teen.js
     e home-autista.html — assim o XP ganho aqui aparece lá também.
     ============================================================ */
  // Reusa o cliente global criado por js/core/config.js (mesmo padrão de
  // diario.html) — criar uma segunda instância aqui gera duas GoTrueClient
  // em paralelo e desincroniza a sessão que groqFetch() lê pra autenticar
  // no proxy da IA, derrubando toda chamada de IA nesta suíte de jogos.
  var sb = g.supabaseClient || (LT.criarSupabase ? LT.criarSupabase() : null);
  var usuario = { id: null, nome: 'amigo', xp: 0, nivel: 1 };
  var NIVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  J.usuario = usuario;
  J.supabase = sb;

  function _calcularNivel(xp) {
    var nivel = 1;
    for (var i = NIVEL_XP.length - 1; i >= 0; i--) {
      if (xp >= NIVEL_XP[i]) { nivel = i + 1; break; }
    }
    return nivel;
  }

  /* Soma XP local + no servidor. Devolve o resultado na hora (o envio ao
     banco é em segundo plano, sem travar a tela de fim de jogo). */
  J.ganharXP = function (quantidade) {
    if (!sb || !usuario.id || !quantidade) return null;
    var novoXp = (usuario.xp || 0) + quantidade;
    var novoNivel = _calcularNivel(novoXp);
    var subiuNivel = novoNivel > (usuario.nivel || 1);
    usuario.xp = novoXp;
    usuario.nivel = novoNivel;
    try {
      sb.from('neurodivergente')
        .update({ xp: novoXp, nivel: novoNivel })
        .eq('id', usuario.id)
        .then(function () {}, function () {});
    } catch (e) {}
    return { ganho: quantidade, total: novoXp, nivel: novoNivel, subiuNivel: subiuNivel };
  };

  J.salvarSessao = function (dados) {
    if (!sb || !usuario.id) return;
    try {
      sb.from('sessoes_jogo').insert({
        id_neurodivergente: usuario.id,
        jogo_id: dados.jogoId,
        duracao_segundos: dados.duracao || 0,
        pontuacao: dados.pontuacao || 0,
        acertos: dados.acertos || 0,
        total: dados.total || 0,
        terminou: !!dados.terminou,
        dados: dados.extra || {}
      }).then(function () {}, function () {});
    } catch (e) {}
  };

  /* ============================================================
     BOOT DA PÁGINA (sessão + nav + menu mobile)
     ============================================================ */
  J.boot = function (aoPronto) {
    g.sairDaConta = function () {
      if (sb) sb.auth.signOut().then(function () { location.href = 'login.html'; });
      else location.href = 'login.html';
    };

    /* menu mobile */
    var cb = document.getElementById('burger-home');
    var menu = document.getElementById('mm-home');
    if (cb && menu) {
      cb.addEventListener('change', function () { menu.style.display = cb.checked ? 'flex' : 'none'; });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { cb.checked = false; menu.style.display = 'none'; });
      });
    }

    /* a narração só fica disponível depois que as vozes carregam */
    try {
      if (g.speechSynthesis && typeof g.speechSynthesis.getVoices === 'function') g.speechSynthesis.getVoices();
    } catch (e) {}

    (async function () {
      var nomeEl = document.getElementById('nav-user-name');
      if (!sb) { if (nomeEl) nomeEl.textContent = 'amigo'; if (aoPronto) aoPronto(); return; }
      try {
        var r = await sb.auth.getSession();
        if (!r.data.session) { location.href = 'login.html'; return; }
        usuario.id = r.data.session.user.id;
        var p = await sb.from('profiles').select('nome, tipo').eq('id', usuario.id).single();
        if (p.error || !p.data) { location.href = 'login.html'; return; }
        if (p.data.tipo === 'responsavel') { location.href = 'home-cuidador.html'; return; }
        usuario.nome = p.data.nome || 'amigo';
        if (nomeEl) nomeEl.textContent = usuario.nome;
        try {
          var nd = await sb.from('neurodivergente').select('xp, nivel').eq('id', usuario.id).single();
          usuario.xp = (nd.data && nd.data.xp) || 0;
          usuario.nivel = (nd.data && nd.data.nivel) || 1;
        } catch (e) {}
      } catch (e) {
        if (nomeEl) nomeEl.textContent = 'amigo';
      }
      if (aoPronto) aoPronto();
    })();
  };
})(window);
