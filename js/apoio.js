/* ============================================================
   LumiTEA — apoio.js
   Aba "Apoio": dicas, conselhos e conceitos. A IA (Lumi Theo) atua
   como ajudante — gera dicas do dia e responde perguntas.
   Conteúdo e tom mudam por público (teen | cuidador).
   ============================================================ */
var Apoio = (function () {
  'use strict';
  var LT = window.LUMITEA || {};
  var esc = LT.esc || function (s) { return String(s == null ? '' : s); };
  var escBr = LT.escBr || function (s) { return esc(s).replace(/\n/g, '<br>'); };
  function icon(n) { return (window.LUMI && LUMI.icon) ? LUMI.icon(n) : ''; }

  var cfg = { publico: 'teen', nome: 'amigo', humor: null };
  var el = {};
  var historico = [];

  // Conceitos curados (sempre disponíveis, mesmo sem IA).
  var CONCEITOS_TEEN = [
    { ic: 'activity', t: 'Respiração 4-7-8', d: 'Puxe o ar em 4, segure em 7, solte em 8. Acalma o corpo quando a cabeça acelera.' },
    { ic: 'smile', t: 'Dê nome ao que sente', d: 'Antes de reagir, tente dizer "estou ansioso" ou "estou com raiva". Nomear já diminui a intensidade.' },
    { ic: 'clock', t: 'Peça uma pausa', d: 'Você pode pedir "preciso de um minuto". Pausar não é fugir — é se cuidar.' },
    { ic: 'message-circle', t: 'Roteiro social', d: 'Antes de uma conversa difícil, ensaie 1 frase de início. Ter um plano deixa tudo menos assustador.' },
    { ic: 'shield', t: 'Seus limites valem', d: 'Dizer "não" com respeito é um direito. Você não precisa explicar tudo o tempo todo.' },
    { ic: 'heart', t: 'Cuide do corpo', d: 'Água, sono e comida mudam o humor mais do que parece. Comece pelo básico nos dias difíceis.' }
  ];
  var CONCEITOS_CUID = [
    { ic: 'heart', t: 'Valide antes de corrigir', d: 'Reconheça o sentimento ("vejo que isso te frustrou") antes de propor solução. Validar abre a escuta.' },
    { ic: 'calendar', t: 'Previsibilidade acalma', d: 'Antecipe mudanças de rotina e use apoios visuais. O inesperado costuma ser o maior gatilho.' },
    { ic: 'alert-triangle', t: 'Leia os sinais de sobrecarga', d: 'Irritação, isolamento e movimentos repetitivos podem indicar sobrecarga sensorial. Reduza estímulos antes de cobrar.' },
    { ic: 'message-circle', t: 'Comunicação clara e direta', d: 'Frases curtas, uma instrução por vez, literais. Evite ironia e ordens implícitas.' },
    { ic: 'award', t: 'Celebre o pequeno', d: 'Reforce esforços concretos ("você pediu ajuda, isso foi corajoso"), não só resultados.' },
    { ic: 'user', t: 'Cuide de você também', d: 'Seu equilíbrio sustenta o cuidado. Pedir ajuda e descansar não é egoísmo.' }
  ];

  function $(id) { return document.getElementById(id); }

  function iniciar(opts) {
    cfg.publico = opts.publico || 'teen';
    cfg.nome = opts.nome || (cfg.publico === 'cuidador' ? 'você' : 'amigo');
    cfg.humor = (typeof opts.humor === 'number') ? opts.humor : null;
    el.conceitos = $('ap-conceitos'); el.dicas = $('ap-dicas');
    el.gerar = $('ap-gerar'); el.pergunta = $('ap-pergunta');
    el.enviar = $('ap-enviar'); el.conversa = $('ap-conversa');

    renderConceitos();
    if (el.gerar) el.gerar.addEventListener('click', gerarDicas);
    if (el.enviar) el.enviar.addEventListener('click', perguntar);
    if (el.pergunta) el.pergunta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); perguntar(); }
    });
  }

  function renderConceitos() {
    if (!el.conceitos) return;
    var lista = cfg.publico === 'cuidador' ? CONCEITOS_CUID : CONCEITOS_TEEN;
    el.conceitos.innerHTML = lista.map(function (c) {
      return '<div class="ap-conceito"><span class="ap-ic">' + icon(c.ic) + '</span>' +
        '<div><b>' + esc(c.t) + '</b><p>' + esc(c.d) + '</p></div></div>';
    }).join('');
    if (window.LUMI) LUMI.hydrateIcons(el.conceitos);
  }

  function sysPrompt() {
    if (cfg.publico === 'cuidador') {
      return 'Você é o Lumi Theo, orientador do LumiTEA falando com um pai/mãe/cuidador de um adolescente autista. ' +
        'Dê conselhos práticos, respeitosos e baseados em boas práticas (validação emocional, previsibilidade, ' +
        'comunicação clara e literal, redução de sobrecarga sensorial, reforço positivo). Nunca diagnostique nem ' +
        'prometa resultados; em sinais de crise, oriente buscar ajuda profissional. Português do Brasil, tom ' +
        'profissional e acolhedor, frases curtas, sem markdown, sem emojis.';
    }
    var humorTxt = '';
    if (cfg.humor != null) {
      var labels = ['com raiva', 'ansioso(a)', 'triste', 'mais ou menos', 'bem', 'ótimo'];
      humorTxt = ' O humor recente dele(a) é "' + (labels[cfg.humor] || 'neutro') + '"; leve isso em conta sem citar diretamente.';
    }
    return 'Você é o Lumi Theo, ajudando um adolescente autista chamado ' + cfg.nome + ' a se ajudar.' + humorTxt +
      ' Dê conselhos práticos e calmos, validando o sentimento primeiro, com passos simples e concretos. ' +
      'Validar o sentimento nunca é validar uma ação que machucou alguém (o próprio adolescente ou outra ' +
      'pessoa — violência, agressão física, ameaça, autolesão): acolha o sentimento por trás, mas diga com ' +
      'clareza e sem julgar a pessoa que a ação em si não foi certa, e oriente reparação ou buscar um adulto ' +
      'de confiança — nunca elogie ou trate a ação como normal. ' +
      'Você NÃO substitui acompanhamento profissional; em sofrimento intenso ou sinal de risco à própria ' +
      'vida, priorize acolhimento e oriente buscar ajuda agora (adulto de confiança ou CVV 188). Português ' +
      'do Brasil, linguagem simples, frases curtas, sem markdown, sem emojis.';
  }

  async function chamar(messages, maxTokens, temp) {
    if (!LT.groqFetch) throw new Error('sem proxy');
    var res = await LT.groqFetch({
      model: LT.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: messages, max_tokens: maxTokens || 600, temperature: temp || 0.7
    });
    if (!res.ok) throw new Error('proxy ' + res.status);
    var data = await res.json();
    var t = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    if (!t) throw new Error('vazio');
    return t.trim();
  }

  async function gerarDicas() {
    if (!el.dicas) return;
    el.gerar.disabled = true; var orig = el.gerar.innerHTML; el.gerar.textContent = 'Gerando...';
    el.dicas.innerHTML = '<div class="ap-load">' + icon('clock') + ' o Lumi Theo está pensando em dicas pra você...</div>';
    if (window.LUMI) LUMI.hydrateIcons(el.dicas);
    var pedido = cfg.publico === 'cuidador'
      ? 'Liste 3 dicas curtas e práticas que eu (cuidador) posso aplicar hoje para apoiar meu adolescente autista. Cada dica em 1 frase. Responda só as 3 dicas, uma por linha, começando com "- ".'
      : 'Me dê 3 ideias curtas e práticas pra eu cuidar de mim hoje. Cada uma em 1 frase. Responda só as 3, uma por linha, começando com "- ".';
    try {
      var t = await chamar([{ role: 'system', content: sysPrompt() }, { role: 'user', content: pedido }], 350, 0.85);
      var linhas = t.split('\n').map(function (l) { return l.replace(/^[-*\d.\)\s]+/, '').trim(); }).filter(Boolean).slice(0, 4);
      el.dicas.innerHTML = '<ul class="ap-dicas-lista">' +
        linhas.map(function (l) { return '<li>' + icon('check') + '<span>' + esc(l) + '</span></li>'; }).join('') + '</ul>';
      if (window.LUMI) LUMI.hydrateIcons(el.dicas);
    } catch (e) {
      el.dicas.innerHTML = '<div class="ap-load">Não consegui gerar dicas agora. Veja os conceitos acima — eles valem sempre.</div>';
    }
    el.gerar.disabled = false; el.gerar.innerHTML = orig;
  }

  function addBolha(quem, texto, klass) {
    var div = document.createElement('div');
    div.className = 'ap-bolha ' + klass;
    if (quem) { var b = document.createElement('b'); b.textContent = quem; div.appendChild(b); }
    var p = document.createElement('p'); p.innerHTML = escBr(texto); div.appendChild(p);
    el.conversa.appendChild(div); el.conversa.scrollTop = el.conversa.scrollHeight;
    return div;
  }

  async function perguntar() {
    var q = (el.pergunta.value || '').trim(); if (!q) return;
    el.pergunta.value = '';
    addBolha(cfg.publico === 'cuidador' ? 'Você' : 'Você', q, 'ap-eu');
    historico.push({ role: 'user', content: q });
    var pensando = addBolha('Lumi Theo', 'pensando...', 'ap-lumi ap-pensando');
    try {
      var msgs = [{ role: 'system', content: sysPrompt() }].concat(historico.slice(-10));
      var t = await chamar(msgs, 600, 0.7);
      pensando.remove();
      addBolha('Lumi Theo', t, 'ap-lumi');
      historico.push({ role: 'assistant', content: t });
    } catch (e) {
      pensando.remove();
      addBolha('Lumi Theo', 'Não consegui responder agora. Tenta de novo daqui a pouco?', 'ap-lumi');
    }
  }

  return { iniciar: iniciar };
})();
