/* ============================================================
   LumiTEA — chat.js
   Chat em tempo real (salas), estilo WhatsApp/Telegram.
   Separado por público (teen | cuidador) via Supabase Realtime.
   Usado por comunidade.html e comunidade-cuidador.html.
   Tabela: comunidade_chat (ver db/CHAT_SCHEMA.sql).

   IA (Lumi) participa: ajuda a escrever com gentileza, responde
   perguntas em particular, resume a conversa e dá um aceno de apoio
   se perceber sinais de sofrimento. Degrada com elegância se a
   tabela/Realtime/IA não estiverem disponíveis.
   ============================================================ */
var Chat = (function () {
  'use strict';
  var LT = window.LUMITEA || {};
  var esc = LT.esc || function (s) { return String(s == null ? '' : s); };
  var escBr = LT.escBr || function (s) { return esc(s).replace(/\n/g, '<br>'); };
  function icon(n) { return (window.LUMI && LUMI.icon) ? LUMI.icon(n) : ''; }
  function hydrate(node) { if (window.LUMI && LUMI.hydrateIcons) LUMI.hydrateIcons(node || document); }

  var cfg = { sb: null, userId: null, nome: 'Alguém', publico: 'teen' };
  var el = {};
  var canal = null;        // canal Realtime (um para todo o público)
  var salaAtual = null;
  var vistos = {};         // ids já renderizados (dedupe)
  var unread = {};         // sala -> nº de mensagens não lidas

  var SALAS_TEEN = [
    { id: 'geral',     nome: 'Bate-papo geral', desc: 'Converse com outros adolescentes. Aqui ninguém julga.' },
    { id: 'desabafos', nome: 'Desabafos',       desc: 'Um lugar pra dividir o que pesa. Acolha e seja acolhido.' },
    { id: 'vitorias',  nome: 'Vitórias',        desc: 'Comemore as conquistas, pequenas ou grandes.' },
    { id: 'interesses',nome: 'Meus interesses', desc: 'Fale do que você ama: jogos, séries, hobbies...' }
  ];
  var SALAS_CUID = [
    { id: 'geral',       nome: 'Bate-papo geral', desc: 'Converse com outros cuidadores. Você não está sozinho.' },
    { id: 'duvidas',     nome: 'Dúvidas',         desc: 'Pergunte e ajude com experiências do dia a dia.' },
    { id: 'experiencias',nome: 'Experiências',    desc: 'Troque estratégias que funcionaram (ou não).' },
    { id: 'desabafos',   nome: 'Desabafos',       desc: 'Um espaço de respiro entre cuidadores.' }
  ];

  // sinais de sofrimento → aceno de apoio privado da Lumi (não alarma a sala)
  var SINAIS = ['me matar', 'suicíd', 'suicid', 'não aguento mais', 'nao aguento mais', 'me cortar',
    'queria morrer', 'quero morrer', 'vou morrer', 'sumir do mundo', 'acabar com tudo', 'me machucar',
    'tirar minha vida', 'não quero viver', 'nao quero viver'];

  function salas() { return cfg.publico === 'cuidador' ? SALAS_CUID : SALAS_TEEN; }
  function primeiroNome(n) { return String(n || 'Alguém').trim().split(/\s+/)[0]; }
  function hora(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  // conversas da comunidade reiniciam todo dia — só mostra mensagens de hoje
  function inicioDoDia() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  /* ---------- inicialização ---------- */
  function iniciar(opts) {
    cfg.sb = opts.sb; cfg.userId = opts.userId;
    cfg.nome = opts.nome || 'Alguém'; cfg.publico = opts.publico || 'teen';
    var root = document.getElementById(opts.container || 'chat-root');
    if (!root) return;

    root.innerHTML =
      '<div class="ch-wrap">' +
        '<div class="ch-rooms" id="ch-rooms"></div>' +
        '<div class="ch-main">' +
          '<div class="ch-head">' +
            '<div class="ch-head-info"><b id="ch-room-nome">—</b><span id="ch-room-desc"></span></div>' +
            '<span class="grow"></span>' +
            '<span class="ch-live">' + '<span class="ch-dot"></span>ao vivo</span>' +
            '<button class="cm-btn cm-btn-ghost" id="ch-resumo" type="button" title="Resumo da Lumi">' + icon('sparkles') + ' Resumo</button>' +
          '</div>' +
          '<div class="ch-msgs" id="ch-msgs"></div>' +
          '<div class="ch-compose">' +
            '<button class="ch-ic-btn lumi" id="ch-lumi" type="button" title="Perguntar à Lumi (só você vê)">' + icon('sparkles') + '</button>' +
            '<input class="ch-input" id="ch-input" maxlength="1000" placeholder="Escreva uma mensagem...">' +
            '<button class="ch-ic-btn lumi" id="ch-ajuda" type="button" title="Lumi me ajuda a escrever">' + icon('edit') + '</button>' +
            '<button class="ch-ic-btn send" id="ch-send" type="button" aria-label="Enviar">' + icon('send') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    el.rooms = document.getElementById('ch-rooms');
    el.nome = document.getElementById('ch-room-nome');
    el.desc = document.getElementById('ch-room-desc');
    el.msgs = document.getElementById('ch-msgs');
    el.input = document.getElementById('ch-input');
    el.send = document.getElementById('ch-send');
    el.ajuda = document.getElementById('ch-ajuda');
    el.lumi = document.getElementById('ch-lumi');
    el.resumo = document.getElementById('ch-resumo');

    el.rooms.innerHTML = salas().map(function (s, i) {
      return '<button class="ch-room' + (i === 0 ? ' on' : '') + '" data-sala="' + esc(s.id) + '">' + esc(s.nome) + '</button>';
    }).join('');
    el.rooms.querySelectorAll('.ch-room').forEach(function (b) {
      b.addEventListener('click', function () {
        el.rooms.querySelectorAll('.ch-room').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        entrarSala(b.getAttribute('data-sala'));
      });
    });

    el.send.addEventListener('click', enviar);
    el.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
    el.ajuda.addEventListener('click', ajudaEscrever);
    el.lumi.addEventListener('click', perguntarLumi);
    el.resumo.addEventListener('click', resumir);

    hydrate(root);
    entrarSala(salas()[0].id);

    window.addEventListener('beforeunload', desinscrever);
  }

  /* ---------- salas + realtime ---------- */
  function entrarSala(id) {
    salaAtual = id; vistos = {};
    unread[id] = 0; atualizarBadges();           // ao abrir a sala, zera o não-lido dela
    var s = salas().filter(function (x) { return x.id === id; })[0] || {};
    el.nome.textContent = s.nome || id;
    el.desc.textContent = s.desc || '';
    el.msgs.innerHTML = '<div class="ch-sys">' + icon('clock') + ' carregando conversa...</div>';
    hydrate(el.msgs);
    carregarHistorico().then(inscreverPublico);
  }

  // badge de não-lidas em cada pílula de sala
  function atualizarBadges() {
    if (!el.rooms) return;
    el.rooms.querySelectorAll('.ch-room').forEach(function (b) {
      var sala = b.getAttribute('data-sala'), n = unread[sala] || 0;
      var bd = b.querySelector('.ch-badge');
      if (n > 0) {
        if (!bd) { bd = document.createElement('span'); bd.className = 'ch-badge'; b.appendChild(bd); }
        bd.textContent = n > 9 ? '9+' : String(n);
      } else if (bd) { bd.remove(); }
    });
  }

  async function carregarHistorico() {
    if (!cfg.sb) { el.msgs.innerHTML = erroTabela(); return; }
    try {
      var r = await cfg.sb.from('comunidade_chat')
        .select('id,autor_id,autor_nome,texto,criado_em')
        .eq('publico', cfg.publico).eq('sala', salaAtual)
        .gte('criado_em', inicioDoDia())
        .order('criado_em', { ascending: true }).limit(100);
      if (r.error) throw r.error;
      el.msgs.innerHTML = '';
      var msgs = r.data || [];
      if (!msgs.length) { el.msgs.innerHTML = vazio(); return; }
      msgs.forEach(function (m) { adicionar(m, false); });
      rolarFim();
    } catch (e) {
      console.warn('[chat] histórico:', e.message);
      el.msgs.innerHTML = erroTabela();
    }
  }

  // Assina UMA vez todo o público: mensagens da sala aberta entram ao vivo;
  // mensagens de outras salas viram contador de não-lidas.
  function inscreverPublico() {
    if (canal || !cfg.sb || !cfg.sb.channel) return;   // já assinado
    canal = cfg.sb.channel('chat:' + cfg.publico)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comunidade_chat', filter: 'publico=eq.' + cfg.publico },
        function (payload) {
          var m = payload.new;
          if (!m || m.publico !== cfg.publico) return;
          if (m.sala === salaAtual) {
            if (vistos[m.id]) return;
            var vazioEl = el.msgs.querySelector('.ch-vazio');
            if (vazioEl) el.msgs.innerHTML = '';
            adicionar(m, true);
            rolarFim();
          } else if (m.autor_id !== cfg.userId) {
            unread[m.sala] = (unread[m.sala] || 0) + 1;
            atualizarBadges();
          }
        })
      .subscribe();
  }

  function desinscrever() {
    if (canal && cfg.sb) { try { cfg.sb.removeChannel(canal); } catch (e) {} canal = null; }
  }

  /* ---------- render de mensagens ---------- */
  function adicionar(m, animar) {
    if (vistos[m.id]) return; vistos[m.id] = true;
    var meu = m.autor_id === cfg.userId;
    var div = document.createElement('div');
    div.className = 'ch-msg' + (meu ? ' eu' : '');
    div.setAttribute('data-id', m.id);
    div.innerHTML =
      (meu ? '' : '<div class="ch-autor">' + esc(primeiroNome(m.autor_nome)) + '</div>') +
      '<div class="ch-bolha">' + escBr(m.texto) +
        '<span class="ch-hora">' + hora(m.criado_em) +
          (meu ? ' <button class="ch-del" title="Apagar" data-del="' + esc(m.id) + '">' + icon('trash') + '</button>' : '') +
        '</span>' +
      '</div>';
    el.msgs.appendChild(div);
    hydrate(div);
    var del = div.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () { apagar(m.id, div); });
  }

  function adicionarLumi(texto) {
    var div = document.createElement('div');
    div.className = 'ch-msg lumi';
    div.innerHTML = '<div class="ch-bolha"><span class="ch-lumi-tag">' + icon('sparkles') + 'Lumi</span>' +
      escBr(texto) + '<div class="ch-lumi-priv">' + icon('eye') + ' só você está vendo esta mensagem</div></div>';
    el.msgs.appendChild(div); hydrate(div); rolarFim();
    return div;
  }

  function rolarFim() { el.msgs.scrollTop = el.msgs.scrollHeight; }

  /* ---------- enviar / apagar ---------- */
  async function enviar() {
    var texto = (el.input.value || '').trim();
    if (!texto) { el.input.focus(); return; }
    if (!cfg.sb) return;
    el.input.value = ''; el.send.disabled = true;
    try {
      var r = await cfg.sb.from('comunidade_chat').insert({
        sala: salaAtual, publico: cfg.publico, autor_id: cfg.userId, autor_nome: cfg.nome, texto: texto
      }).select('id,autor_id,autor_nome,texto,criado_em').single();
      if (r.error) throw r.error;
      var vazioEl = el.msgs.querySelector('.ch-vazio'); if (vazioEl) el.msgs.innerHTML = '';
      adicionar(r.data, true); rolarFim();      // otimista (realtime fará dedupe por id)
      checarSinais(texto);
    } catch (e) {
      console.warn('[chat] enviar:', e.message);
      mostrarErro('Não consegui enviar agora. Tente de novo.');
      el.input.value = texto;
    }
    el.send.disabled = false; el.input.focus();
  }

  async function apagar(id, div) {
    if (!confirm('Apagar sua mensagem?')) return;
    try {
      var r = await cfg.sb.from('comunidade_chat').delete().eq('id', id).eq('autor_id', cfg.userId);
      if (r.error) throw r.error;
      div.remove();
    } catch (e) { console.warn('[chat] apagar:', e.message); }
  }

  /* ---------- IA (Lumi) ---------- */
  function sysLumi() {
    if (cfg.publico === 'cuidador') {
      return 'Você é a Lumi, orientadora do LumiTEA falando em particular com um cuidador de um adolescente autista, ' +
        'dentro de um chat de comunidade. Seja prática, acolhedora e baseada em boas práticas (validação, ' +
        'previsibilidade, comunicação clara, reforço positivo, redução de sobrecarga). Não diagnostique; em crise, ' +
        'oriente buscar ajuda profissional. Português do Brasil, frases curtas, sem markdown, sem emojis.';
    }
    return 'Você é a Lumi, ajudante do LumiTEA falando em particular com um adolescente autista, dentro de um chat ' +
      'de comunidade entre adolescentes. Seja gentil, simples e concreta; valide o sentimento primeiro. Você NÃO ' +
      'substitui acompanhamento profissional; em sofrimento intenso, oriente procurar um adulto de confiança. ' +
      'Português do Brasil, frases curtas, sem markdown, sem emojis.';
  }

  async function chamarIA(messages, maxTokens, temp) {
    if (!LT.groqFetch) throw new Error('sem-ia');
    var res = await LT.groqFetch({
      model: LT.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: messages, max_tokens: maxTokens || 500, temperature: temp == null ? 0.7 : temp
    });
    if (!res.ok) throw new Error('proxy ' + res.status);
    var data = await res.json();
    var t = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!t) throw new Error('vazio');
    return t.trim();
  }

  // reescreve a mensagem do compositor com mais clareza/gentileza
  async function ajudaEscrever() {
    var texto = (el.input.value || '').trim();
    if (!texto) { mostrarErro('Escreva uma ideia primeiro que eu te ajudo a deixar mais clara.'); return; }
    el.ajuda.disabled = true;
    try {
      var sys = 'Reescreva a mensagem do usuário para um chat de comunidade ' +
        (cfg.publico === 'cuidador' ? 'de cuidadores' : 'entre adolescentes autistas') +
        ', deixando clara, gentil e respeitosa, mantendo a voz e a intenção. Responda APENAS com o texto reescrito, ' +
        'em português do Brasil, sem aspas, sem markdown, sem emojis.';
      var t = await chamarIA([{ role: 'system', content: sys }, { role: 'user', content: texto }], 300, 0.6);
      var bal = adicionarLumi('Que tal assim?\n\n"' + t + '"');
      var btns = document.createElement('div'); btns.className = 'ch-btn-row'; btns.style.marginTop = '8px';
      btns.innerHTML = '<button class="cm-btn cm-btn-primary" style="min-height:38px;padding:7px 14px;">Usar este texto</button>';
      bal.querySelector('.ch-bolha').appendChild(btns);
      btns.querySelector('button').addEventListener('click', function () { el.input.value = t; el.input.focus(); bal.remove(); });
    } catch (e) { mostrarErro('A ajuda da Lumi não está disponível agora.'); }
    el.ajuda.disabled = false;
  }

  // pergunta privada à Lumi (resposta só pra quem perguntou; não vai pra sala)
  async function perguntarLumi() {
    var texto = (el.input.value || '').trim();
    if (!texto) { mostrarErro('Escreva sua pergunta e toque na estrelinha — só você verá a resposta.'); return; }
    el.input.value = '';
    var meu = document.createElement('div');
    meu.className = 'ch-msg eu';
    meu.innerHTML = '<div class="ch-bolha">' + escBr(texto) + '<span class="ch-hora">para a Lumi</span></div>';
    el.msgs.appendChild(meu);
    var pensando = adicionarLumi('pensando...');
    try {
      var t = await chamarIA([{ role: 'system', content: sysLumi() }, { role: 'user', content: texto }], 500, 0.7);
      pensando.remove(); adicionarLumi(t);
    } catch (e) { pensando.remove(); adicionarLumi('Não consegui responder agora. Tenta de novo daqui a pouco?'); }
  }

  // resume as mensagens recentes da sala (privado)
  async function resumir() {
    var bolhas = Array.prototype.slice.call(el.msgs.querySelectorAll('.ch-msg:not(.lumi)'));
    if (bolhas.length < 2) { mostrarErro('Ainda há pouca conversa para resumir.'); return; }
    el.resumo.disabled = true;
    var pensando = adicionarLumi('lendo a conversa...');
    try {
      var txt = bolhas.slice(-30).map(function (b) {
        var autor = b.querySelector('.ch-autor'); var bal = b.querySelector('.ch-bolha');
        var nome = autor ? autor.textContent : 'Você';
        return nome + ': ' + (bal ? bal.textContent.replace(/\d{2}:\d{2}.*$/, '').trim() : '');
      }).join('\n');
      var sys = 'Resuma de forma curta e acolhedora os principais assuntos desta conversa de comunidade, em 2 ou 3 ' +
        'frases, sem citar nomes. Português do Brasil, sem markdown, sem emojis.';
      var t = await chamarIA([{ role: 'system', content: sys }, { role: 'user', content: txt }], 250, 0.5);
      pensando.remove(); adicionarLumi('Resumo da conversa:\n\n' + t);
    } catch (e) { pensando.remove(); adicionarLumi('Não consegui resumir agora.'); }
    el.resumo.disabled = false;
  }

  // moderação leve: aceno de apoio se houver sinais de sofrimento
  function checarSinais(texto) {
    var t = (texto || '').toLowerCase();
    var achou = SINAIS.some(function (s) { return t.indexOf(s) !== -1; });
    if (!achou) return;
    var msg = cfg.publico === 'cuidador'
      ? 'Percebi um momento difícil no que você escreveu. Você não está sozinho. Se for uma crise, busque apoio ' +
        'profissional. No Brasil, o CVV atende no 188 (24h).'
      : 'Li o que você escreveu e fico aqui com você. Você importa. Se estiver muito difícil, fale com um adulto ' +
        'de confiança agora. Você também pode conversar comigo no Theo. No Brasil, o CVV atende no 188 (24h).';
    var bal = adicionarLumi(msg);
    if (cfg.publico !== 'cuidador') {
      var btns = document.createElement('div'); btns.style.marginTop = '8px';
      btns.innerHTML = '<a class="cm-btn cm-btn-primary" style="min-height:38px;padding:7px 14px;text-decoration:none;" href="conversa.html">Falar com o Theo</a>';
      bal.querySelector('.ch-bolha').appendChild(btns);
    }
  }

  /* ---------- estados ---------- */
  function mostrarErro(msg) {
    var antigo = el.msgs.parentNode.querySelector('.ch-erro'); if (antigo) antigo.remove();
    var d = document.createElement('div'); d.className = 'ch-erro'; d.textContent = msg;
    el.msgs.parentNode.querySelector('.ch-compose').appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 4000);
  }
  function vazio() {
    var msg = cfg.publico === 'cuidador'
      ? 'Ninguém conversou por aqui hoje ainda. Que tal começar dizendo um oi ou uma dúvida?'
      : 'Sala vazia por enquanto. Pode ser você a começar — um oi já vale!';
    return '<div class="ch-vazio">' + icon('message-circle') + '<p>' + esc(msg) +
      '</p><p class="ch-vazio-nota">' + icon('clock') + ' As conversas daqui reiniciam todo dia.</p></div>';
  }
  function erroTabela() {
    return '<div class="ch-vazio">' + icon('alert-circle') +
      '<p>O chat ainda está sendo preparado. Se você é admin, rode <b>db/CHAT_SCHEMA.sql</b> no Supabase.</p></div>';
  }

  return { iniciar: iniciar };
})();
