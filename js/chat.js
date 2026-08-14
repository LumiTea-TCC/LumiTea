/* ============================================================
   LumiTEA — chat.js
   Chat em tempo real (salas), estilo WhatsApp/Telegram.
   Separado por público (teen | cuidador) via Supabase Realtime.
   Usado por comunidade.html e comunidade-cuidador.html.
   Tabela: comunidade_chat (ver db/CHAT_SCHEMA.sql).

   IA (Lumi Theo) participa: ajuda a escrever com gentileza, responde
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
  var bloqueadoAte = null; // teen: ISO da hora em que o bloqueio de segurança acaba (null = sem bloqueio)
  var elBloqueio = null;   // banner do bloqueio, se houver
  var timerBloqueio = null;

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

  /* Ícone e cor de cada sala. Chaveado por id, que é compartilhado entre os
     dois públicos onde faz sentido ('geral', 'desabafos'). Sala sem entrada
     aqui cai no padrão azul com balão — nada quebra ao inventar sala nova. */
  var VISUAL_SALA = {
    geral:        { icone: 'message-circle', cor: '' },
    desabafos:    { icone: 'heart',          cor: ' ch-room-ic--rosa' },
    vitorias:     { icone: 'award',          cor: ' ch-room-ic--verde' },
    interesses:   { icone: 'star',           cor: ' ch-room-ic--ambar' },
    duvidas:      { icone: 'lightbulb',      cor: ' ch-room-ic--ambar' },
    experiencias: { icone: 'users',          cor: ' ch-room-ic--verde' }
  };
  function visual(id) { return VISUAL_SALA[id] || { icone: 'message-circle', cor: '' }; }

  var REGRAS_TEEN = [
    'As conversas reiniciam todo dia.',
    'Ninguém vê seu nome completo nem sua escola.',
    'Você pode sair de uma sala a qualquer momento.'
  ];
  var REGRAS_CUID = [
    'As conversas reiniciam todo dia.',
    'Ninguém vê o nome completo nem os dados do seu adolescente.',
    'Você pode sair de uma sala a qualquer momento.'
  ];

  // sinais de sofrimento — no cuidador só disparam o aceno de apoio (não alarma a
  // sala); no teen, disparam o bloqueio de segurança (ver acionarBloqueioSeguranca).
  var SINAIS_RISCO = ['me matar', 'suicíd', 'suicid', 'não aguento mais', 'nao aguento mais', 'me cortar',
    'queria morrer', 'quero morrer', 'vou morrer', 'sumir do mundo', 'acabar com tudo', 'me machucar',
    'tirar minha vida', 'não quero viver', 'nao quero viver'];

  // linguagem ofensiva/xingamento → bloqueio de segurança, só no público teen.
  // Só termos inequívocos: nada de palavra que também tenha uso comum inocente
  // (ex.: "piranha"/"corno" são ambíguas — têm sentido de bicho — e ficaram de fora).
  var PALAVRAS_OFENSIVAS = ['vai tomar no cu', 'toma no cu', 'no cu', 'cuzão', 'cuzao', 'filho da puta',
    'filha da puta', 'fdp', 'puta que pariu', 'porra', 'caralho', 'arrombado', 'arrombada', 'desgraçado',
    'desgraçada', 'vagabundo', 'vagabunda', 'otário', 'otaria', 'puta'];

  /* Termo com espaço (frase) → substring já é seguro, os espaços delimitam.
     Termo de uma palavra só → exige borda de INÍCIO de palavra (sem isso "puta"
     bloquearia "disputa"/"reputação", que não têm nada de ofensivo), mas
     permite continuar depois — é o que deixa "suicíd" pegar "suicídio",
     "suicida" etc. sem precisar listar cada inflexão. */
  function contemTermo(t, termo) {
    if (termo.indexOf(' ') !== -1) return t.indexOf(termo) !== -1;
    var e = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-zà-öø-ÿ])' + e).test(t);
  }
  // acha o termo da lista que bateu, ou null
  function primeiroTermo(lista, t) {
    for (var i = 0; i < lista.length; i++) { if (contemTermo(t, lista[i])) return lista[i]; }
    return null;
  }
  /* Devolve o trecho como o adolescente realmente escreveu (não a forma
     truncada da lista): frase → ela mesma; palavra → estende até o fim da
     palavra digitada (ex.: termo "suicíd" + texto "suicídio" → "suicídio"),
     preservando maiúsc./minúsc. do texto original. Isso vai pro aviso do
     responsável — precisa ser o que foi dito, não o gatilho interno. */
  function trechoDetectado(t, termo, textoOriginal) {
    if (termo.indexOf(' ') !== -1) return termo;
    var e = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = new RegExp('(^|[^a-zà-öø-ÿ])(' + e + '[a-zà-öø-ÿ]*)').exec(t);
    if (!m) return termo;
    return textoOriginal.substr(m.index + m[1].length, m[2].length);
  }
  // retorna { categoria: 'risco'|'ofensa', trecho } ou null — 'risco' tem prioridade
  function categoriaDeRisco(texto) {
    var t = (texto || '').toLowerCase();
    var termo = primeiroTermo(SINAIS_RISCO, t);
    if (termo) return { categoria: 'risco', trecho: trechoDetectado(t, termo, texto) };
    termo = primeiroTermo(PALAVRAS_OFENSIVAS, t);
    if (termo) return { categoria: 'ofensa', trecho: trechoDetectado(t, termo, texto) };
    return null;
  }
  function bloqueioAtivo() { return !!bloqueadoAte && new Date(bloqueadoAte) > new Date(); }

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

    var regras = cfg.publico === 'cuidador' ? REGRAS_CUID : REGRAS_TEEN;

    root.innerHTML =
      '<div class="ch-wrap">' +
        '<div class="ch-side">' +
          '<div class="ch-rooms" id="ch-rooms">' +
            '<span class="ch-rooms-tit">Salas</span>' +
            '<div id="ch-rooms-lista"></div>' +
          '</div>' +
          '<div class="ch-regras">' +
            '<span class="ch-regras-tit">' + icon('shield') + ' Como funciona aqui</span>' +
            '<ul>' + regras.map(function (r) {
              return '<li>' + icon('check') + ' ' + esc(r) + '</li>';
            }).join('') + '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="ch-main">' +
          '<div class="ch-head">' +
            '<span class="ch-head-ic" id="ch-room-ic">' + icon('message-circle') + '</span>' +
            '<div class="ch-head-info"><b id="ch-room-nome">—</b><span id="ch-room-desc"></span></div>' +
            '<span class="grow"></span>' +
            '<span class="ch-live">' + '<span class="ch-dot"></span>ao vivo</span>' +
            '<button class="cm-btn cm-btn-ghost" id="ch-resumo" type="button" title="Resumo do Lumi Theo">' + icon('sparkles') + ' Resumo</button>' +
          '</div>' +
          '<div class="ch-msgs" id="ch-msgs"></div>' +
          '<div class="ch-compose">' +
            '<button class="ch-ic-btn lumi" id="ch-lumi" type="button" title="Perguntar ao Lumi Theo (só você vê)">' + icon('sparkles') + '</button>' +
            '<input class="ch-input" id="ch-input" maxlength="1000" placeholder="Escreva uma mensagem...">' +
            '<button class="ch-ic-btn lumi" id="ch-ajuda" type="button" title="Lumi Theo me ajuda a escrever">' + icon('edit') + '</button>' +
            '<button class="ch-ic-btn send" id="ch-send" type="button" aria-label="Enviar">' + icon('send') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    el.rooms = document.getElementById('ch-rooms-lista');
    el.headIc = document.getElementById('ch-room-ic');
    el.nome = document.getElementById('ch-room-nome');
    el.desc = document.getElementById('ch-room-desc');
    el.msgs = document.getElementById('ch-msgs');
    el.input = document.getElementById('ch-input');
    el.send = document.getElementById('ch-send');
    el.ajuda = document.getElementById('ch-ajuda');
    el.lumi = document.getElementById('ch-lumi');
    el.resumo = document.getElementById('ch-resumo');

    /* A prévia nasce com a descrição da sala e é trocada pela última mensagem
       do dia quando ela chega (carregarPrevias). Assim a lista nunca aparece
       vazia enquanto a consulta não volta. */
    el.rooms.innerHTML = salas().map(function (s, i) {
      var v = visual(s.id);
      return '<button type="button" class="ch-room' + (i === 0 ? ' on' : '') + '" data-sala="' + esc(s.id) + '">' +
               '<span class="ch-room-ic' + v.cor + '">' + icon(v.icone) + '</span>' +
               '<span class="ch-room-txt">' +
                 '<span class="ch-room-nome">' + esc(s.nome) + '</span>' +
                 '<span class="ch-room-previa" data-previa="' + esc(s.id) + '">' + esc(s.desc) + '</span>' +
               '</span>' +
             '</button>';
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
    carregarPrevias();
    if (cfg.publico === 'teen') carregarBloqueio();

    window.addEventListener('beforeunload', desinscrever);
  }

  /* ---------- prévia da última mensagem de cada sala ----------
     Uma consulta só: as mensagens de hoje de TODAS as salas do público, da mais
     nova pra mais velha; a primeira que aparece de cada sala é a prévia. Sai
     bem mais barato que uma consulta por sala, e o RLS já limita ao público. */
  async function carregarPrevias() {
    if (!cfg.sb) return;
    try {
      var r = await cfg.sb.from('comunidade_chat')
        .select('sala,autor_nome,texto,criado_em')
        .eq('publico', cfg.publico)
        .gte('criado_em', inicioDoDia())
        .order('criado_em', { ascending: false }).limit(200);
      if (r.error || !r.data) return;
      var vistas = {};
      r.data.forEach(function (m) {
        if (vistas[m.sala]) return;
        vistas[m.sala] = true;
        var alvo = el.rooms && el.rooms.querySelector('[data-previa="' + m.sala.replace(/"/g, '') + '"]');
        if (alvo) alvo.textContent = primeiroNome(m.autor_nome) + ': ' + m.texto;
      });
    } catch (e) { /* prévia é enfeite: falhar aqui deixa a descrição da sala */ }
  }

  /* ---------- presença (quantas pessoas online agora) ----------
     Presence do Supabase Realtime no MESMO canal que o chat já abre. Só conta
     — nenhum nome, nenhum id de outra pessoa é exposto na tela. Se o Realtime
     não estiver disponível, o seletor simplesmente nunca é preenchido e quem
     chamou esconde o selo. */
  var aoMudarOnline = null;
  function publicarOnline() {
    if (!aoMudarOnline || !canal || !canal.presenceState) return;
    try {
      var estado = canal.presenceState() || {};
      aoMudarOnline(Object.keys(estado).length);
    } catch (e) {}
  }

  /* ---------- salas + realtime ---------- */
  function entrarSala(id) {
    salaAtual = id; vistos = {};
    unread[id] = 0; atualizarBadges();           // ao abrir a sala, zera o não-lido dela
    var s = salas().filter(function (x) { return x.id === id; })[0] || {};
    el.nome.textContent = s.nome || id;
    el.desc.textContent = s.desc || '';
    if (el.headIc) { el.headIc.innerHTML = icon(visual(id).icone); hydrate(el.headIc); }
    el.msgs.innerHTML = '<div class="ch-sys">' + icon('clock') + ' carregando conversa...</div>';
    hydrate(el.msgs);
    carregarHistorico().then(inscreverPublico);
  }

  // badge de não-lidas em cada sala da lista + total para quem quiser (a aba)
  var aoMudarNaoLidas = null;
  function atualizarBadges() {
    if (!el.rooms) return;
    var total = 0;
    el.rooms.querySelectorAll('.ch-room').forEach(function (b) {
      var sala = b.getAttribute('data-sala'), n = unread[sala] || 0;
      total += n;
      var bd = b.querySelector('.ch-badge');
      if (n > 0) {
        if (!bd) { bd = document.createElement('span'); bd.className = 'ch-badge'; b.appendChild(bd); }
        bd.textContent = n > 9 ? '9+' : String(n);
      } else if (bd) { bd.remove(); }
    });
    if (aoMudarNaoLidas) { try { aoMudarNaoLidas(total); } catch (e) {} }
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
    // `presence.key` = id do usuário: reabrir a página em outra aba conta como
    // UMA pessoa, e não como duas.
    canal = cfg.sb.channel('chat:' + cfg.publico, { config: { presence: { key: cfg.userId || 'anon' } } })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comunidade_chat', filter: 'publico=eq.' + cfg.publico },
        function (payload) {
          var m = payload.new;
          if (!m || m.publico !== cfg.publico) return;
          // prévia da lista de salas acompanha qualquer sala, não só a aberta
          var prev = el.rooms && el.rooms.querySelector('[data-previa="' + String(m.sala).replace(/"/g, '') + '"]');
          if (prev) prev.textContent = primeiroNome(m.autor_nome) + ': ' + m.texto;
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
      .on('presence', { event: 'sync' }, publicarOnline)
      .on('presence', { event: 'join' }, publicarOnline)
      .on('presence', { event: 'leave' }, publicarOnline)
      .subscribe(function (status) {
        if (status !== 'SUBSCRIBED') return;
        // Só marca presença DEPOIS de assinar — track() antes disso é ignorado.
        try { canal.track({ em: Date.now() }); } catch (e) {}
        publicarOnline();
      });
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
    div.innerHTML = '<div class="ch-bolha"><span class="ch-lumi-tag">' + icon('sparkles') + 'Lumi Theo</span>' +
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

    if (cfg.publico === 'teen' && bloqueioAtivo()) {
      mostrarErro('O chat está pausado por segurança até ' + hora(bloqueadoAte) + '.');
      return;
    }
    // teen: mensagem com sinal de risco/ofensa NUNCA chega a ser inserida na sala.
    if (cfg.publico === 'teen') {
      var deteccao = categoriaDeRisco(texto);
      if (deteccao) { el.input.value = ''; await acionarBloqueioSeguranca(deteccao.categoria, deteccao.trecho); return; }
    }

    el.input.value = ''; el.send.disabled = true;
    try {
      var r = await cfg.sb.from('comunidade_chat').insert({
        sala: salaAtual, publico: cfg.publico, autor_id: cfg.userId, autor_nome: cfg.nome, texto: texto
      }).select('id,autor_id,autor_nome,texto,criado_em').single();
      if (r.error) throw r.error;
      var vazioEl = el.msgs.querySelector('.ch-vazio'); if (vazioEl) el.msgs.innerHTML = '';
      adicionar(r.data, true); rolarFim();      // otimista (realtime fará dedupe por id)
      if (cfg.publico === 'cuidador') checarSinais(texto);
    } catch (e) {
      console.warn('[chat] enviar:', e.message);
      // bloqueio pode ter sido criado por outra aba/dispositivo entre a checagem
      // local e o insert — a RLS nega (42501) e a gente resincroniza o estado.
      if (cfg.publico === 'teen' && e.code === '42501') {
        await carregarBloqueio();
        if (bloqueioAtivo()) return;
      }
      mostrarErro('Não consegui enviar agora. Tente de novo.');
      el.input.value = texto;
    }
    el.send.disabled = false; el.input.focus();
  }

  /* ---------- bloqueio de segurança (só teen) ----------
     Ao detectar risco/ofensa, a mensagem NÃO é enviada à sala. Registra o
     bloqueio no servidor (registrar_bloqueio_chat, RPC), que também avisa o
     responsável via a tabela `alertas` já existente — o teen NÃO é informado
     desse aviso (de propósito: o bloqueio em si já é visível pra ele; o aviso
     ao responsável é feito sem alarde, pra não virar um "vou te dedurar").
     O bloqueio dura 1h e é reforçado na RLS de comunidade_chat — não dá pra
     burlar limpando estado local, porque o cliente não tem permissão de
     escrita em chat_bloqueios. */
  async function acionarBloqueioSeguranca(categoria, trecho) {
    var msg = categoria === 'ofensa'
      ? 'Essa mensagem não foi enviada porque tem uma palavra que pode machucar quem lê. Por segurança, o ' +
        'chat da comunidade vai ficar pausado por 1 hora.'
      : 'Li o que você escreveu e fico aqui com você. Você importa. Por segurança, o chat da comunidade vai ' +
        'ficar pausado por 1 hora. Se estiver muito difícil AGORA, fale com um adulto de confiança. No Brasil, ' +
        'o CVV atende no 188 (24h).';
    var bal = adicionarLumi(msg);
    if (categoria === 'risco') {
      var btns = document.createElement('div'); btns.className = 'ch-bloqueio-acoes';
      btns.innerHTML = '<a class="cm-btn cm-btn-primary ch-btn-mini" href="conversa.html">Falar com o Theo agora</a>';
      bal.querySelector('.ch-bolha').appendChild(btns);
    }

    try {
      var r = await cfg.sb.rpc('registrar_bloqueio_chat', {
        p_motivo: categoria === 'ofensa' ? 'linguagem_ofensiva_chat' : 'sinal_risco_chat',
        p_trecho: trecho || null
      });
      bloqueadoAte = (!r.error && r.data) ? r.data : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } catch (e) { bloqueadoAte = new Date(Date.now() + 60 * 60 * 1000).toISOString(); }
    mostrarBloqueioUI();
  }

  // roda ao abrir o chat: se já existe um bloqueio ativo (ex.: recarregou a página), reaplica a UI
  async function carregarBloqueio() {
    if (cfg.publico !== 'teen' || !cfg.sb) return;
    try {
      var r = await cfg.sb.from('chat_bloqueios').select('bloqueado_ate')
        .eq('id_neurodivergente', cfg.userId)
        .gt('bloqueado_ate', new Date().toISOString())
        .order('bloqueado_ate', { ascending: false }).limit(1);
      if (!r.error && r.data && r.data[0]) { bloqueadoAte = r.data[0].bloqueado_ate; mostrarBloqueioUI(); }
    } catch (e) { /* sem tabela/sem bloqueio: segue normal */ }
  }

  function mostrarBloqueioUI() {
    if (!el.input) return;
    el.input.disabled = true; el.input.value = ''; el.input.placeholder = 'Chat pausado por segurança';
    el.send.disabled = true; el.ajuda.disabled = true;
    var compose = el.msgs.parentNode.querySelector('.ch-compose');
    var velho = compose.querySelector('.ch-bloqueio'); if (velho) velho.remove();
    var d = document.createElement('div'); d.className = 'ch-bloqueio';
    atualizarBanner(d);
    compose.insertBefore(d, compose.firstChild);
    elBloqueio = d;
    clearInterval(timerBloqueio);
    timerBloqueio = setInterval(function () {
      if (!bloqueioAtivo()) { destravarChat(); return; }
      atualizarBanner(d);
    }, 15000);
  }
  function atualizarBanner(d) {
    d.innerHTML = icon('shield') + ' Chat pausado por segurança até ' + hora(bloqueadoAte) +
      '. <a class="ch-bloqueio-cta" href="conversa.html">Falar com o Theo</a>';
    hydrate(d);
  }
  function destravarChat() {
    clearInterval(timerBloqueio); bloqueadoAte = null;
    if (el.input) { el.input.disabled = false; el.input.placeholder = 'Escreva uma mensagem...'; }
    if (el.send) el.send.disabled = false;
    if (el.ajuda) el.ajuda.disabled = false;
    if (elBloqueio) { elBloqueio.remove(); elBloqueio = null; }
  }

  async function apagar(id, div) {
    if (!confirm('Apagar sua mensagem?')) return;
    try {
      var r = await cfg.sb.from('comunidade_chat').delete().eq('id', id).eq('autor_id', cfg.userId);
      if (r.error) throw r.error;
      div.remove();
    } catch (e) { console.warn('[chat] apagar:', e.message); }
  }

  /* ---------- IA (Lumi Theo) ---------- */
  function sysLumi() {
    if (cfg.publico === 'cuidador') {
      return 'Você é o Lumi Theo, orientador do LumiTEA falando em particular com um cuidador de um adolescente autista, ' +
        'dentro de um chat de comunidade. Seja prática, acolhedora e baseada em boas práticas (validação, ' +
        'previsibilidade, comunicação clara, reforço positivo, redução de sobrecarga). Não diagnostique; em crise, ' +
        'oriente buscar ajuda profissional. Português do Brasil, frases curtas, sem markdown, sem emojis.';
    }
    return 'Você é o Lumi Theo, ajudante do LumiTEA falando em particular com um adolescente autista, dentro de um chat ' +
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
    } catch (e) { mostrarErro('A ajuda do Lumi Theo não está disponível agora.'); }
    el.ajuda.disabled = false;
  }

  // pergunta privada ao Lumi Theo (resposta só pra quem perguntou; não vai pra sala)
  async function perguntarLumi() {
    var texto = (el.input.value || '').trim();
    if (!texto) { mostrarErro('Escreva sua pergunta e toque na estrelinha — só você verá a resposta.'); return; }
    el.input.value = '';
    var meu = document.createElement('div');
    meu.className = 'ch-msg eu';
    meu.innerHTML = '<div class="ch-bolha">' + escBr(texto) + '<span class="ch-hora">para o Lumi Theo</span></div>';
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

  // moderação leve do cuidador: aceno de apoio se houver sinais de sofrimento.
  // No teen isso não roda mais — vira bloqueio de segurança (acionarBloqueioSeguranca).
  function checarSinais(texto) {
    var t = (texto || '').toLowerCase();
    var achou = SINAIS_RISCO.some(function (s) { return contemTermo(t, s); });
    if (!achou) return;
    adicionarLumi('Percebi um momento difícil no que você escreveu. Você não está sozinho. Se for uma crise, ' +
      'busque apoio profissional. No Brasil, o CVV atende no 188 (24h).');
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

  return {
    iniciar: iniciar,
    /* A página decide o que fazer com os números; o chat só avisa.
       aoMudarNaoLidas(total) → badge da aba "Conversas".
       aoMudarOnline(n)       → selo "N online agora" no hero. */
    aoMudarNaoLidas: function (fn) { aoMudarNaoLidas = fn; },
    aoMudarOnline: function (fn) { aoMudarOnline = fn; publicarOnline(); }
  };
})();
