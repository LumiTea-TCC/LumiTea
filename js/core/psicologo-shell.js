/* ================================================================
   LumiTEA — psicologo-shell.js
   ─────────────────────────────────────────────────────────────────
   Casca comum das páginas do painel do psicólogo (home-psicologo.html,
   paciente-psicologo.html, conta-psicologo.html).

   Cópia local adaptada da parte de "casca" de js/core/cuidador-shell.js
   (topo mobile, gaveta, sidebar, logout, helpers de humor/ícone) — não
   importa nem parametriza aquele arquivo, mesma lógica de "não arriscar
   um sistema já testado" já usada no projeto pra roleplay/diário/
   calendário (ver CLAUDE.md). As duas cascas reusam as MESMAS classes
   CSS (.cui-sidebar, .cui-nav-btn, .cui-topo-mobile, .cui-drawer,
   .cui-layout, .cui-main) — só uma classe modificadora de cor
   (.cui-sidebar--psi) diferencia visualmente o painel do psicólogo do
   painel do cuidador.

   Diferenças de modelo de dados que justificam a cópia (não é só
   estética): o psicólogo não tem UM adolescente selecionado por vez —
   o painel mostra todos os pacientes de uma vez (ver home-psicologo.html)
   — então não existe aqui nem "barra do adolescente" nem localStorage de
   seleção. A lista de pacientes vem de `vinculos_psicologo`
   (id_psicologo = auth.uid()), não de `neurodivergente.id_responsavel`
   como no cuidador — são vínculos paralelos, ver db/PSICOLOGO_SCHEMA.sql.

   Como a página usa:
     <body class="app-body lt-pro cui-page" data-psi-pagina="pacientes">
     <div class="cui-layout"><div class="cui-main"> ...conteúdo... </div></div>
     <script>
       PSI.aoTrocarLista(function (pacientes) { ...renderiza... });
     </script>
   ================================================================ */
(function (g) {
  'use strict';

  var PSI = g.PSI = g.PSI || {};

  var SUPABASE_URL = (g.LUMITEA && g.LUMITEA.SUPABASE_URL) || 'https://yuwdckenzpfdlyawkibn.supabase.co';
  var SUPABASE_ANON_KEY = (g.LUMITEA && g.LUMITEA.SUPABASE_ANON_KEY) || 'sb_publishable_JtP1wsTu2QQ1xFjlrDBu9g_ZKYkW59N';

  /* ── MENU: fonte única da navegação do psicólogo ──────────────── */
  var MENU = [
    { id: 'pacientes', label: 'Pacientes',      icone: 'users',    href: 'home-psicologo.html' },
    { id: 'conta',     label: 'Configurações',  icone: 'settings', href: 'conta-psicologo.html' }
  ];

  /* ── HELPERS BÁSICOS (mesma forma dos de cuidador-shell.js) ────── */
  function esc(s) {
    if (g.LUMITEA && g.LUMITEA.esc) return g.LUMITEA.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ic(nome, cls) {
    return (g.LUMI && g.LUMI.icon) ? g.LUMI.icon(nome, cls) : '';
  }
  PSI.esc = esc;
  PSI.ic = ic;

  /* UM único cliente Supabase por página — mesmo motivo documentado em
     cuidador-shell.js: dois GoTrueClient disputando a mesma chave de
     sessão travam getSession()/signOut(). */
  PSI.sb = g.supabaseClient ||
    (g.supabase && g.supabase.createClient
      ? g.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null);
  g.supabaseClient = PSI.sb;

  PSI.uid = null;
  PSI.perfil = null;
  PSI.pacientes = [];
  PSI.pronto = false;

  /* ── SAIR DA CONTA ────────────────────────────────────────────── */
  function limparSessaoLocal() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('sb-') === 0 && k.indexOf('auth-token') > -1) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  g.sairPsi = function sairPsi() {
    document.querySelectorAll('.btn-logout, .cui-sair').forEach(function (b) { b.disabled = true; });
    document.querySelectorAll('.btn-danger-ghost').forEach(function (b) {
      if (b.textContent.indexOf('Sair') > -1) b.disabled = true;
    });

    var jaSaiu = false;
    function irParaLogin() {
      if (jaSaiu) return;
      jaSaiu = true;
      limparSessaoLocal();
      g.location.replace('login.html');
    }

    setTimeout(irParaLogin, 1500);

    var cli = PSI.sb;
    try {
      if (cli && cli.auth) { Promise.resolve(cli.auth.signOut()).then(irParaLogin, irParaLogin); }
      else { irParaLogin(); }
    } catch (e) { irParaLogin(); }
  };

  /* ── HELPERS DE HUMOR (cópia dos de cuidador-shell.js) ─────────── */
  var HUMOR_TXT = ['Irritado', 'Ansioso', 'Triste', 'Neutro', 'Bem', 'Ótimo'];
  var HUMOR_COR = ['#c62828', '#e08e30', '#fbbf24', '#9e9e9e', '#42a5f5', '#2e7d32'];

  PSI.humorTexto = function (n) { return HUMOR_TXT[n] || '—'; };

  PSI.humorChip = function (n) {
    if (n === null || n === undefined || !HUMOR_TXT[n]) return '—';
    return '<span class="lt-humor-chip" style="--chip:' + HUMOR_COR[n] + '">' + HUMOR_TXT[n] + '</span>';
  };

  PSI.renderHumorBars = function (humores, containerId) {
    var box = document.getElementById(containerId);
    if (!box) return;
    var dias = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var ds = d.toISOString().slice(0, 10);
      var enc = (humores || []).filter(function (h) { return (h.timestamp || '').slice(0, 10) === ds; });
      var med = enc.length ? Math.round(enc.reduce(function (a, h) { return a + h.nivel; }, 0) / enc.length) : 0;
      dias.push({ label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3), valor: med });
    }
    box.innerHTML = dias.map(function (d) {
      var h = d.valor ? (d.valor / 5 * 100) + '%' : '4%';
      return '<div class="humor-bar-wrap"><div class="humor-bar h' + d.valor + '" style="height:' + h + '" title="' + PSI.humorTexto(d.valor) + '"></div><div class="humor-label">' + d.label + '</div></div>';
    }).join('');
  };

  PSI.alertaIcone = function (tipo) {
    if (tipo === 'crise') return ic('alert-triangle');
    if (tipo === 'aviso') return ic('alert-circle');
    return ic('info');
  };

  PSI.vazio = function (icone, msg) {
    return '<div class="empty-state">' + ic(icone) + '<p>' + esc(msg) + '</p></div>';
  };

  /* Idade a partir de neurodivergente.nascimento (DATE) — cópia exata
     de CUI.idade em cuidador-shell.js. */
  PSI.idade = function (nascimento) {
    if (!nascimento) return null;
    var p = String(nascimento).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var hoje = new Date();
    var anos = hoje.getFullYear() - Number(p[0]);
    var mes = hoje.getMonth() + 1 - Number(p[1]);
    if (mes < 0 || (mes === 0 && hoje.getDate() < Number(p[2]))) anos--;
    return (anos >= 0 && anos < 130) ? anos : null;
  };

  var _nomePendente = null;
  PSI.definirNome = function (nome) {
    _nomePendente = nome || 'Psicólogo(a)';
    var area = document.getElementById('cui-nome-area');
    if (area) area.innerHTML = ic('user') + ' <strong class="cui-nome-forte">' + esc(_nomePendente) + '</strong>';
  };

  /* ── CASCA (topo mobile, sidebar) ─────────────────────────────── */
  function montarCasca() {
    var layout = document.querySelector('.cui-layout');
    if (!layout || !document.body) return;

    var paginaAtual = document.body.getAttribute('data-psi-pagina') || '';
    var pai = layout.parentNode;

    var topo = document.createElement('div');
    topo.className = 'cui-mobile-topbar';
    topo.innerHTML =
      '<a class="cui-mobile-topbar-logo" href="home-psicologo.html">' +
        '<img src="img/icon-urso.png" alt="">' +
        '<span>LumiTEA</span>' +
      '</a>' +
      '<label class="app-burger" for="burger-psicologo">' +
        '<input type="checkbox" id="burger-psicologo">' +
        '<span></span><span></span><span></span>' +
      '</label>';
    pai.insertBefore(topo, layout);

    var overlay = document.createElement('div');
    overlay.className = 'cui-sidebar-overlay';
    overlay.id = 'cui-sidebar-overlay';
    layout.appendChild(overlay);

    var aside = document.createElement('aside');
    aside.className = 'cui-sidebar cui-sidebar--psi';
    aside.id = 'cui-sidebar';

    var html =
      '<div class="cui-logo">' +
        '<div class="cui-logo-img"><img src="img/urso67.png" alt="LumiTEA"></div>' +
        '<div>' +
          '<div class="cui-logo-text">LumiTEA</div>' +
          '<div class="cui-logo-sub">Painel do Psicólogo</div>' +
        '</div>' +
      '</div>' +
      '<div class="cui-status-badge">' +
        '<div class="cui-status-dot"></div>' +
        '<span class="cui-status-txt">Monitoramento ativo</span>' +
      '</div>' +
      '<nav class="cui-nav" aria-label="Menu do painel do psicólogo">';

    MENU.forEach(function (item) {
      var ativo = (item.id === paginaAtual);
      html += '<button type="button" class="cui-nav-btn' + (ativo ? ' ativo' : '') + '"' +
              ' data-cui-ir="' + item.href + '"' + (ativo ? ' aria-current="page"' : '') + '>' +
              '<span class="cui-nav-icon" data-lt-icon="' + item.icone + '"></span> ' + item.label +
              '</button>';
    });

    html +=
      '</nav>' +
      '<div class="cui-sidebar-footer">' +
        '<div id="cui-nome-area" class="cui-nome-area">Carregando...</div>' +
        '<div class="cui-tema-linha">' +
          '<span class="cui-tema-label">Modo escuro</span>' +
          '<span class="lt-tema-slot"></span>' +
        '</div>' +
        '<button type="button" class="cui-sair" id="cui-btn-sair"><span class="cui-nav-icon" data-lt-icon="log-out"></span> Sair da conta</button>' +
      '</div>';

    aside.innerHTML = html;
    layout.insertBefore(aside, layout.firstChild);

    aside.querySelectorAll('[data-cui-ir]').forEach(function (btn) {
      btn.addEventListener('click', function () { g.location.href = btn.getAttribute('data-cui-ir'); });
    });
    aside.querySelector('#cui-btn-sair').addEventListener('click', function () { g.sairPsi(); });

    if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(document.body);
    if (_nomePendente) PSI.definirNome(_nomePendente);

    ligarGaveta();
  }

  function ligarGaveta() {
    var cb = document.getElementById('burger-psicologo');
    var sidebar = document.getElementById('cui-sidebar');
    var overlay = document.getElementById('cui-sidebar-overlay');
    if (!cb || !sidebar || !overlay) return;
    function fechar() { cb.checked = false; sidebar.classList.remove('cui-aberta'); overlay.classList.remove('cui-aberta'); }
    function abrir() { sidebar.classList.add('cui-aberta'); overlay.classList.add('cui-aberta'); }
    cb.addEventListener('change', function () { if (cb.checked) abrir(); else fechar(); });
    overlay.addEventListener('click', fechar);
    sidebar.querySelectorAll('a, button').forEach(function (el) { el.addEventListener('click', fechar); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
  }

  /* ── LISTA DE PACIENTES ───────────────────────────────────────── */
  var _ouvintes = [];

  PSI.aoTrocarLista = function (fn) {
    if (typeof fn !== 'function') return;
    _ouvintes.push(fn);
    if (PSI.pronto) { try { fn(PSI.pacientes); } catch (e) { console.error('[psicologo-shell]', e); } }
  };

  function avisarOuvintes() {
    _ouvintes.forEach(function (fn) {
      try { fn(PSI.pacientes); } catch (e) { console.error('[psicologo-shell]', e); }
    });
  }

  PSI.paciente = function (id) {
    return PSI.pacientes.filter(function (p) { return p.id === id; })[0] || null;
  };

  /* Carrega em lote (1 query em vinculos_psicologo + 1 .in() em profiles
     + 1 .in() em neurodivergente), ao contrário do N+1 de carregarTeens()
     em cuidador-shell.js — aqui não há motivo pra repetir esse padrão. */
  async function carregarPacientes() {
    var sb = PSI.sb;
    PSI.pacientes = [];
    if (!sb || !PSI.uid) return;

    var vres = await sb.from('vinculos_psicologo').select('id_neurodivergente').eq('id_psicologo', PSI.uid);
    if (vres.error) {
      console.error('[psicologo-shell] não foi possível carregar vínculos:',
        vres.error.code, '|', vres.error.message, '|', vres.error.details, '|', vres.error.hint);
      return;
    }
    var ids = (vres.data || []).map(function (v) { return v.id_neurodivergente; });
    if (!ids.length) return;

    var pres = await sb.from('profiles').select('id, nome, sobrenome').in('id', ids);
    var nres = await sb.from('neurodivergente').select('id, xp, nivel, nascimento, apelido').in('id', ids);
    if (pres.error) console.error('[psicologo-shell] profiles:', pres.error.message);
    if (nres.error) console.error('[psicologo-shell] neurodivergente:', nres.error.message);

    var perfis = {};
    (pres.data || []).forEach(function (p) { perfis[p.id] = p; });
    var nds = {};
    (nres.data || []).forEach(function (n) { nds[n.id] = n; });

    PSI.pacientes = ids.map(function (id) {
      var p = perfis[id] || {};
      var n = nds[id] || {};
      return {
        id: id,
        nome: p.nome || 'Sem nome',
        sobrenome: p.sobrenome || '',
        apelido: n.apelido || '',
        xp: n.xp || 0,
        nivel: n.nivel || 1,
        nascimento: n.nascimento || null,
        idade: PSI.idade(n.nascimento)
      };
    });
  }

  PSI.recarregarPacientes = async function () {
    await carregarPacientes();
    avisarOuvintes();
  };

  /* ── BOOT ─────────────────────────────────────────────────────── */
  async function boot() {
    var sb = PSI.sb;
    if (!sb) {
      var area = document.getElementById('cui-nome-area');
      if (area) area.textContent = 'Sem conexão';
      return;
    }

    var s = await sb.auth.getSession();
    var session = s && s.data && s.data.session;
    if (!session) { g.location.href = 'login.html'; return; }
    PSI.uid = session.user.id;

    var p = await sb.from('profiles').select('nome, sobrenome, tipo, crp, verificado').eq('id', PSI.uid).single();
    if (p.error || !p.data) { g.location.href = 'login.html'; return; }
    if (p.data.tipo !== 'psicologo') {
      g.location.href = (p.data.tipo === 'neurodivergente') ? 'home-autista.html' : 'home-cuidador.html';
      return;
    }
    PSI.perfil = p.data;

    PSI.definirNome(p.data.nome);

    await carregarPacientes();

    PSI.pronto = true;
    avisarOuvintes();
  }

  function iniciar() {
    montarCasca();
    if (document.body && document.body.getAttribute('data-psi-shell') === 'nav') return;
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
