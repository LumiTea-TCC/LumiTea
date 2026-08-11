/* ================================================================
   LumiTEA — gamificacao.js  v1.0
   Sistema completo de gamificação:
   - Conquistas (badges)
   - Streak diário
   - Missões diárias e semanais
   - Estrelas de roleplay
   - Temas desbloqueáveis por nível
   - Toasts de celebração

   Tudo persiste em localStorage por usuário.
   ================================================================ */

var Gamificacao = (function () {

  /* ── DEFINIÇÕES ───────────────────────────────────────────── */

  var CONQUISTAS = [
    /* Conversas */
    { id: "primeira_conversa",  emoji: "💬", nome: "Primeira Conversa",  desc: "Conversou com o Lumi Theo pela primeira vez", xp: 20,  cond: function(s){return s.conversas>=1;} },
    { id: "5_conversas",        emoji: "🗣️", nome: "Conversador",        desc: "Trocou 5 mensagens com o Lumi Theo",          xp: 50,  cond: function(s){return s.conversas>=5;} },
    { id: "20_conversas",       emoji: "💭", nome: "Tagarela",            desc: "20 mensagens com o Lumi Theo",                 xp: 120, cond: function(s){return s.conversas>=20;} },
    { id: "50_conversas",       emoji: "🌐", nome: "Confidente",          desc: "50 mensagens com o Lumi Theo",                 xp: 250, cond: function(s){return s.conversas>=50;} },

    /* Roleplay */
    { id: "roleplay1",          emoji: "🎭", nome: "Ator Iniciante",      desc: "Completou 1 roleplay",                    xp: 30,  cond: function(s){return s.roleplays>=1;} },
    { id: "roleplay5",          emoji: "🎬", nome: "Em Cena",              desc: "Completou 5 roleplays",                   xp: 100, cond: function(s){return s.roleplays>=5;} },
    { id: "roleplay_estrelas",  emoji: "🌟", nome: "Brilhante",           desc: "Ganhou 5 estrelas em um roleplay",        xp: 80,  cond: function(s){return s.estrelas_max>=5;} },
    { id: "roleplay_todos",     emoji: "🏅", nome: "Versátil",            desc: "Experimentou 5 cenários diferentes",       xp: 150, cond: function(s){return (s.cenarios_unicos||[]).length>=5;} },

    /* Diário */
    { id: "diario1",            emoji: "📓", nome: "Escritor",            desc: "Escreveu no diário",                     xp: 25,  cond: function(s){return s.diario>=1;} },
    { id: "diario7",            emoji: "📚", nome: "Cronista",            desc: "Escreveu 7 entradas no diário",          xp: 90,  cond: function(s){return s.diario>=7;} },

    /* Humor */
    { id: "humor1",             emoji: "😊", nome: "Autoconsciente",      desc: "Registrou seu humor pela 1ª vez",         xp: 15,  cond: function(s){return s.humores>=1;} },
    { id: "humor7",             emoji: "🌈", nome: "Semana Colorida",     desc: "Registrou humor por 7 dias",              xp: 70,  cond: function(s){return s.humores>=7;} },

    /* Streak */
    { id: "streak3",            emoji: "🔥", nome: "Três em Linha",       desc: "3 dias seguidos no app",                  xp: 40,  cond: function(s){return s.streak_max>=3;} },
    { id: "streak7",            emoji: "🔥", nome: "Semana Inteira",      desc: "7 dias seguidos no app",                  xp: 120, cond: function(s){return s.streak_max>=7;} },
    { id: "streak30",           emoji: "🔥", nome: "Mês de Dedicação",    desc: "30 dias seguidos no app",                 xp: 500, cond: function(s){return s.streak_max>=30;} },

    /* Calendário */
    { id: "calendario",         emoji: "📅", nome: "Organizado",          desc: "Criou um evento no calendário",           xp: 20,  cond: function(s){return s.eventos>=1;} },

    /* Nível */
    { id: "nivel2",             emoji: "⭐", nome: "Nível 2",             desc: "Subiu para o nível 2",                    xp: 0,   cond: function(s){return s.nivel>=2;} },
    { id: "nivel5",             emoji: "🌟", nome: "Nível 5",             desc: "Atingiu o nível 5",                       xp: 0,   cond: function(s){return s.nivel>=5;} },
    { id: "nivel10",            emoji: "🏆", nome: "Nível 10",            desc: "Atingiu o nível 10 — Lendário!",          xp: 0,   cond: function(s){return s.nivel>=10;} },

    /* Especiais */
    { id: "noturno",            emoji: "🌙", nome: "Coruja",              desc: "Usou o app depois das 22h",               xp: 25,  cond: function(s){return s.noturno;} },
    { id: "madrugador",         emoji: "🌅", nome: "Madrugador",          desc: "Usou o app antes das 7h",                 xp: 25,  cond: function(s){return s.madrugador;} }
  ];

  /* Pool de missões diárias — sorteia 3 por dia */
  var POOL_MISSOES = [
    { id: "m_humor",     emoji: "😊", nome: "Registrar humor",            desc: "Marque como você está hoje",         xp: 15, meta: 1, evento: "humor" },
    { id: "m_conversa",  emoji: "💬", nome: "Conversar com o Lumi Theo",       desc: "Mande pelo menos 3 mensagens",       xp: 25, meta: 3, evento: "conversa" },
    { id: "m_roleplay",  emoji: "🎭", nome: "Praticar 1 roleplay",        desc: "Complete um cenário social",         xp: 30, meta: 1, evento: "roleplay" },
    { id: "m_diario",    emoji: "📓", nome: "Escrever no diário",         desc: "Compartilhe um momento do seu dia",  xp: 20, meta: 1, evento: "diario" },
    { id: "m_evento",    emoji: "📅", nome: "Adicionar evento",           desc: "Coloque algo na sua rotina",          xp: 15, meta: 1, evento: "evento" },
    { id: "m_conversa5", emoji: "💭", nome: "Conversa longa",             desc: "Troque 5 mensagens com o Lumi Theo",      xp: 40, meta: 5, evento: "conversa" }
  ];

  /* Pool de missões semanais */
  var POOL_SEMANAIS = [
    { id: "s_humor5",    emoji: "🌈", nome: "Auto-observador",            desc: "Registre humor em 5 dias diferentes", xp: 80,  meta: 5, evento: "humor_dia" },
    { id: "s_roleplay3", emoji: "🎬", nome: "Praticar 3 roleplays",       desc: "3 cenários completos esta semana",    xp: 100, meta: 3, evento: "roleplay" },
    { id: "s_streak5",   emoji: "🔥", nome: "Manter streak",              desc: "5 dias seguidos no app",              xp: 90,  meta: 5, evento: "streak" }
  ];

  /* Temas desbloqueáveis por nível */
  var TEMAS = [
    { id: "default",      nome: "Azul Padrão",       emoji: "💙", nivel: 1 },
    { id: "calmo",        nome: "Verde Tranquilo",   emoji: "💚", nivel: 2 },
    { id: "lavanda",      nome: "Lavanda",           emoji: "💜", nivel: 3 },
    { id: "rosa",         nome: "Rosa Suave",        emoji: "💗", nivel: 4 },
    { id: "ouro",         nome: "Ouro",              emoji: "💛", nivel: 5 },
    { id: "escuro",       nome: "Modo Escuro",       emoji: "🌙", nivel: 6 },
    { id: "alto",         nome: "Alto Contraste",    emoji: "⚫", nivel: 7 },
    { id: "arco_iris",    nome: "Arco-íris",         emoji: "🌈", nivel: 10 }
  ];

  /* ── ESTADO (localStorage) ────────────────────────────────── */

  var _uid = "anon";
  var _state = null;

  function setUserId(uid) {
    _uid = uid || "anon";
    _state = _carregar();
    _verificarStreak();
    _rotarMissoesSeNecessario();
    _detectarHora();
  }

  function _key() { return "lumi_gam_" + _uid; }

  function _padrao() {
    return {
      conversas: 0,
      roleplays: 0,
      cenarios_unicos: [],
      estrelas_max: 0,
      diario: 0,
      humores: 0,
      eventos: 0,
      nivel: 1,
      xp_total: 0,
      streak: 0,
      streak_max: 0,
      ultimo_dia: null,
      noturno: false,
      madrugador: false,
      conquistas: [],
      missoes_data: null,        /* YYYY-MM-DD */
      missoes_diarias: [],       /* [{id, progresso, meta, completa}] */
      missoes_semana: null,      /* início ISO da semana */
      missoes_semanais: [],
      humor_dias: []             /* dias únicos com humor */
    };
  }

  function _carregar() {
    try {
      var raw = localStorage.getItem(_key());
      if (!raw) return _padrao();
      var s = JSON.parse(raw);
      var p = _padrao();
      for (var k in p) if (s[k] === undefined) s[k] = p[k];
      return s;
    } catch(e) { return _padrao(); }
  }

  function _salvar() {
    try { localStorage.setItem(_key(), JSON.stringify(_state)); } catch(e) {}
  }

  /* ── STREAK ───────────────────────────────────────────────── */

  function _hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function _ontem() {
    var d = new Date(); d.setDate(d.getDate()-1);
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  function _verificarStreak() {
    var hoje = _hoje();
    if (_state.ultimo_dia === hoje) return;
    if (_state.ultimo_dia === _ontem()) {
      _state.streak = (_state.streak || 0) + 1;
    } else {
      _state.streak = 1;
    }
    _state.ultimo_dia = hoje;
    if (_state.streak > _state.streak_max) _state.streak_max = _state.streak;
    _salvar();
  }

  function _detectarHora() {
    var h = new Date().getHours();
    if (h >= 22 || h < 2) _state.noturno = true;
    if (h >= 4 && h < 7)  _state.madrugador = true;
    _salvar();
  }

  function obterStreak() { return _state ? _state.streak || 0 : 0; }
  function obterStreakMax() { return _state ? _state.streak_max || 0 : 0; }

  /* ── MISSÕES ──────────────────────────────────────────────── */

  function _semanaAtual() {
    var d = new Date();
    var dia = d.getDay(); /* 0=domingo */
    d.setDate(d.getDate() - dia);
    return d.getFullYear() + "-W" + Math.ceil(((d - new Date(d.getFullYear(),0,1))/86400000 + 1)/7);
  }

  function _embaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length-1; i > 0; i--) {
      var j = Math.floor(Math.random()*(i+1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function _rotarMissoesSeNecessario() {
    var hoje = _hoje();
    if (_state.missoes_data !== hoje) {
      var sorteadas = _embaralhar(POOL_MISSOES).slice(0, 3);
      _state.missoes_diarias = sorteadas.map(function(m){
        return { id: m.id, progresso: 0, meta: m.meta, completa: false, recompensada: false };
      });
      _state.missoes_data = hoje;
    }
    var sem = _semanaAtual();
    if (_state.missoes_semana !== sem) {
      _state.missoes_semanais = POOL_SEMANAIS.map(function(m){
        return { id: m.id, progresso: 0, meta: m.meta, completa: false, recompensada: false };
      });
      _state.missoes_semana = sem;
      _state.humor_dias = [];
    }
    _salvar();
  }

  function obterMissoesDiarias() {
    if (!_state) return [];
    return (_state.missoes_diarias || []).map(function(p){
      var def = POOL_MISSOES.find(function(d){return d.id===p.id;}) || {};
      return Object.assign({}, def, p);
    });
  }
  function obterMissoesSemanais() {
    if (!_state) return [];
    return (_state.missoes_semanais || []).map(function(p){
      var def = POOL_SEMANAIS.find(function(d){return d.id===p.id;}) || {};
      return Object.assign({}, def, p);
    });
  }

  function _atualizarMissoesPorEvento(eventoNome, qtd) {
    qtd = qtd || 1;
    function aplica(arr, pool) {
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        var def = pool.find(function(d){return d.id===p.id;});
        if (!def) continue;
        if (def.evento !== eventoNome) continue;
        if (p.completa) continue;
        p.progresso = Math.min(p.progresso + qtd, p.meta);
        if (p.progresso >= p.meta && !p.completa) {
          p.completa = true;
          if (!p.recompensada) {
            p.recompensada = true;
            _state.xp_total += def.xp || 0;
            mostrarToast("🎯 Missão concluída!", def.nome + " (+" + (def.xp||0) + " XP)");
          }
        }
      }
    }
    aplica(_state.missoes_diarias || [], POOL_MISSOES);
    aplica(_state.missoes_semanais || [], POOL_SEMANAIS);
  }

  /* ── CONQUISTAS ──────────────────────────────────────────── */

  function _verificarConquistas() {
    if (!_state) return;
    for (var i = 0; i < CONQUISTAS.length; i++) {
      var c = CONQUISTAS[i];
      if (_state.conquistas.indexOf(c.id) >= 0) continue;
      try {
        if (c.cond(_state)) {
          _state.conquistas.push(c.id);
          _state.xp_total += c.xp || 0;
          mostrarToast(c.emoji + " Conquista!", c.nome + (c.xp ? " (+"+c.xp+" XP)" : ""));
        }
      } catch(e) {}
    }
  }

  function obterConquistas() {
    return CONQUISTAS.map(function(c) {
      return {
        id: c.id, emoji: c.emoji, nome: c.nome, desc: c.desc, xp: c.xp,
        desbloqueada: _state ? _state.conquistas.indexOf(c.id) >= 0 : false
      };
    });
  }

  function obterEstatisticas() {
    return _state ? Object.assign({}, _state) : _padrao();
  }

  /* ── TEMAS ────────────────────────────────────────────────── */

  function obterTemas(nivelAtual) {
    var n = nivelAtual || (_state ? _state.nivel : 1) || 1;
    return TEMAS.map(function(t) {
      return Object.assign({}, t, { desbloqueado: n >= t.nivel });
    });
  }

  /* ── EVENTO PRINCIPAL ─────────────────────────────────────── */

  function registrarEvento(tipo, dados) {
    if (!_state) setUserId(_uid);
    _verificarStreak();
    _rotarMissoesSeNecessario();
    dados = dados || {};

    switch(tipo) {
      case "conversa":
        _state.conversas++;
        _atualizarMissoesPorEvento("conversa", 1);
        break;
      case "roleplay":
        _state.roleplays++;
        if (dados.cenarioId && _state.cenarios_unicos.indexOf(dados.cenarioId) < 0) {
          _state.cenarios_unicos.push(dados.cenarioId);
        }
        if (typeof dados.estrelas === "number" && dados.estrelas > _state.estrelas_max) {
          _state.estrelas_max = dados.estrelas;
        }
        _atualizarMissoesPorEvento("roleplay", 1);
        break;
      case "diario":
        _state.diario++;
        _atualizarMissoesPorEvento("diario", 1);
        break;
      case "humor":
        _state.humores++;
        var hj = _hoje();
        if (_state.humor_dias.indexOf(hj) < 0) {
          _state.humor_dias.push(hj);
          _atualizarMissoesPorEvento("humor_dia", 1);
        }
        _atualizarMissoesPorEvento("humor", 1);
        break;
      case "evento":
        _state.eventos++;
        _atualizarMissoesPorEvento("evento", 1);
        break;
      case "nivel":
        if (dados.nivel) _state.nivel = dados.nivel;
        if (dados.xp != null) _state.xp_total = dados.xp;
        break;
    }
    _verificarConquistas();
    _salvar();
  }

  /* ── TOASTS ───────────────────────────────────────────────── */

  function _injetarCSS() {
    if (document.getElementById("gam-toast-css")) return;
    var css = ""
      + "#gam-toast-stack{position:fixed;top:80px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:340px}"
      + ".gam-toast{background:linear-gradient(135deg,#fff,#fef9ee);border:2px solid #ffb84d;border-radius:16px;padding:14px 18px;box-shadow:0 8px 28px rgba(224,142,48,0.30);font-family:'Nunito',sans-serif;animation:gamSlide .4s cubic-bezier(.2,.9,.3,1.2);pointer-events:auto;display:flex;flex-direction:column;gap:3px;min-width:240px}"
      + ".gam-toast.conquista{border-color:#ffd54f;background:linear-gradient(135deg,#fffde7,#fff8d0)}"
      + ".gam-toast.missao{border-color:#7c5cbf;background:linear-gradient(135deg,#f3eeff,#ede6ff)}"
      + ".gam-toast-titulo{font-family:'Baloo 2',sans-serif;font-size:.95rem;font-weight:800;color:#7a4f1a}"
      + ".gam-toast-msg{font-size:.85rem;font-weight:600;color:#444}"
      + "@keyframes gamSlide{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}"
      + "@keyframes gamFade{to{transform:translateX(120%);opacity:0}}"
      + ".gam-toast.fade{animation:gamFade .35s forwards}"
      + "@media(max-width:560px){#gam-toast-stack{right:10px;left:10px;max-width:none}.gam-toast{min-width:0}}";
    var s = document.createElement("style");
    s.id = "gam-toast-css";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function mostrarToast(titulo, msg) {
    if (typeof document === "undefined") return;
    _injetarCSS();
    var stack = document.getElementById("gam-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "gam-toast-stack";
      document.body.appendChild(stack);
    }
    var div = document.createElement("div");
    div.className = "gam-toast " + (titulo.indexOf("Conquista") >= 0 ? "conquista" : titulo.indexOf("Missão") >= 0 ? "missao" : "");
    div.innerHTML = "<div class='gam-toast-titulo'>"+titulo+"</div><div class='gam-toast-msg'>"+msg+"</div>";
    stack.appendChild(div);
    setTimeout(function(){
      div.classList.add("fade");
      setTimeout(function(){ if (div.parentNode) div.parentNode.removeChild(div); }, 400);
    }, 4500);
  }

  /* ── API PÚBLICA ──────────────────────────────────────────── */

  return {
    setUserId: setUserId,
    registrarEvento: registrarEvento,
    obterStreak: obterStreak,
    obterStreakMax: obterStreakMax,
    obterMissoesDiarias: obterMissoesDiarias,
    obterMissoesSemanais: obterMissoesSemanais,
    obterConquistas: obterConquistas,
    obterTemas: obterTemas,
    obterEstatisticas: obterEstatisticas,
    mostrarToast: mostrarToast
  };

})();
