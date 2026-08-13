/* ================================================================
   LumiTEA — cuidador-shell.js
   ─────────────────────────────────────────────────────────────────
   Casca comum de TODAS as páginas do painel do cuidador.

   Antes, cada área do painel (Ao vivo, Humor, Relatórios, Observações,
   Progresso, Estatísticas, Alertas, Consultoria) era uma <div class="cui-tela">
   escondida dentro de home-cuidador.html, trocada por irTela(). Um único erro
   de JS no arquivo gigante derrubava TODAS as abas de uma vez, e era isso que
   fazia as telas "não abrirem". Agora cada área é uma página .html de verdade;
   este arquivo é o pedaço que todas compartilham.

   O que ele faz:
     • injeta topo mobile, gaveta, faixa de alerta urgente e a sidebar
       (menu em UM lugar só — mudar o menu aqui muda em todas as páginas);
     • define window.sairCui();
     • confere sessão + tipo de conta (responsavel/terapeuta);
     • carrega os adolescentes vinculados e monta o seletor, LEMBRANDO a escolha
       entre páginas (localStorage 'lt-cui-teen');
     • guarda os helpers de humor/XP/ícone que várias páginas usam.

   Como a página usa:
     <body class="app-body lt-pro cui-page" data-cui-pagina="humor" data-cui-teen="1">
     <div class="cui-layout"><div class="cui-main"> ...conteúdo... </div></div>
     <script>
       CUI.aoTrocarTeen(function (teenId) { ...carrega os dados... });
     </script>

   Atributos lidos do <body>:
     data-cui-pagina="<id>"  → qual item do menu fica marcado como ativo
     data-cui-teen="1"       → injeta a barra "Adolescente: [seletor]"
     data-cui-shell="nav"    → só monta a casca; a página cuida da própria
                               sessão (usado nas páginas que já tinham lógica
                               própria: comunidade, calendário, conta, vínculos)
   ================================================================ */
(function (g) {
  'use strict';

  var CUI = g.CUI = g.CUI || {};
  var CHAVE_TEEN = 'lt-cui-teen';

  var SUPABASE_URL = (g.LUMITEA && g.LUMITEA.SUPABASE_URL) || 'https://yuwdckenzpfdlyawkibn.supabase.co';
  var SUPABASE_ANON_KEY = (g.LUMITEA && g.LUMITEA.SUPABASE_ANON_KEY) || 'sb_publishable_JtP1wsTu2QQ1xFjlrDBu9g_ZKYkW59N';

  /* ── MENU: fonte única da navegação do cuidador ───────────────── */
  var MENU = [
    { secao: 'Principal' },
    { id: 'painel',       label: 'Painel geral',           icone: 'home',           href: 'home-cuidador.html' },
    { id: 'comunidade',   label: 'Comunidade',             icone: 'users',          href: 'comunidade-cuidador.html' },
    { id: 'alertas',      label: 'Alertas',                icone: 'bell',           href: 'alertas-cuidador.html', contador: true },
    { id: 'live',         label: 'Ao vivo',                icone: 'radio',          href: 'live-cuidador.html' },
    { secao: 'Acompanhamento' },
    { id: 'humor',        label: 'Histórico de humor',     icone: 'heart',          href: 'humor-cuidador.html' },
    { id: 'calendario',   label: 'Calendário',             icone: 'calendar',       href: 'calendario-cuidador.html' },
    { id: 'relatorios',   label: 'Relatórios',             icone: 'file-text',      href: 'relatorios-cuidador.html' },
    { id: 'observacoes',  label: 'Observações',            icone: 'edit',           href: 'observacoes-cuidador.html' },
    { id: 'progresso',    label: 'Progresso',              icone: 'star',           href: 'progresso-cuidador.html' },
    { id: 'estatisticas', label: 'Estatísticas',           icone: 'bar-chart',      href: 'estatisticas-cuidador.html' },
    { secao: 'Conta' },
    { id: 'vinculos',     label: 'Vínculos',               icone: 'link',           href: 'vinculos-cuidador.html' },
    { id: 'consultoria',  label: 'Consultoria com o Lumi Theo', icone: 'message-circle', href: 'consultoria-cuidador.html' },
    { id: 'conta',        label: 'Configurações',          icone: 'settings',       href: 'conta-cuidador.html' }
  ];

  /* ── HELPERS BÁSICOS ──────────────────────────────────────────── */

  /* Escape de HTML. Usa o do config.js quando existe; a cópia local é só
     rede de segurança pra nunca injetar dado cru se o config falhar. */
  function esc(s) {
    if (g.LUMITEA && g.LUMITEA.esc) return g.LUMITEA.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Ícone seguro mesmo se icons.js ainda não tiver carregado. */
  function ic(nome, cls) {
    return (g.LUMI && g.LUMI.icon) ? g.LUMI.icon(nome, cls) : '';
  }

  CUI.esc = esc;
  CUI.ic = ic;

  /* UM único cliente Supabase por página: dois GoTrueClient disputando a mesma
     chave de sessão travam getSession()/signOut() (bug já visto em 2026). */
  CUI.sb = g.supabaseClient ||
    (g.supabase && g.supabase.createClient
      ? g.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null);
  g.supabaseClient = CUI.sb;

  CUI.uid = null;
  CUI.perfil = null;
  CUI.teens = [];
  CUI.teenId = null;
  CUI.pronto = false;

  CUI.NIVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];

  /* ── SAIR DA CONTA ────────────────────────────────────────────── */

  /* Apaga a sessão guardada no navegador (chave sb-<projeto>-auth-token),
     pra o logout valer mesmo se o signOut() do servidor falhar. */
  function limparSessaoLocal() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('sb-') === 0 && k.indexOf('auth-token') > -1) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  g.sairCui = function sairCui() {
    document.querySelectorAll('.btn-logout, .cui-sair').forEach(function (b) { b.disabled = true; });
    // conta-cuidador.html tem um segundo botão de sair no corpo da página.
    document.querySelectorAll('.btn-danger-ghost').forEach(function (b) {
      if (b.textContent.indexOf('Sair') > -1) b.disabled = true;
    });

    var jaSaiu = false;
    function irParaLogin() {
      if (jaSaiu) return;
      jaSaiu = true;
      limparSessaoLocal();
      try { localStorage.removeItem(CHAVE_TEEN); } catch (e) {}
      g.location.replace('login.html');
    }

    // Rede fora do ar ou sessão expirada podem deixar o signOut() pendurado.
    // A saída não pode depender dele: o timer é armado ANTES de qualquer chamada.
    setTimeout(irParaLogin, 1500);

    var cli = CUI.sb;
    try {
      if (cli && cli.auth) { Promise.resolve(cli.auth.signOut()).then(irParaLogin, irParaLogin); }
      else { irParaLogin(); }
    } catch (e) { irParaLogin(); }
  };

  /* ── HELPERS DE HUMOR (área do cuidador: rótulo + cor, sem emoji) ── */
  var HUMOR_TXT = ['Irritado', 'Ansioso', 'Triste', 'Neutro', 'Bem', 'Ótimo'];
  var HUMOR_COR = ['#c62828', '#e08e30', '#fbbf24', '#9e9e9e', '#42a5f5', '#2e7d32'];

  CUI.humorTexto = function (n) { return HUMOR_TXT[n] || '—'; };

  CUI.humorChip = function (n) {
    if (n === null || n === undefined || !HUMOR_TXT[n]) return '—';
    return '<span class="lt-humor-chip" style="--chip:' + HUMOR_COR[n] + '">' + HUMOR_TXT[n] + '</span>';
  };

  CUI.calcMediaHumor = function (humores, dias) {
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - dias);
    var recentes = (humores || []).filter(function (h) { return h.timestamp && new Date(h.timestamp) >= cutoff; });
    if (!recentes.length) return null;
    return recentes.reduce(function (a, h) { return a + h.nivel; }, 0) / recentes.length;
  };

  CUI.renderHumorBars = function (humores, containerId) {
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
      return '<div class="humor-bar-wrap"><div class="humor-bar h' + d.valor + '" style="height:' + h + '" title="' + CUI.humorTexto(d.valor) + '"></div><div class="humor-label">' + d.label + '</div></div>';
    }).join('');
  };

  CUI.alertaIcone = function (tipo) {
    if (tipo === 'crise') return ic('alert-triangle');
    if (tipo === 'aviso') return ic('alert-circle');
    return ic('info');
  };

  CUI.cuiStat = function (icone, label, val) {
    return '<div class="cui-stat"><div class="cui-stat-icon">' + ic(icone) + '</div><div class="cui-stat-val">' + val + '</div><div class="cui-stat-label">' + label + '</div></div>';
  };

  /* Estado vazio padrão (mesma marcação usada nas telas antigas). */
  CUI.vazio = function (icone, msg) {
    return '<div class="empty-state">' + ic(icone) + '<p>' + esc(msg) + '</p></div>';
  };

  /* Nome no rodapé da sidebar. Existe como função (e não como um
     getElementById solto na página) porque a sidebar só é montada no
     DOMContentLoaded: as páginas em modo "nav" resolvem a sessão delas em
     paralelo e podiam chegar aqui antes do elemento existir. Se ainda não
     existe, o nome fica guardado e é aplicado assim que a casca monta. */
  /* Texto ao lado do pontinho verde da barra do adolescente. Padrão
     "Monitorando"; o painel geral troca por "Atualizado há X min". */
  CUI.definirStatus = function (texto) {
    var el = document.getElementById('cui-teen-status');
    if (el) el.textContent = texto;
  };

  /* Idade a partir de neurodivergente.nascimento (DATE). Devolve null quando
     não há data cadastrada — nesse caso o seletor mostra só o nome. */
  CUI.idade = function (nascimento) {
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
  CUI.definirNome = function (nome) {
    _nomePendente = nome || 'Cuidador';
    var area = document.getElementById('cui-nome-area');
    if (area) area.innerHTML = ic('user') + ' <strong class="cui-nome-forte">' + esc(_nomePendente) + '</strong>';
  };

  /* ── CASCA (topo mobile, faixa de alerta, sidebar, barra do teen) ── */
  function montarCasca() {
    var layout = document.querySelector('.cui-layout');
    if (!layout || !document.body) return;

    var paginaAtual = document.body.getAttribute('data-cui-pagina') || '';
    var pai = layout.parentNode;

    /* TOPO MOBILE: único jeito de abrir o menu em telas pequenas.
       No desktop o menu é só a sidebar. */
    var topo = document.createElement('div');
    topo.className = 'cui-mobile-topbar';
    topo.innerHTML =
      '<a class="cui-mobile-topbar-logo" href="home-cuidador.html">' +
        '<img src="img/icon-urso.png" alt="">' +
        '<span>LumiTEA</span>' +
      '</a>' +
      '<label class="app-burger" for="burger-cuidador">' +
        '<input type="checkbox" id="burger-cuidador">' +
        '<span></span><span></span><span></span>' +
      '</label>';
    pai.insertBefore(topo, layout);

    var overlay = document.createElement('div');
    overlay.className = 'cui-sidebar-overlay';
    overlay.id = 'cui-sidebar-overlay';
    pai.insertBefore(overlay, layout);

    /* FAIXA DE ALERTA URGENTE (aparece só quando há alerta de crise) */
    var strip = document.createElement('div');
    strip.className = 'cui-alerta-strip';
    strip.id = 'cui-alerta-strip';
    strip.setAttribute('role', 'alert');
    strip.innerHTML =
      '<i class="lt-i" data-lt-icon="alert-triangle" aria-hidden="true"></i>' +
      '<div class="cui-alerta-strip-msg" id="cui-alerta-strip-msg">Atenção necessária.</div>' +
      '<button type="button" class="cui-alerta-strip-btn" id="cui-alerta-strip-ir">Ver alertas</button>' +
      '<button type="button" class="cui-alerta-strip-x" id="cui-alerta-strip-x" aria-label="Fechar alerta"><i class="lt-i" data-lt-icon="x" aria-hidden="true"></i></button>';
    pai.insertBefore(strip, layout);

    strip.querySelector('#cui-alerta-strip-ir').addEventListener('click', function () {
      g.location.href = 'alertas-cuidador.html';
    });
    strip.querySelector('#cui-alerta-strip-x').addEventListener('click', function () {
      strip.classList.remove('show');
    });

    /* SIDEBAR */
    var aside = document.createElement('aside');
    aside.className = 'cui-sidebar';
    aside.id = 'cui-sidebar';

    var html =
      '<div class="cui-logo">' +
        '<div class="cui-logo-img"><img src="img/urso67.png" alt="LumiTEA"></div>' +
        '<div>' +
          '<div class="cui-logo-text">LumiTEA</div>' +
          '<div class="cui-logo-sub">Painel do Cuidador</div>' +
        '</div>' +
      '</div>' +
      '<div class="cui-status-badge">' +
        '<div class="cui-status-dot"></div>' +
        '<span class="cui-status-txt">Monitoramento ativo</span>' +
      '</div>' +
      '<nav class="cui-nav" aria-label="Menu do painel do cuidador">';

    MENU.forEach(function (item) {
      if (item.secao) { html += '<div class="cui-nav-section">' + item.secao + '</div>'; return; }
      var ativo = (item.id === paginaAtual);
      html += '<button type="button" class="cui-nav-btn' + (ativo ? ' ativo' : '') + '"' +
              ' data-cui-ir="' + item.href + '"' + (ativo ? ' aria-current="page"' : '') + '>' +
              '<span class="cui-nav-icon" data-lt-icon="' + item.icone + '"></span> ' + item.label +
              (item.contador ? '<span class="cui-nav-cnt" id="nav-alerta-cnt" hidden></span>' : '') +
              '</button>';
    });

    html +=
      '</nav>' +
      '<div class="cui-sidebar-footer">' +
        '<div id="cui-nome-area" class="cui-nome-area">Carregando...</div>' +
        '<button type="button" class="cui-sair" id="cui-btn-sair"><span class="cui-nav-icon" data-lt-icon="log-out"></span> Sair da conta</button>' +
      '</div>';

    aside.innerHTML = html;
    layout.insertBefore(aside, layout.firstChild);

    aside.querySelectorAll('[data-cui-ir]').forEach(function (btn) {
      btn.addEventListener('click', function () { g.location.href = btn.getAttribute('data-cui-ir'); });
    });
    aside.querySelector('#cui-btn-sair').addEventListener('click', function () { g.sairCui(); });

    /* BARRA DO ADOLESCENTE (só nas páginas que trabalham sobre um teen) */
    if (document.body.hasAttribute('data-cui-teen')) {
      var main = layout.querySelector('.cui-main');
      if (main) {
        /* O chip de humor fica no grupo da ESQUERDA (colado no seletor): ele
           descreve o adolescente escolhido, não o estado da página. Ficava
           dentro de .cui-teen-bar-fim, e no painel geral disputava espaço com
           os controles de período/exportar que a página injeta ali. */
        var bar = document.createElement('div');
        bar.className = 'cui-teen-bar';
        bar.innerHTML =
          '<label for="teen-sel">Adolescente:</label>' +
          '<select id="teen-sel" class="cui-teen-sel"><option value="">Carregando...</option></select>' +
          '<div id="teen-humor-current" class="cui-teen-humor" hidden></div>' +
          '<div id="teen-link-area" class="cui-teen-aviso"></div>' +
          '<div class="cui-teen-bar-fim">' +
            '<div class="cui-teen-monitor"><div class="cui-status-dot cui-status-dot--mini"></div> <span id="cui-teen-status">Monitorando</span></div>' +
          '</div>';
        main.insertBefore(bar, main.firstChild);

        bar.querySelector('#teen-sel').addEventListener('change', function (e) {
          CUI.selecionarTeen(e.target.value || null);
        });
      }
    }

    /* Ícones: os scripts com defer já rodaram o hydrate inicial antes deste
       conteúdo existir, então hidratamos a casca recém-criada à mão. */
    if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(document.body);

    // Se a página já resolveu o nome antes da casca montar, aplica agora.
    if (_nomePendente) CUI.definirNome(_nomePendente);

    ligarGaveta();
  }

  /* Gaveta da sidebar no mobile: abre/fecha com o hambúrguer do topo,
     fecha ao escolher um item, clicar fora ou apertar Esc. */
  function ligarGaveta() {
    var cb = document.getElementById('burger-cuidador');
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

  /* ── SELEÇÃO DE ADOLESCENTE ───────────────────────────────────── */
  var _ouvintes = [];

  /* A página registra o que fazer quando o adolescente muda (ou quando a
     casca termina de carregar). Se já estiver pronta, roda na hora. */
  CUI.aoTrocarTeen = function (fn) {
    if (typeof fn !== 'function') return;
    _ouvintes.push(fn);
    if (CUI.pronto) { try { fn(CUI.teenId); } catch (e) { console.error('[cuidador-shell]', e); } }
  };

  function avisarOuvintes() {
    _ouvintes.forEach(function (fn) {
      try { fn(CUI.teenId); } catch (e) { console.error('[cuidador-shell]', e); }
    });
  }

  CUI.teen = function () {
    var id = CUI.teenId;
    return CUI.teens.filter(function (t) { return t.id === id; })[0] || null;
  };

  CUI.selecionarTeen = function (id) {
    CUI.teenId = id || null;
    try {
      if (CUI.teenId) localStorage.setItem(CHAVE_TEEN, CUI.teenId);
      else localStorage.removeItem(CHAVE_TEEN);
    } catch (e) {}
    avisarOuvintes();
    atualizarBadgeAlertas();
  };

  function preencherSeletor() {
    var sel = document.getElementById('teen-sel');
    var aviso = document.getElementById('teen-link-area');

    if (sel) {
      sel.innerHTML = '';
      if (!CUI.teens.length) {
        sel.innerHTML = '<option value="">Nenhum adolescente vinculado</option>';
        sel.disabled = true;
      } else {
        sel.disabled = false;
        var opt0 = document.createElement('option');
        opt0.value = ''; opt0.textContent = 'Selecione...';
        sel.appendChild(opt0);
        CUI.teens.forEach(function (t) {
          var o = document.createElement('option');
          o.value = t.id;
          o.textContent = t.nome + (t.idade === null ? '' : ' · ' + t.idade + ' anos');
          sel.appendChild(o);
        });
        sel.value = CUI.teenId || '';
      }
    }

    if (aviso) {
      aviso.innerHTML = CUI.teens.length ? '' :
        'Nenhum adolescente vinculado ainda. <a href="vinculos-cuidador.html">Adicionar pelo código de vínculo</a>.';
    }
  }

  async function carregarTeens() {
    var sb = CUI.sb;
    CUI.teens = [];
    if (!sb || !CUI.uid) return;

    /* ⚠️ Basta UMA coluna inexistente aqui para a consulta INTEIRA falhar (e não
       só aquele campo vir vazio). Foi assim que o painel passou a dizer "nenhum
       adolescente vinculado" com o vínculo intacto, quando `nascimento` entrou
       no select antes de existir no banco. `nascimento` foi migrada em
       2026-08-13 e está confirmada em produção; qualquer coluna NOVA daqui pra
       frente precisa da mesma prova antes de entrar nesta linha. */
    var res = await sb.from('neurodivergente').select('id, codigo_vinculo, xp, nivel, nascimento').eq('id_responsavel', CUI.uid);
    if (res.error) {
      /* Sem isto o erro era engolido pelo `|| []` e a tela mentia dizendo que
         não havia ninguém vinculado. Falhar visivelmente > falhar em silêncio. */
      console.error('[cuidador-shell] não foi possível carregar os vinculados:',
        res.error.code, '|', res.error.message, '|', res.error.details, '|', res.error.hint);
    }
    var linhas = res.data || [];

    for (var i = 0; i < linhas.length; i++) {
      var t = linhas[i];
      var pr = await sb.from('profiles').select('nome, sobrenome').eq('id', t.id).single();
      CUI.teens.push({
        id: t.id,
        nome: (pr.data && pr.data.nome) ? pr.data.nome : 'Sem nome',
        sobrenome: (pr.data && pr.data.sobrenome) || '',
        codigo_vinculo: t.codigo_vinculo || '',
        xp: t.xp || 0,
        nivel: t.nivel || 1,
        nascimento: t.nascimento || null,
        idade: CUI.idade(t.nascimento)
      });
    }

    /* Lembra a escolha entre páginas. Se o teen salvo não existe mais
       (vínculo encerrado), cai no primeiro da lista em vez de tela vazia. */
    var salvo = null;
    try { salvo = localStorage.getItem(CHAVE_TEEN); } catch (e) {}
    var achou = CUI.teens.filter(function (t) { return t.id === salvo; })[0];
    CUI.teenId = achou ? achou.id : (CUI.teens.length ? CUI.teens[0].id : null);
    try {
      if (CUI.teenId) localStorage.setItem(CHAVE_TEEN, CUI.teenId);
      else localStorage.removeItem(CHAVE_TEEN);
    } catch (e) {}

    preencherSeletor();
  }

  /* Recarrega a lista de vinculados (usado depois de criar/encerrar vínculo). */
  CUI.recarregarTeens = async function () {
    await carregarTeens();
    avisarOuvintes();
    atualizarBadgeAlertas();
  };

  /* ── BADGE DE ALERTAS (vale em todas as páginas) ──────────────── */
  async function atualizarBadgeAlertas() {
    var cnt = document.getElementById('nav-alerta-cnt');
    var strip = document.getElementById('cui-alerta-strip');
    if (!CUI.sb || !CUI.teenId) { if (cnt) cnt.hidden = true; return; }

    var res = await CUI.sb.from('alertas').select('tipo, lido, titulo, timestamp')
      .eq('id_neurodivergente', CUI.teenId)
      .order('timestamp', { ascending: false }).limit(20);
    var alertas = res.data || [];
    var naoLidos = alertas.filter(function (a) { return !a.lido; }).length;

    if (cnt) {
      cnt.hidden = naoLidos === 0;
      cnt.textContent = naoLidos;
    }
    if (strip && naoLidos > 0 && alertas[0] && alertas[0].tipo === 'crise' && !alertas[0].lido) {
      var msg = document.getElementById('cui-alerta-strip-msg');
      if (msg) msg.textContent = alertas[0].titulo || 'Estado de crise detectado. Verifique os alertas.';
      strip.classList.add('show');
    }
  }
  CUI.atualizarBadgeAlertas = atualizarBadgeAlertas;

  /* ── BOOT ─────────────────────────────────────────────────────── */
  async function boot() {
    var sb = CUI.sb;
    if (!sb) {
      var area = document.getElementById('cui-nome-area');
      if (area) area.textContent = 'Sem conexão';
      return;
    }

    var s = await sb.auth.getSession();
    var session = s && s.data && s.data.session;
    if (!session) { g.location.href = 'login.html'; return; }
    CUI.uid = session.user.id;

    var p = await sb.from('profiles').select('nome, sobrenome, tipo').eq('id', CUI.uid).single();
    if (p.error || !p.data) { g.location.href = 'login.html'; return; }
    if (p.data.tipo !== 'responsavel' && p.data.tipo !== 'terapeuta') { g.location.href = 'home-autista.html'; return; }
    CUI.perfil = p.data;

    CUI.definirNome(p.data.nome);

    await carregarTeens();

    CUI.pronto = true;
    avisarOuvintes();
    atualizarBadgeAlertas();
  }

  function iniciar() {
    montarCasca();
    // "nav": a página tem lógica de sessão própria (comunidade, calendário,
    // conta, vínculos) — a casca só desenha o menu, sem duplicar getSession().
    if (document.body && document.body.getAttribute('data-cui-shell') === 'nav') return;
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
