/* ============================================================
   LumiTEA — aba.js
   Ferramentas baseadas na Análise do Comportamento Aplicada (ABA).
   Método com base científica para apoio ao aprendizado e à
   autorregulação de pessoas autistas. A IA (Lumi Theo) está em TODAS as
   ferramentas: personaliza, gera e adapta o conteúdo ao usuário.

   Usada por ferramentas-aba.html. Adapta-se por público:
     publico = 'teen'      -> autorregulação e autonomia
     publico = 'cuidador'  -> ABC, reforço, histórias sociais, consultoria

   Tudo degrada com elegância se a IA estiver offline. Persistência
   leve (quadro de fichas / histórico ABC) via localStorage por usuário.
   Não substitui acompanhamento profissional.
   ============================================================ */
var Aba = (function () {
  'use strict';
  var LT = window.LUMITEA || {};
  var esc = LT.esc || function (s) { return String(s == null ? '' : s); };
  var escBr = LT.escBr || function (s) { return esc(s).replace(/\n/g, '<br>'); };
  function icon(n) { return (window.LUMI && LUMI.icon) ? LUMI.icon(n) : ''; }
  function hydrate(node) { if (window.LUMI && LUMI.hydrateIcons) LUMI.hydrateIcons(node || document); }

  var cfg = { sb: null, publico: 'teen', nome: 'amigo', userId: 'anon', humor: null };
  var root = null;

  /* ---------- IA ---------- */
  function baseSistema() {
    if (cfg.publico === 'cuidador') {
      return 'Você é o Lumi Theo, orientador do LumiTEA especializado em Análise do Comportamento Aplicada (ABA), ' +
        'falando com um cuidador de um adolescente autista. Use os princípios da ABA de forma prática e ética: ' +
        'análise funcional (ABC), reforço positivo, comportamento substituto, encadeamento/análise de tarefa, ' +
        'apoios visuais e antecedentes, histórias sociais. NÃO diagnostique, não prometa resultados e não ' +
        'substitua um profissional (analista do comportamento/BCBA). Em sinais de crise ou autoagressão, oriente ' +
        'buscar ajuda profissional. Português do Brasil, frases curtas e claras, sem markdown decorativo, sem emojis.';
    }
    var humorTxt = '';
    if (cfg.humor != null) {
      var labels = ['com raiva', 'ansioso(a)', 'triste', 'mais ou menos', 'bem', 'ótimo'];
      humorTxt = ' O humor recente dele(a) é "' + (labels[cfg.humor] || 'neutro') + '"; considere isso sem citar diretamente.';
    }
    return 'Você é o Lumi Theo, ajudante do LumiTEA, falando com um adolescente autista chamado ' + cfg.nome + '.' + humorTxt +
      ' Use ideias da Análise do Comportamento Aplicada de forma gentil: passos pequenos e concretos, primeiro/depois, ' +
      'reforço do esforço, autorregulação. Valide o sentimento primeiro. Você NÃO substitui acompanhamento profissional; ' +
      'em sofrimento intenso, oriente procurar um adulto de confiança. Português do Brasil, linguagem simples, ' +
      'frases curtas, sem markdown, sem emojis.';
  }

  async function chamarIA(userMsg, opts) {
    opts = opts || {};
    if (!LT.groqFetch) throw new Error('sem-ia');
    var msgs = [{ role: 'system', content: opts.sistema || baseSistema() }];
    if (opts.historico) msgs = msgs.concat(opts.historico);
    if (userMsg) msgs.push({ role: 'user', content: userMsg });
    var res = await LT.groqFetch({
      model: LT.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: msgs, max_tokens: opts.maxTokens || 600, temperature: opts.temp == null ? 0.7 : opts.temp
    });
    if (!res.ok) throw new Error('proxy ' + res.status);
    var data = await res.json();
    var t = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!t) throw new Error('vazio');
    return t.trim();
  }

  /* ---------- utilidades ---------- */
  function elFrom(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function lumiTag(txt) {
    return '<div class="aba-lumi-tag">' + icon('sparkles') + (txt || 'Lumi Theo') + '</div>';
  }
  function loading(box, msg) {
    box.hidden = false;
    box.innerHTML = '<div class="aba-load">' + icon('clock') + (msg || 'O Lumi Theo está pensando...') + '</div>';
    hydrate(box);
  }
  function erro(box, msg) {
    box.hidden = false;
    box.innerHTML = '<div class="aba-erro">' + esc(msg || 'Não consegui agora. Tente de novo em instantes.') + '</div>';
  }
  // separa linhas-passo de um texto da IA ("- ", "1.", "1)" ...)
  function extrairPassos(t) {
    return String(t).split('\n')
      .map(function (l) { return l.replace(/^\s*[-*•]?\s*\d*[.)]?\s*/, '').trim(); })
      .filter(function (l) { return l.length > 1; });
  }
  function lsGet(k, def) {
    try { var v = localStorage.getItem('aba:' + cfg.userId + ':' + k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem('aba:' + cfg.userId + ':' + k, JSON.stringify(v)); } catch (e) {}
  }

  // monta o cartão padrão de uma ferramenta; devolve o <section> e expõe o .corpo
  function bloco(t) {
    var sec = elFrom(
      '<section class="aba-tool" id="aba-' + t.id + '">' +
        '<div class="aba-tool-head">' +
          '<div class="aba-tool-ic">' + icon(t.icone) + '</div>' +
          '<div><h2>' + esc(t.titulo) + '</h2><p>' + esc(t.sub) + '</p></div>' +
        '</div>' +
        '<div class="aba-tool-corpo"></div>' +
      '</section>');
    sec.corpo = sec.querySelector('.aba-tool-corpo');
    return sec;
  }

  // checklist reaproveitável a partir de passos
  function montarChecklist(corpo, passos) {
    var done = 0, total = passos.length;
    var ul = '<ul class="aba-steps">' + passos.map(function (p, i) {
      return '<li class="aba-step" data-i="' + i + '">' +
        '<span class="aba-step-box">' + icon('check') + '</span>' +
        '<span class="aba-step-txt"><span class="aba-step-num">' + (i + 1) + '.</span>' + esc(p) + '</span></li>';
    }).join('') + '</ul>' +
    '<div class="aba-progress"><span></span></div>' +
    '<div class="aba-progress-txt">0 de ' + total + ' concluídos</div>';
    var wrap = document.createElement('div'); wrap.innerHTML = ul;
    var bar = wrap.querySelector('.aba-progress > span');
    var txt = wrap.querySelector('.aba-progress-txt');
    hydrate(wrap);
    wrap.querySelectorAll('.aba-step').forEach(function (li) {
      li.addEventListener('click', function () {
        li.classList.toggle('done');
        done = wrap.querySelectorAll('.aba-step.done').length;
        bar.style.width = Math.round(done / total * 100) + '%';
        txt.textContent = done + ' de ' + total + ' concluídos';
        if (done === total) txt.textContent = 'Tudo concluído. Muito bem!';
      });
    });
    return wrap;
  }

  /* ============================================================
     FERRAMENTAS — TEEN
     ============================================================ */

  // 1) Régua da calma (termômetro emocional + passo de regulação por IA)
  function ferRegua(corpo) {
    var niveis = [
      { v: 1, t: 'Tranquilo' }, { v: 2, t: 'Levemente tenso' }, { v: 3, t: 'Incomodado' },
      { v: 4, t: 'Muito agitado' }, { v: 5, t: 'No limite' }
    ];
    corpo.innerHTML =
      '<p style="color:var(--text-muted);font-size:.85rem;margin:0 0 10px;">Quão agitado(a) você está agora? Toque no número.</p>' +
      '<div class="aba-chips">' + niveis.map(function (n) {
        return '<button class="aba-chip" data-v="' + n.v + '">' + n.v + ' · ' + esc(n.t) + '</button>';
      }).join('') + '</div>' +
      '<div class="aba-result" hidden></div>';
    var box = corpo.querySelector('.aba-result');
    corpo.querySelectorAll('.aba-chip').forEach(function (c) {
      c.addEventListener('click', async function () {
        corpo.querySelectorAll('.aba-chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        var v = c.getAttribute('data-v');
        loading(box, 'O Lumi Theo está pensando num passo pra você...');
        try {
          var pedido = 'Estou num nível ' + v + ' de 5 de agitação (5 = no limite). ' +
            'Valide em 1 frase curta e me dê UM passo concreto de autorregulação que eu consiga fazer agora, ' +
            'em 1 ou 2 frases. Sem listas.';
          var t = await chamarIA(pedido, { maxTokens: 200, temp: 0.7 });
          box.innerHTML = lumiTag('Pra agora') + '<p>' + escBr(t) + '</p>' +
            '<div class="aba-btn-row"><button class="cm-btn cm-btn-ghost" id="aba-ir-respira">' + icon('activity') + ' Respirar comigo</button></div>';
          hydrate(box);
          var ir = box.querySelector('#aba-ir-respira');
          if (ir) ir.addEventListener('click', function () {
            var alvo = document.getElementById('aba-respiracao');
            if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        } catch (e) {
          box.innerHTML = lumiTag('Pra agora') + '<p>Respira fundo. Você consegue dar um passo de cada vez. ' +
            'Que tal experimentar a respiração guiada aqui embaixo?</p>';
          hydrate(box);
        }
      });
    });
  }

  // 2) Respiração guiada 4-7-8 (regulação sensorial; respeita modo calmo)
  function ferRespiracao(corpo) {
    corpo.innerHTML =
      '<div class="aba-breath">' +
        '<div class="aba-breath-circle" id="aba-bc">Pronto?</div>' +
        '<div class="aba-breath-phase" id="aba-bp">Toque em começar quando quiser.</div>' +
        '<div class="aba-breath-count" id="aba-bcount"></div>' +
        '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-bstart">' + icon('play') + ' Começar</button></div>' +
      '</div>';
    hydrate(corpo);
    var circle = corpo.querySelector('#aba-bc'), fase = corpo.querySelector('#aba-bp'),
        cont = corpo.querySelector('#aba-bcount'), btn = corpo.querySelector('#aba-bstart');
    var rodando = false, timer = null;
    var fases = [
      { nome: 'Inspire pelo nariz', seg: 4, cls: 'inspira', label: 'Inspire' },
      { nome: 'Segure o ar', seg: 7, cls: '', label: 'Segure' },
      { nome: 'Solte devagar pela boca', seg: 8, cls: 'expira', label: 'Solte' }
    ];
    var fi = 0, sec = 0;
    function tick() {
      if (!rodando) return;
      var f = fases[fi];
      if (sec === 0) { fase.textContent = f.nome; circle.className = 'aba-breath-circle ' + f.cls; circle.textContent = f.label; }
      cont.textContent = (f.seg - sec);
      sec++;
      if (sec > f.seg) { sec = 0; fi = (fi + 1) % fases.length; }
      timer = setTimeout(tick, 1000);
    }
    function parar() {
      rodando = false; clearTimeout(timer);
      circle.className = 'aba-breath-circle'; circle.textContent = 'Pronto?';
      fase.textContent = 'Quando quiser, comece de novo.'; cont.textContent = '';
      btn.innerHTML = icon('play') + ' Começar'; hydrate(btn);
    }
    btn.addEventListener('click', function () {
      if (rodando) { parar(); return; }
      rodando = true; fi = 0; sec = 0;
      btn.innerHTML = icon('x') + ' Parar'; hydrate(btn);
      tick();
    });
  }

  // 3) Primeiro / Depois (Premack) — IA monta o plano e quebra em passos
  function ferPrimeiroDepois(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>O que está difícil de fazer?</label>' +
        '<input class="aba-input" id="aba-ft-tarefa" maxlength="120" placeholder="Ex: começar a lição de matemática"></div>' +
      '<div class="aba-field"><label>O que você curte fazer depois? (sua recompensa)</label>' +
        '<input class="aba-input" id="aba-ft-rec" maxlength="120" placeholder="Ex: jogar 20 minutos"></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-ft-go">' + icon('sparkles') + ' Montar meu plano</button></div>' +
      '<div class="aba-result" hidden></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    corpo.querySelector('#aba-ft-go').addEventListener('click', async function () {
      var tarefa = corpo.querySelector('#aba-ft-tarefa').value.trim();
      var rec = corpo.querySelector('#aba-ft-rec').value.trim();
      if (!tarefa) { corpo.querySelector('#aba-ft-tarefa').focus(); return; }
      loading(box);
      try {
        var pedido = 'Tarefa difícil: "' + tarefa + '". Recompensa que eu gosto: "' + (rec || 'algo que eu goste') + '". ' +
          'Quebre a tarefa em no máximo 4 passos bem pequenos e concretos. Responda SÓ os passos, um por linha, começando com "- ".';
        var t = await chamarIA(pedido, { maxTokens: 300, temp: 0.6 });
        var passos = extrairPassos(t).slice(0, 5);
        box.hidden = false;
        box.innerHTML =
          '<div class="aba-firstthen">' +
            '<div class="aba-ft-card"><div class="aba-ft-label">Primeiro</div><div class="aba-ft-val">' + esc(tarefa) + '</div></div>' +
            '<div class="aba-ft-arrow">' + icon('chevron-right') + '</div>' +
            '<div class="aba-ft-card depois"><div class="aba-ft-label">Depois</div><div class="aba-ft-val">' + esc(rec || 'sua recompensa') + '</div></div>' +
          '</div>' +
          '<h4 style="margin-top:14px;">Passos pra começar:</h4>';
        box.appendChild(montarChecklist(box, passos));
        hydrate(box);
      } catch (e) { erro(box); }
    });
  }

  // 4) Passo a passo (análise de tarefa / encadeamento)
  function ferPassoAPasso(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>O que você precisa fazer?</label>' +
        '<input class="aba-input" id="aba-pp-tarefa" maxlength="140" placeholder="Ex: arrumar a mochila pra amanhã"></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-pp-go">' + icon('list') + ' Gerar os passos</button></div>' +
      '<div class="aba-result" hidden></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    corpo.querySelector('#aba-pp-go').addEventListener('click', async function () {
      var tarefa = corpo.querySelector('#aba-pp-tarefa').value.trim();
      if (!tarefa) { corpo.querySelector('#aba-pp-tarefa').focus(); return; }
      loading(box, 'Quebrando em passos pequenos...');
      try {
        var pedido = 'Quebre esta tarefa em passos bem pequenos, claros e em ordem (análise de tarefa): "' + tarefa + '". ' +
          'No máximo 7 passos. Responda SÓ os passos, um por linha, começando com "- ".';
        var t = await chamarIA(pedido, { maxTokens: 350, temp: 0.5 });
        var passos = extrairPassos(t).slice(0, 8);
        box.hidden = false; box.innerHTML = lumiTag('Seu passo a passo');
        box.appendChild(montarChecklist(box, passos));
        hydrate(box);
      } catch (e) { erro(box); }
    });
  }

  // 5) Quadro de fichas (token economy) — persiste; IA sugere recompensa
  function ferFichas(corpo) {
    var st = lsGet('fichas', { meta: '', total: 5, ganhas: 0 });
    function salvar() {
      lsSet('fichas', st);                                   // cache local
      if (cfg.sb) {                                          // persiste no banco (fire-and-forget)
        cfg.sb.from('aba_fichas').upsert({
          id_neurodivergente: cfg.userId, meta: st.meta, total: st.total, ganhas: st.ganhas
        }).then(function () {}, function () {});
      }
    }
    function render() {
      var atingiu = st.ganhas >= st.total;
      corpo.innerHTML =
        '<div class="aba-field"><label>Quando eu encher as fichas, eu ganho:</label>' +
          '<div class="aba-row"><input class="aba-input grow" id="aba-fc-meta" maxlength="100" placeholder="Ex: escolher o filme da noite" value="' + esc(st.meta) + '">' +
          '<button class="cm-btn cm-btn-ghost" id="aba-fc-ia">' + icon('sparkles') + ' Sugerir</button></div></div>' +
        '<div class="aba-row" style="margin:6px 0 2px;"><label style="margin:0;font-size:.82rem;font-weight:700;color:var(--text-soft);">Fichas pra encher:</label>' +
          '<button class="cm-btn cm-btn-ghost" id="aba-fc-menos" style="min-height:38px;padding:6px 14px;">−</button>' +
          '<b id="aba-fc-num">' + st.total + '</b>' +
          '<button class="cm-btn cm-btn-ghost" id="aba-fc-mais" style="min-height:38px;padding:6px 14px;">+</button></div>' +
        '<div class="aba-tokens" id="aba-fc-tokens"></div>' +
        (atingiu
          ? '<div class="aba-token-goal">' + icon('award') + ' Você conquistou: ' + (esc(st.meta) || 'sua recompensa') + '! Quer reiniciar?</div>'
          : '') +
        '<div class="aba-btn-row">' +
          '<button class="cm-btn cm-btn-primary" id="aba-fc-add">' + icon('plus') + ' Ganhei uma ficha</button>' +
          '<button class="cm-btn cm-btn-ghost" id="aba-fc-reset">' + icon('refresh') + ' Reiniciar</button></div>' +
        '<div class="aba-result" hidden></div>';
      var tk = corpo.querySelector('#aba-fc-tokens'), html = '';
      for (var i = 0; i < st.total; i++) {
        html += '<div class="aba-token' + (i < st.ganhas ? ' on' : '') + '">' + icon(i < st.ganhas ? 'star' : 'plus') + '</div>';
      }
      tk.innerHTML = html;
      hydrate(corpo);
      var meta = corpo.querySelector('#aba-fc-meta');
      meta.addEventListener('change', function () { st.meta = meta.value.trim(); salvar(); });
      corpo.querySelector('#aba-fc-mais').addEventListener('click', function () { if (st.total < 12) { st.total++; salvar(); render(); } });
      corpo.querySelector('#aba-fc-menos').addEventListener('click', function () { if (st.total > 1) { st.total--; if (st.ganhas > st.total) st.ganhas = st.total; salvar(); render(); } });
      corpo.querySelector('#aba-fc-add').addEventListener('click', function () { st.meta = meta.value.trim(); if (st.ganhas < st.total) st.ganhas++; salvar(); render(); });
      corpo.querySelector('#aba-fc-reset').addEventListener('click', function () { st.ganhas = 0; salvar(); render(); });
      corpo.querySelector('#aba-fc-ia').addEventListener('click', async function () {
        var box = corpo.querySelector('.aba-result');
        loading(box, 'Pensando em recompensas legais...');
        try {
          var t = await chamarIA('Me dê 3 ideias curtas de recompensas saudáveis que um adolescente pode ganhar ao cumprir uma meta (nada de dinheiro). Uma por linha, começando com "- ".', { maxTokens: 150, temp: 0.9 });
          var ideias = extrairPassos(t).slice(0, 3);
          box.hidden = false; box.innerHTML = lumiTag('Ideias de recompensa') +
            '<div class="aba-chips">' + ideias.map(function (x) { return '<button class="aba-chip" type="button">' + esc(x) + '</button>'; }).join('') + '</div>';
          box.querySelectorAll('.aba-chip').forEach(function (b) {
            b.addEventListener('click', function () { meta.value = b.textContent; st.meta = b.textContent; salvar(); box.hidden = true; });
          });
        } catch (e) { erro(box); }
      });
    }
    // carrega do Supabase primeiro (cai pro cache local em caso de erro)
    if (cfg.sb) {
      cfg.sb.from('aba_fichas').select('meta,total,ganhas').eq('id_neurodivergente', cfg.userId).maybeSingle()
        .then(function (r) {
          if (r && r.data) st = { meta: r.data.meta || '', total: r.data.total || 5, ganhas: r.data.ganhas || 0 };
          render();
        }, function () { render(); });
    } else { render(); }
  }

  // 6) Cantinho da calma — IA monta um kit pessoal a partir dos sentidos preferidos
  function ferCantinho(corpo) {
    var sentidos = ['Música baixa', 'Silêncio', 'Luz mais fraca', 'Objeto macio', 'Apertar algo', 'Andar/movimento', 'Água/banho', 'Desenhar', 'Ficar sozinho(a)', 'Abraço'];
    corpo.innerHTML =
      '<p style="color:var(--text-muted);font-size:.85rem;margin:0 0 10px;">O que te acalma? Toque no que combina com você.</p>' +
      '<div class="aba-chips">' + sentidos.map(function (s) { return '<button class="aba-chip" type="button">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-cc-go">' + icon('heart') + ' Montar meu cantinho</button></div>' +
      '<div class="aba-result" hidden></div>';
    var box = corpo.querySelector('.aba-result');
    corpo.querySelectorAll('.aba-chip').forEach(function (c) { c.addEventListener('click', function () { c.classList.toggle('on'); }); });
    corpo.querySelector('#aba-cc-go').addEventListener('click', async function () {
      var sel = Array.prototype.map.call(corpo.querySelectorAll('.aba-chip.on'), function (c) { return c.textContent; });
      if (!sel.length) { box.hidden = false; box.innerHTML = '<div class="aba-erro">Escolha pelo menos uma coisa que te acalma.</div>'; return; }
      loading(box, 'Montando seu cantinho da calma...');
      try {
        var pedido = 'Coisas que me acalmam: ' + sel.join(', ') + '. ' +
          'Monte um "cantinho da calma" pessoal: uma frase curta de abertura e 3 passos simples que eu posso seguir quando estiver sobrecarregado(a), usando essas preferências. Passos começando com "- ".';
        var t = await chamarIA(pedido, { maxTokens: 320, temp: 0.7 });
        var linhas = t.split('\n').filter(function (l) { return l.trim(); });
        var intro = linhas[0] && !/^\s*[-*•\d]/.test(linhas[0]) ? linhas.shift() : 'Quando pesar, este é o seu lugar seguro.';
        var passos = extrairPassos(linhas.join('\n')).slice(0, 4);
        box.hidden = false; box.innerHTML = lumiTag('Seu cantinho da calma') + '<p>' + escBr(intro) + '</p>';
        box.appendChild(montarChecklist(box, passos));
        hydrate(box);
      } catch (e) { erro(box); }
    });
  }

  /* ============================================================
     FERRAMENTAS — CUIDADOR
     ============================================================ */

  // 1) Análise ABC (antecedente–comportamento–consequência) + função provável
  function ferABC(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>Antecedente — o que aconteceu ANTES?</label>' +
        '<textarea class="aba-textarea" id="aba-abc-a" maxlength="500" placeholder="Ex: pedi para desligar o tablet e ir jantar"></textarea></div>' +
      '<div class="aba-field"><label>Comportamento — o que ele(a) fez?</label>' +
        '<textarea class="aba-textarea" id="aba-abc-b" maxlength="500" placeholder="Ex: gritou e jogou o tablet no chão"></textarea></div>' +
      '<div class="aba-field"><label>Consequência — o que aconteceu DEPOIS?</label>' +
        '<textarea class="aba-textarea" id="aba-abc-c" maxlength="500" placeholder="Ex: deixei ele(a) usar mais 5 minutos pra acalmar"></textarea></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-abc-go">' + icon('target') + ' Analisar com o Lumi Theo</button></div>' +
      '<div class="aba-result" hidden></div>' +
      '<div class="aba-hist" id="aba-abc-hist"></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    var histBox = corpo.querySelector('#aba-abc-hist');

    function pintarHist(h) {
      if (!h.length) { histBox.innerHTML = ''; return; }
      histBox.innerHTML = '<h4 style="font-family:\'Baloo 2\',sans-serif;color:var(--text-main);font-size:.95rem;margin:8px 0 4px;">Registros recentes</h4>' +
        h.slice(0, 5).map(function (r) {
          return '<div class="aba-hist-item"><div class="aba-hist-when">' + esc(r.quando) + '</div>' +
            '<div class="aba-hist-abc"><b>A:</b> ' + esc(r.a) + ' · <b>B:</b> ' + esc(r.b) + ' · <b>C:</b> ' + esc(r.c) + '</div></div>';
        }).join('');
    }
    function renderHist() {
      if (cfg.sb) {
        cfg.sb.from('aba_abc').select('antecedente,comportamento,consequencia,criado_em')
          .eq('id_cuidador', cfg.userId).order('criado_em', { ascending: false }).limit(5)
          .then(function (r) {
            if (r && r.data && r.data.length) {
              pintarHist(r.data.map(function (x) {
                return { a: x.antecedente || '', b: x.comportamento || '', c: x.consequencia || '',
                  quando: new Date(x.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) };
              }));
            } else { pintarHist(lsGet('abc', [])); }
          }, function () { pintarHist(lsGet('abc', [])); });
      } else { pintarHist(lsGet('abc', [])); }
    }
    renderHist();

    corpo.querySelector('#aba-abc-go').addEventListener('click', async function () {
      var a = corpo.querySelector('#aba-abc-a').value.trim();
      var b = corpo.querySelector('#aba-abc-b').value.trim();
      var c = corpo.querySelector('#aba-abc-c').value.trim();
      if (!b) { corpo.querySelector('#aba-abc-b').focus(); return; }
      loading(box, 'Analisando o padrão ABC...');
      try {
        var pedido = 'Análise ABC de um episódio com um adolescente autista.\n' +
          'Antecedente: ' + (a || '(não informado)') + '\nComportamento: ' + b + '\nConsequência: ' + (c || '(não informado)') + '\n\n' +
          'Responda em 4 partes curtas, cada uma com um título em maiúsculas seguido de dois pontos, nesta ordem:\n' +
          'FUNÇÃO PROVÁVEL: (fuga/esquiva, atenção, acesso a algo, ou sensorial — explique em 1 frase)\n' +
          'ANTES (prevenção): (1-2 estratégias de antecedente)\n' +
          'COMPORTAMENTO SUBSTITUTO: (o que ensinar no lugar)\n' +
          'DEPOIS (consequência): (como responder para não reforçar o comportamento difícil)';
        var t = await chamarIA(pedido, { maxTokens: 500, temp: 0.6 });
        box.hidden = false;
        box.innerHTML = lumiTag('Análise do Lumi Theo') + formatarSecoes(t);
        hydrate(box);
        // salva no histórico: cache local + banco (Supabase)
        var h = lsGet('abc', []);
        h.unshift({ a: a, b: b, c: c, quando: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) });
        lsSet('abc', h.slice(0, 20));
        if (cfg.sb) {
          cfg.sb.from('aba_abc').insert({ id_cuidador: cfg.userId, antecedente: a, comportamento: b, consequencia: c, analise: t })
            .then(function () { renderHist(); }, function () { renderHist(); });
        } else { renderHist(); }
      } catch (e) { erro(box); }
    });
  }

  // formata texto "TÍTULO: conteúdo" em h4 + p
  function formatarSecoes(t) {
    var linhas = t.split('\n').filter(function (l) { return l.trim(); });
    var out = '', achou = false;
    linhas.forEach(function (l) {
      var m = l.match(/^\s*([A-ZÀ-Ú][A-ZÀ-Ú \(\)\/]{3,40}):\s*(.*)$/);
      if (m) { achou = true; out += '<h4>' + esc(m[1].trim()) + '</h4>' + (m[2] ? '<p>' + escBr(m[2].trim()) + '</p>' : ''); }
      else out += '<p>' + escBr(l.trim()) + '</p>';
    });
    return achou ? out : '<p>' + escBr(t) + '</p>';
  }

  // 2) Plano de reforço positivo (token economy planner)
  function ferReforco(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>Comportamento que você quer incentivar</label>' +
        '<input class="aba-input" id="aba-rf-alvo" maxlength="160" placeholder="Ex: escovar os dentes sem precisar lembrar"></div>' +
      '<div class="aba-field"><label>Do que ele(a) gosta? (interesses, para escolher reforçadores)</label>' +
        '<input class="aba-input" id="aba-rf-int" maxlength="160" placeholder="Ex: dinossauros, vídeos de games, desenhar"></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-rf-go">' + icon('award') + ' Montar plano de reforço</button></div>' +
      '<div class="aba-result" hidden></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    corpo.querySelector('#aba-rf-go').addEventListener('click', async function () {
      var alvo = corpo.querySelector('#aba-rf-alvo').value.trim();
      var intr = corpo.querySelector('#aba-rf-int').value.trim();
      if (!alvo) { corpo.querySelector('#aba-rf-alvo').focus(); return; }
      loading(box, 'Montando o plano de reforço...');
      try {
        var pedido = 'Comportamento-alvo a incentivar: "' + alvo + '". Interesses: "' + (intr || 'não informados') + '". ' +
          'Monte um plano de reforço positivo prático em 3 partes com títulos em maiúsculas e dois pontos:\n' +
          'REFORÇADORES: (3 ideias ligadas aos interesses, nada de comida em excesso)\n' +
          'COMO APLICAR: (quando e como entregar o reforço, imediato e específico)\n' +
          'DESMAME: (como reduzir o reforço aos poucos quando o hábito firmar)';
        var t = await chamarIA(pedido, { maxTokens: 500, temp: 0.65 });
        box.hidden = false; box.innerHTML = lumiTag('Plano de reforço') + formatarSecoes(t); hydrate(box);
      } catch (e) { erro(box); }
    });
  }

  // 3) História social (Carol Gray style) gerada por IA
  function ferHistoria(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>Para qual situação você quer uma história social?</label>' +
        '<input class="aba-input" id="aba-hs-sit" maxlength="160" placeholder="Ex: ir ao dentista, primeiro dia de aula, esperar a vez"></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-hs-go">' + icon('book-open') + ' Criar história social</button></div>' +
      '<div class="aba-result" hidden></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    corpo.querySelector('#aba-hs-go').addEventListener('click', async function () {
      var sit = corpo.querySelector('#aba-hs-sit').value.trim();
      if (!sit) { corpo.querySelector('#aba-hs-sit').focus(); return; }
      loading(box, 'Escrevendo a história social...');
      try {
        var pedido = 'Escreva uma história social curta (estilo Carol Gray) para um adolescente autista sobre: "' + sit + '". ' +
          'Use 1ª pessoa, frases curtas, tom positivo e literal, descrevendo o que vai acontecer, como ele pode se sentir e o que pode fazer. ' +
          'No máximo 8 frases. Sem títulos, sem listas.';
        var t = await chamarIA(pedido, { maxTokens: 400, temp: 0.6 });
        box.hidden = false;
        box.innerHTML = lumiTag('História social') + '<p>' + escBr(t) + '</p>' +
          '<div class="aba-btn-row"><button class="cm-btn cm-btn-ghost" id="aba-hs-copy">' + icon('copy') + ' Copiar</button></div>';
        hydrate(box);
        box.querySelector('#aba-hs-copy').addEventListener('click', function () {
          navigator.clipboard.writeText(t).then(function () {
            var b = box.querySelector('#aba-hs-copy'); var o = b.innerHTML; b.textContent = 'Copiado!';
            setTimeout(function () { b.innerHTML = o; hydrate(b); }, 1500);
          });
        });
      } catch (e) { erro(box); }
    });
  }

  // 4) Análise de tarefa / encadeamento com hierarquia de ajuda (cuidador)
  function ferTarefaCuid(corpo) {
    corpo.innerHTML =
      '<div class="aba-field"><label>Qual habilidade você quer ensinar?</label>' +
        '<input class="aba-input" id="aba-tc-hab" maxlength="160" placeholder="Ex: lavar as mãos, amarrar o tênis, fazer um lanche"></div>' +
      '<div class="aba-btn-row"><button class="cm-btn cm-btn-primary" id="aba-tc-go">' + icon('list') + ' Quebrar em passos ensináveis</button></div>' +
      '<div class="aba-result" hidden></div>';
    hydrate(corpo);
    var box = corpo.querySelector('.aba-result');
    corpo.querySelector('#aba-tc-go').addEventListener('click', async function () {
      var hab = corpo.querySelector('#aba-tc-hab').value.trim();
      if (!hab) { corpo.querySelector('#aba-tc-hab').focus(); return; }
      loading(box, 'Fazendo a análise de tarefa...');
      try {
        var pedido = 'Faça a análise de tarefa (task analysis) da habilidade "' + hab + '" para ensinar a um adolescente autista. ' +
          'Liste os passos pequenos e observáveis, em ordem. No máximo 10 passos. Responda SÓ os passos, um por linha, começando com "- ".';
        var t = await chamarIA(pedido, { maxTokens: 450, temp: 0.5 });
        var passos = extrairPassos(t).slice(0, 12);
        box.hidden = false;
        box.innerHTML = lumiTag('Análise de tarefa') +
          '<p style="font-size:.84rem;color:var(--text-muted);">Ensine um passo de cada vez e reduza a ajuda aos poucos (dica física → gesto → verbal → sozinho).</p>';
        box.appendChild(montarChecklist(box, passos));
        hydrate(box);
      } catch (e) { erro(box); }
    });
  }

  // 5) Consultor ABA (chat com memória curta, fundamentado em ABA)
  function ferConsultor(corpo) {
    corpo.innerHTML =
      '<div class="aba-chat" id="aba-cn-chat"></div>' +
      '<div class="aba-ask"><input type="text" id="aba-cn-in" maxlength="500" placeholder="Ex: como reduzir a birra na hora de guardar o tablet?">' +
        '<button id="aba-cn-send" aria-label="Enviar">' + icon('send') + '</button></div>';
    hydrate(corpo);
    var chat = corpo.querySelector('#aba-cn-chat'), input = corpo.querySelector('#aba-cn-in'), send = corpo.querySelector('#aba-cn-send');
    var hist = [];
    function bolha(quem, txt, cls) {
      var d = document.createElement('div'); d.className = 'aba-bolha ' + cls;
      d.innerHTML = (quem ? '<b>' + esc(quem) + '</b><br>' : '') + escBr(txt);
      chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
    }
    bolha('Lumi Theo', 'Oi! Me conte uma situação concreta e eu te ajudo com estratégias de ABA — análise do que acontece antes e depois, reforço e o que ensinar no lugar.', 'lumi');
    async function enviar() {
      var q = input.value.trim(); if (!q) return; input.value = '';
      bolha(null, q, 'eu'); hist.push({ role: 'user', content: q });
      var pensando = bolha('Lumi Theo', 'pensando...', 'lumi');
      try {
        var t = await chamarIA(null, { historico: hist.slice(-10), maxTokens: 600, temp: 0.7 });
        pensando.remove(); bolha('Lumi Theo', t, 'lumi'); hist.push({ role: 'assistant', content: t });
      } catch (e) { pensando.remove(); bolha('Lumi Theo', 'Não consegui responder agora. Tenta de novo daqui a pouco?', 'lumi'); }
    }
    send.addEventListener('click', enviar);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  }

  /* ============================================================
     REGISTRO E INICIALIZAÇÃO
     ============================================================ */
  var TOOLS_TEEN = [
    { id: 'regua', icone: 'activity', titulo: 'Régua da calma', sub: 'Marque como você está e receba um passo pra se regular agora.', render: ferRegua },
    { id: 'respiracao', icone: 'heart', titulo: 'Respiração guiada', sub: 'Respire no ritmo 4-7-8 pra acalmar o corpo. Tela calma, sem pressa.', render: ferRespiracao },
    { id: 'primeiro-depois', icone: 'chevron-right', titulo: 'Primeiro, depois', sub: 'Transforme algo difícil em "primeiro isto, depois sua recompensa".', render: ferPrimeiroDepois },
    { id: 'passo-a-passo', icone: 'list', titulo: 'Passo a passo', sub: 'O Lumi Theo quebra qualquer tarefa em passos pequenos pra você marcar.', render: ferPassoAPasso },
    { id: 'fichas', icone: 'star', titulo: 'Quadro de fichas', sub: 'Junte fichas pelo seu esforço e troque por uma recompensa.', render: ferFichas },
    { id: 'cantinho', icone: 'shield', titulo: 'Cantinho da calma', sub: 'Monte um kit pessoal com o que acalma você.', render: ferCantinho }
  ];
  var TOOLS_CUID = [
    { id: 'abc', icone: 'target', titulo: 'Análise ABC', sub: 'Registre Antecedente, Comportamento e Consequência — o Lumi Theo sugere a função e estratégias.', render: ferABC },
    { id: 'reforco', icone: 'award', titulo: 'Plano de reforço positivo', sub: 'Reforçadores e plano para incentivar um comportamento, ligados aos interesses dele(a).', render: ferReforco },
    { id: 'historia', icone: 'book-open', titulo: 'História social', sub: 'Gere uma história social para preparar uma situação nova ou difícil.', render: ferHistoria },
    { id: 'tarefa', icone: 'list', titulo: 'Análise de tarefa', sub: 'Quebre uma habilidade em passos ensináveis, com hierarquia de ajuda.', render: ferTarefaCuid },
    { id: 'consultor', icone: 'message-circle', titulo: 'Consultor ABA', sub: 'Converse com o Lumi Theo sobre uma situação concreta e receba estratégias.', render: ferConsultor }
  ];

  function iniciar(opts) {
    cfg.sb = opts.sb || null;
    cfg.publico = opts.publico || 'teen';
    cfg.nome = opts.nome || (cfg.publico === 'cuidador' ? 'você' : 'amigo');
    cfg.userId = opts.userId || 'anon';
    cfg.humor = (typeof opts.humor === 'number') ? opts.humor : null;
    root = document.getElementById(opts.container || 'aba-tools');
    if (!root) return;
    var tools = cfg.publico === 'cuidador' ? TOOLS_CUID : TOOLS_TEEN;
    root.innerHTML = '';
    tools.forEach(function (t) {
      var sec = bloco(t);
      root.appendChild(sec);
      try { t.render(sec.corpo); } catch (e) { console.warn('[aba] ' + t.id + ':', e.message); }
    });
    hydrate(root);
  }

  return { iniciar: iniciar };
})();
