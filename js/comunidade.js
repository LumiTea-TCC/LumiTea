/* ============================================================
   LumiTEA — comunidade.js
   Feed de comunidade separado por público (teen | cuidador).
   Usado por comunidade.html e comunidade-cuidador.html.
   Tabelas: comunidade_posts / comunidade_comentarios / comunidade_apoios
   (ver db/COMUNIDADE_SCHEMA.sql). Degrada com elegância se a tabela
   ainda não existir ou a IA estiver offline.
   ============================================================ */
var Comunidade = (function () {
  'use strict';
  var LT = window.LUMITEA || {};
  var esc = LT.esc || function (s) { return String(s == null ? '' : s); };
  var escBr = LT.escBr || function (s) { return esc(s).replace(/\n/g, '<br>'); };
  function icon(n) { return (window.LUMI && LUMI.icon) ? LUMI.icon(n) : ''; }

  var cfg = { sb: null, userId: null, nome: 'Alguém', publico: 'teen' };
  var el = {};
  var apoiados = {}; // postId -> bool (este usuário apoiou)

  var CATEGORIAS_TEEN = ['Desabafo', 'Vitória', 'Dúvida', 'Dica', 'Conversa'];
  var CATEGORIAS_CUID = ['Experiência', 'Dúvida', 'Conquista', 'Pedido de ajuda', 'Recurso'];

  function $(id) { return document.getElementById(id); }
  function quando(ts) {
    var d = new Date(ts), agora = Date.now(), diff = Math.round((agora - d.getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return 'há ' + diff + ' min';
    if (diff < 1440) return 'há ' + Math.round(diff / 60) + ' h';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  function primeiroNome(n) { return String(n || 'Alguém').trim().split(/\s+/)[0]; }

  /* Slug sem acento pra virar classe de cor do badge (.c-vitoria etc.).
     Categoria sem cor própria cai no cinza neutro — nada quebra.

     O NFD separa a letra do acento; os acentos soltos ficam na faixa
     U+0300–U+036F e são descartados por código, e não por uma classe de regex
     com os caracteres literais — eles são invisíveis no editor e qualquer
     "arrumação" de encoding no meio do caminho apagaria a regra em silêncio. */
  function slugCat(c) {
    var semAcento = String(c || '').toLowerCase().normalize('NFD')
      .split('').filter(function (ch) {
        var n = ch.charCodeAt(0);
        return n < 0x300 || n > 0x36f;
      }).join('');
    return semAcento.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  var LIMITE = 2000;
  var catSelecionada = '';   // '' = sem categoria (continua opcional)

  function iniciar(opts) {
    cfg.sb = opts.sb; cfg.userId = opts.userId;
    cfg.nome = opts.nome || 'Alguém'; cfg.publico = opts.publico || 'teen';
    el.feed = $('cm-feed'); el.texto = $('cm-texto');
    el.cats = $('cm-categorias'); el.contador = $('cm-contador');
    el.publicar = $('cm-publicar'); el.ajuda = $('cm-ajuda-ia'); el.aviso = $('cm-aviso');

    /* Categorias viraram chips (antes era um <select>): num toque só, e a
       escolha fica visível o tempo todo em vez de escondida numa lista. */
    if (el.cats) {
      var cats = cfg.publico === 'cuidador' ? CATEGORIAS_CUID : CATEGORIAS_TEEN;
      el.cats.innerHTML = cats.map(function (c) {
        return '<button type="button" class="cm-cat" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>';
      }).join('');
      el.cats.querySelectorAll('.cm-cat').forEach(function (b) {
        b.addEventListener('click', function () {
          var cat = b.getAttribute('data-cat');
          // segundo toque no mesmo chip desmarca: a categoria é opcional
          catSelecionada = (catSelecionada === cat) ? '' : cat;
          el.cats.querySelectorAll('.cm-cat').forEach(function (x) {
            x.setAttribute('aria-pressed', String(x.getAttribute('data-cat') === catSelecionada));
          });
        });
      });
    }

    if (el.texto && el.contador) {
      el.texto.addEventListener('input', atualizarContador);
      atualizarContador();
    }
    if (el.publicar) el.publicar.addEventListener('click', publicar);
    if (el.ajuda) el.ajuda.addEventListener('click', ajudaIA);
    carregarFeed();
  }

  function atualizarContador() {
    var n = (el.texto.value || '').length;
    el.contador.textContent = n + ' / ' + LIMITE;
    el.contador.classList.toggle('no-limite', n > LIMITE * 0.9);
  }

  function limparCompositor() {
    el.texto.value = '';
    catSelecionada = '';
    if (el.cats) el.cats.querySelectorAll('.cm-cat').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    if (el.contador) atualizarContador();
  }

  async function carregarFeed() {
    if (!cfg.sb) return;
    el.feed.innerHTML = skeleton(3);
    try {
      var r = await cfg.sb.from('comunidade_posts')
        .select('id,autor_id,autor_nome,categoria,texto,criado_em')
        .eq('publico', cfg.publico)
        .order('criado_em', { ascending: false })
        .limit(60);
      if (r.error) throw r.error;
      var posts = r.data || [];
      if (!posts.length) { el.feed.innerHTML = vazio(); return; }

      var ids = posts.map(function (p) { return p.id; });
      var apoios = {}, meusApoios = {}, comentarios = {}, ultimoComent = {};
      try {
        var ra = await cfg.sb.from('comunidade_apoios').select('post_id,user_id').in('post_id', ids);
        (ra.data || []).forEach(function (a) {
          apoios[a.post_id] = (apoios[a.post_id] || 0) + 1;
          if (a.user_id === cfg.userId) meusApoios[a.post_id] = true;
        });
        /* Mesma consulta de antes, com as colunas do comentário: serve pro
           contador E pra prévia, sem uma segunda ida ao banco. Ordenado do
           mais novo pro mais velho, então o primeiro de cada post é a prévia. */
        var rc = await cfg.sb.from('comunidade_comentarios')
          .select('post_id,autor_nome,texto,criado_em')
          .in('post_id', ids).order('criado_em', { ascending: false });
        (rc.data || []).forEach(function (c) {
          comentarios[c.post_id] = (comentarios[c.post_id] || 0) + 1;
          if (!ultimoComent[c.post_id]) ultimoComent[c.post_id] = c;
        });
      } catch (e) {}

      apoiados = meusApoios;
      el.feed.innerHTML = posts.map(function (p) {
        return cardPost(p, apoios[p.id] || 0, !!meusApoios[p.id], comentarios[p.id] || 0, ultimoComent[p.id]);
      }).join('');
      if (window.LUMI) LUMI.hydrateIcons(el.feed);
      ligarEventosCards();
    } catch (e) {
      console.warn('[comunidade] feed:', e.message);
      el.feed.innerHTML = erroTabela();
    }
  }

  function cardPost(p, nApoios, euApoiei, nComent, ultimoComent) {
    var ini = primeiroNome(p.autor_nome).charAt(0).toUpperCase();
    var meu = p.autor_id === cfg.userId;

    /* Prévia do comentário mais recente, sempre visível (como no design). O
       botão "Comentários" continua abrindo a lista inteira logo abaixo. */
    var previa = ultimoComent
      ? '<div class="cm-c-previa"><b>' + esc(primeiroNome(ultimoComent.autor_nome)) +
          '<span>' + quando(ultimoComent.criado_em) + '</span></b>' +
          '<p>' + escBr(ultimoComent.texto) + '</p></div>'
      : '';

    return '' +
      '<article class="cm-post" data-id="' + esc(p.id) + '">' +
        '<header class="cm-post-top">' +
          '<span class="cm-av">' + esc(ini) + '</span>' +
          '<div class="cm-meta"><b>' + esc(primeiroNome(p.autor_nome)) + '</b>' +
            '<span>' + quando(p.criado_em) + '</span></div>' +
          (p.categoria ? '<span class="cm-cat-badge c-' + esc(slugCat(p.categoria)) + '">' + esc(p.categoria) + '</span>' : '') +
          (meu ? '<button class="cm-del" data-act="apagar" title="Apagar">' + icon('trash') + '</button>' : '') +
        '</header>' +
        '<p class="cm-texto">' + escBr(p.texto) + '</p>' +
        '<div class="cm-acoes">' +
          '<button class="cm-apoio' + (euApoiei ? ' on' : '') + '" data-act="apoio">' +
            icon('heart') + '<span class="cm-apoio-n">' + nApoios + '</span> Apoiar</button>' +
          '<button class="cm-coment-btn" data-act="comentarios">' +
            icon('message-circle') + '<span>' + nComent + '</span> Comentários</button>' +
        '</div>' +
        previa +
        '<div class="cm-comentarios" hidden></div>' +
      '</article>';
  }

  function ligarEventosCards() {
    el.feed.querySelectorAll('.cm-post').forEach(function (art) {
      var id = art.getAttribute('data-id');
      art.querySelector('[data-act="apoio"]').addEventListener('click', function () { toggleApoio(id, this); });
      art.querySelector('[data-act="comentarios"]').addEventListener('click', function () { abrirComentarios(id, art); });
      var del = art.querySelector('[data-act="apagar"]');
      if (del) del.addEventListener('click', function () { apagarPost(id, art); });
    });
  }

  async function publicar() {
    var texto = (el.texto.value || '').trim();
    if (!texto) { el.texto.focus(); return; }
    el.publicar.disabled = true; el.publicar.textContent = 'Publicando...';
    try {
      var r = await cfg.sb.from('comunidade_posts').insert({
        autor_id: cfg.userId, autor_nome: cfg.nome, publico: cfg.publico,
        categoria: catSelecionada || null, texto: texto
      });
      if (r.error) throw r.error;
      limparCompositor();
      await carregarFeed();
    } catch (e) {
      console.warn('[comunidade] publicar:', e.message);
      mostrarAviso('Não consegui publicar agora. Tente de novo em instantes.');
    }
    el.publicar.disabled = false; el.publicar.textContent = 'Publicar';
  }

  async function toggleApoio(id, btn) {
    if (!cfg.sb) return;
    var nEl = btn.querySelector('.cm-apoio-n');
    var n = parseInt(nEl.textContent) || 0;
    var jaApoiei = btn.classList.contains('on');
    btn.classList.toggle('on'); nEl.textContent = jaApoiei ? Math.max(0, n - 1) : n + 1;
    try {
      if (jaApoiei) {
        await cfg.sb.from('comunidade_apoios').delete().eq('post_id', id).eq('user_id', cfg.userId);
      } else {
        await cfg.sb.from('comunidade_apoios').insert({ post_id: id, user_id: cfg.userId });
      }
    } catch (e) {
      // reverte visual em caso de erro
      btn.classList.toggle('on'); nEl.textContent = n;
    }
  }

  async function abrirComentarios(id, art) {
    var box = art.querySelector('.cm-comentarios');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<div class="cm-coment-load">' + icon('clock') + ' carregando...</div>';
    if (window.LUMI) LUMI.hydrateIcons(box);
    try {
      var r = await cfg.sb.from('comunidade_comentarios')
        .select('id,autor_nome,texto,criado_em,autor_id')
        .eq('post_id', id).order('criado_em', { ascending: true }).limit(100);
      if (r.error) throw r.error;
      var lista = (r.data || []).map(function (c) {
        return '<div class="cm-c"><b>' + esc(primeiroNome(c.autor_nome)) + '</b> ' +
          '<span class="cm-c-quando">' + quando(c.criado_em) + '</span>' +
          '<p>' + escBr(c.texto) + '</p></div>';
      }).join('') || '<p class="cm-c-vazio">Seja o primeiro a responder com carinho.</p>';
      box.innerHTML =
        '<div class="cm-c-lista">' + lista + '</div>' +
        '<div class="cm-c-novo">' +
          '<input type="text" class="cm-c-input" maxlength="1000" placeholder="Responder com gentileza...">' +
          '<button class="cm-c-enviar" type="button">' + icon('send') + '</button>' +
        '</div>';
      if (window.LUMI) LUMI.hydrateIcons(box);
      var input = box.querySelector('.cm-c-input'), btn = box.querySelector('.cm-c-enviar');
      function envia() { comentar(id, input.value, art); }
      btn.addEventListener('click', envia);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); envia(); } });
    } catch (e) {
      box.innerHTML = '<p class="cm-c-vazio">Não consegui carregar os comentários.</p>';
    }
  }

  async function comentar(id, texto, art) {
    texto = (texto || '').trim(); if (!texto) return;
    try {
      var r = await cfg.sb.from('comunidade_comentarios').insert({
        post_id: id, autor_id: cfg.userId, autor_nome: cfg.nome, texto: texto
      });
      if (r.error) throw r.error;
      // recarrega os comentários do card e o contador
      art.querySelector('.cm-comentarios').hidden = true;
      var cBtn = art.querySelector('[data-act="comentarios"] span');
      if (cBtn) cBtn.textContent = (parseInt(cBtn.textContent) || 0) + 1;
      abrirComentarios(id, art);
    } catch (e) { console.warn('[comunidade] comentar:', e.message); }
  }

  async function apagarPost(id, art) {
    if (!confirm('Apagar sua publicação?')) return;
    try {
      var r = await cfg.sb.from('comunidade_posts').delete().eq('id', id).eq('autor_id', cfg.userId);
      if (r.error) throw r.error;
      art.remove();
      if (!el.feed.querySelector('.cm-post')) el.feed.innerHTML = vazio();
    } catch (e) { console.warn('[comunidade] apagar:', e.message); }
  }

  // ── IA ajuda a escrever (mais clara/gentil) ──
  async function ajudaIA() {
    var texto = (el.texto.value || '').trim();
    if (!texto) { mostrarAviso('Escreva uma ideia primeiro, aí eu te ajudo a deixar mais clara.'); return; }
    if (!LT.groqFetch) { mostrarAviso('A ajuda da IA não está disponível agora.'); return; }
    el.ajuda.disabled = true; var txtOrig = el.ajuda.innerHTML; el.ajuda.textContent = 'Pensando...';
    var sys = cfg.publico === 'cuidador'
      ? 'Você ajuda um cuidador a reescrever um post para uma comunidade de pais de adolescentes autistas. Deixe claro, respeitoso e acolhedor, mantendo a mensagem da pessoa. Responda APENAS com o texto reescrito, em português do Brasil, sem aspas, sem markdown, sem emojis.'
      : 'Você ajuda um adolescente autista a reescrever um post para uma comunidade de apoio entre adolescentes. Deixe claro e gentil, mantendo a voz e a mensagem dele. Responda APENAS com o texto reescrito, em português do Brasil, sem aspas, sem markdown, sem emojis, frases curtas.';
    try {
      var res = await LT.groqFetch({
        model: LT.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: texto }],
        max_tokens: 400, temperature: 0.6
      });
      var data = await res.json();
      var sug = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content.trim() : '';
      if (sug) mostrarSugestao(sug);
      else mostrarAviso('Não consegui sugerir agora. Tente de novo.');
    } catch (e) { mostrarAviso('Não consegui falar com a IA agora.'); }
    el.ajuda.disabled = false; el.ajuda.innerHTML = txtOrig;
  }

  function mostrarSugestao(sug) {
    if (!el.aviso) return;
    el.aviso.hidden = false;
    el.aviso.innerHTML = '<div class="cm-sug"><b>Sugestão do Lumi Theo:</b><p>' + escBr(sug) + '</p>' +
      '<div class="cm-sug-btns"><button class="cm-sug-usar">Usar este texto</button>' +
      '<button class="cm-sug-ignorar">Manter o meu</button></div></div>';
    el.aviso.querySelector('.cm-sug-usar').addEventListener('click', function () {
      // atribuir .value por JS não dispara 'input' — o contador precisa ser avisado
      el.texto.value = sug; if (el.contador) atualizarContador();
      el.aviso.hidden = true; el.texto.focus();
    });
    el.aviso.querySelector('.cm-sug-ignorar').addEventListener('click', function () { el.aviso.hidden = true; });
  }
  function mostrarAviso(msg) {
    if (!el.aviso) return;
    el.aviso.hidden = false;
    el.aviso.innerHTML = '<div class="cm-aviso-msg">' + esc(msg) + '</div>';
    setTimeout(function () { if (el.aviso) el.aviso.hidden = true; }, 5000);
  }

  // ── estados ──
  function skeleton(n) {
    var s = ''; for (var i = 0; i < n; i++) s += '<div class="cm-post lt-skeleton" style="height:120px"></div>';
    return s;
  }
  function vazio() {
    var msg = cfg.publico === 'cuidador'
      ? 'Ainda não há conversas por aqui. Que tal compartilhar uma experiência ou dúvida com outros cuidadores?'
      : 'Ainda não há nada aqui. Pode ser você a começar — um desabafo, uma vitória, uma dúvida. Aqui é um lugar seguro.';
    return '<div class="cm-vazio">' + icon('users') + '<p>' + esc(msg) + '</p></div>';
  }
  function erroTabela() {
    return '<div class="cm-vazio">' + icon('alert-circle') +
      '<p>A comunidade ainda está sendo preparada. Se você é admin, rode <b>db/COMUNIDADE_SCHEMA.sql</b> no Supabase.</p></div>';
  }

  return { iniciar: iniciar, recarregar: carregarFeed };
})();
