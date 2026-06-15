/* ============================================================
   LumiTEA — evento-checkin.js
   Widget global. Mostra chip discreto no canto inferior esquerdo
   quando o adolescente tem um evento próximo (dentro da janela
   `lembrete_pre_minutos` do evento).
   Carregue em todas as páginas internas do adolescente DEPOIS
   de js/core/config.js e do supabase-js do CDN.
   ============================================================ */
(function () {
  var POLLING_MS = 60000;
  var dispensados = new Set();

  function montarSb() {
    if (!window.LUMITEA || !window.LUMITEA.criarSupabase) return null;
    return window.LUMITEA.criarSupabase();
  }

  function format(min) {
    if (min <= 1) return 'agora';
    if (min < 60) return 'em ' + min + ' min';
    return 'em ' + Math.round(min / 60) + 'h';
  }

  function renderizar(ev, minutos) {
    var existente = document.getElementById('lt-checkin');
    if (existente) existente.remove();

    var div = document.createElement('div');
    div.id = 'lt-checkin';
    div.className = 'lt-checkin';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Check-in de evento');

    div.innerHTML =
      '<button class="lt-checkin-x" type="button" aria-label="Fechar">×</button>' +
      '<div class="lt-checkin-head">' +
        '<img class="lt-checkin-emoji" src="img/icon-urso.png" alt="" style="width:34px;height:34px;object-fit:contain;">' +
        '<div>' +
          '<p class="lt-checkin-titulo"></p>' +
          '<p class="lt-checkin-quando"></p>' +
        '</div>' +
      '</div>' +
      '<div class="lt-checkin-acoes">' +
        '<button data-acao="ok" type="button"><i class="lt-i" data-lt-icon="check" aria-hidden="true"></i> Tô bem</button>' +
        '<a data-acao="conversar" href="conversa.html"><i class="lt-i" data-lt-icon="message-circle" aria-hidden="true"></i> Conversar</a>' +
        '<a data-acao="praticar" href="#"><i class="lt-i" data-lt-icon="play" aria-hidden="true"></i> Explorar</a>' +
      '</div>';

    div.querySelector('.lt-checkin-titulo').textContent = ev.titulo;
    div.querySelector('.lt-checkin-quando').textContent = format(minutos) + '. Como você está?';

    var praticarLink = div.querySelector('a[data-acao="praticar"]');
    if (praticarLink) praticarLink.href = 'games.html?evento=' + encodeURIComponent(ev.id);

    if (window.LUMI && window.LUMI.hydrateIcons) window.LUMI.hydrateIcons(div);

    div.querySelector('.lt-checkin-x').addEventListener('click', function () { registrar(ev.id, 'dispensou'); div.remove(); });
    div.querySelectorAll('.lt-checkin-acoes [data-acao]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        registrar(ev.id, el.getAttribute('data-acao'));
        if (el.tagName === 'BUTTON') {
          e.preventDefault();
          div.remove();
        }
      });
    });

    document.body.appendChild(div);
  }

  function registrar(idEvento, acao) {
    dispensados.add(idEvento);
    var sb = montarSb();
    if (!sb) return;
    sb.auth.getUser().then(function (r) {
      if (!r || !r.data || !r.data.user) return;
      sb.from('lembretes_evento').insert({
        id_evento: idEvento,
        id_neurodivergente: r.data.user.id,
        tipo: 'pre',
        acao_tomada: acao,
      }).then(function () { /* ok */ });
    });
  }

  async function buscar() {
    var sb = montarSb();
    if (!sb) return;
    var user;
    try {
      var r = await sb.auth.getUser();
      user = r && r.data ? r.data.user : null;
    } catch (e) { return; }
    if (!user) return;

    var agora = new Date();
    var hoje = agora.toISOString().slice(0, 10);
    var amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    var resp;
    try {
      resp = await sb
        .from('eventos_calendario')
        .select('id, titulo, data_evento, hora_evento, lembrete_pre_minutos, checkin_pre')
        .eq('id_neurodivergente', user.id)
        .in('data_evento', [hoje, amanha])
        .order('data_evento', { ascending: true })
        .order('hora_evento', { ascending: true });
    } catch (e) { return; }

    var dados = (resp && resp.data) || [];
    var proximo = null;
    var minutos = 0;
    for (var i = 0; i < dados.length; i++) {
      var ev = dados[i];
      if (ev.checkin_pre === false) continue;
      if (!ev.hora_evento) continue;
      if (dispensados.has(ev.id)) continue;
      var dataEv = new Date(ev.data_evento + 'T' + ev.hora_evento);
      var diffMin = Math.floor((dataEv.getTime() - agora.getTime()) / 60000);
      var janela = ev.lembrete_pre_minutos || 60;
      if (diffMin >= 0 && diffMin <= janela) {
        proximo = ev;
        minutos = diffMin;
        break;
      }
    }

    if (proximo) {
      renderizar(proximo, minutos);
    } else {
      var existente = document.getElementById('lt-checkin');
      if (existente) existente.remove();
    }
  }

  function iniciar() {
    if (!window.supabase) {
      // CDN ainda carregando — tenta de novo em 600ms
      return setTimeout(iniciar, 600);
    }
    buscar();
    setInterval(buscar, POLLING_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
