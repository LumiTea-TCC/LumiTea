/* ============================================================
   LumiTEA — js/jogos/roleplay.js
   Encenação de conversas do dia a dia: o Theo entra no papel de
   outra pessoa (professor, colega, atendente...) e o adolescente
   pratica o que diria. A conversa é conduzida por IA (Groq, mesmo
   proxy/chave de todo o site — window.LUMITEA.groqFetch): o
   personagem responde de verdade ao que o adolescente escreve, e
   a própria IA avalia, a cada mensagem, se o objetivo de
   comunicação daquele cenário já foi demonstrado.

   XP só é concedido quando esse objetivo é cumprido (ver
   concluirTreino) — fechar sem cumprir não pontua, mas também não
   é tratado como erro: a tela de fim fica neutra e convida a
   tentar de novo quando quiser.

   Se a IA falhar (rede/proxy fora do ar), cai num roteiro fixo de
   reserva por cenário (mesmos `respostas`/`dicas` de antes) — a
   encenação continua dando pra treinar, só que sem poder concluir
   o objetivo nessa rodada (só a IA julga isso).

   Como agora o campo de texto vira conversa livre com uma IA,
   toda mensagem do adolescente passa por uma checagem
   determinística de sinal de risco (autolesão/agressão a
   terceiros) — mesmo padrão já usado no diário e no calendário:
   nunca bloqueia, nunca avisa o adolescente, só alerta o
   responsável vinculado em silêncio.

   Carregar DEPOIS de js/core/config.js, js/core/icons.js e
   js/jogos/base.js.
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };
  var GROQ_MODEL = (g.LUMITEA && g.LUMITEA.GROQ_MODEL) || 'openai/gpt-oss-120b';

  var JOGO = 'roleplay';

  var CENARIOS = [
    {
      id: 'professor',
      tituloCard: 'Pedir ajuda a um professor',
      descCard: 'Você não entendeu o exercício e precisa pedir ajuda sem ficar com vergonha.',
      tag: 'Pedir ajuda',
      personagem: 'Professor Marcos',
      objetivo: 'você não entendeu o exercício de matemática e vai pedir ajuda ao professor.',
      abertura: 'Oi! Terminou o exercício? Ficou alguma dúvida?',
      respostas: [
        'Mostra onde você travou — não tem problema nenhum perguntar de novo.',
        'Boa pergunta. Vamos com calma, passo a passo.',
        'Isso mesmo, você está no caminho certo. Quer tentar o próximo sozinho?'
      ],
      dicas: [
        'Dica: dizer exatamente onde você travou ajuda o professor a te ajudar mais rápido.',
        'Dica: "não entendi" também é uma resposta válida — não precisa se explicar demais.',
        'Dica: se ainda tiver dúvida depois da explicação, pode pedir de novo.'
      ],
      sugestao: 'Professor, eu travei nessa parte aqui — pode explicar de novo?',
      icone: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
    },
    {
      id: 'convite',
      tituloCard: 'Recusar um convite com educação',
      descCard: 'Um colega te chamou para algo que você não quer ir. Pratique dizer não sem ser grosso.',
      tag: 'Dizer não',
      personagem: 'Bruno',
      objetivo: 'um colega te convidou para uma festa e você quer recusar com educação.',
      abertura: 'Ei! Vai ter aquela festa sábado, bora comigo?',
      respostas: [
        'Tranquilo, sem problema! Se quiser fazer outra coisa outro dia, me chama.',
        'Entendo. Obrigado por avisar de qualquer forma!',
        'Beleza, fica pra próxima então.'
      ],
      dicas: [
        'Dica: você pode recusar sem dar uma desculpa longa. "Prefiro não ir" já basta.',
        'Dica: agradecer o convite antes de recusar deixa a resposta mais leve.',
        'Dica: sugerir outra coisa mostra que você não está rejeitando a pessoa, só o evento.'
      ],
      sugestao: 'Valeu pelo convite, mas prefiro não ir dessa vez.',
      icone: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>'
    },
    {
      id: 'quebrarGelo',
      tituloCard: 'Puxar conversa com alguém novo',
      descCard: 'Uma colega nova está sentada do seu lado. Pratique puxar assunto sem travar.',
      tag: 'Quebrar o gelo',
      personagem: 'Sofia',
      objetivo: 'uma colega nova está sentada do seu lado e você quer puxar assunto.',
      abertura: '(Sofia está mexendo no caderno, meio sem graça, olhando pro lado.)',
      respostas: [
        'Oi! Também gosto disso. Faz tempo que joga?',
        'Que legal! Eu nunca tinha pensado nisso.',
        'Ah, entendi. E você, tá gostando da escola até agora?'
      ],
      dicas: [
        'Dica: uma pergunta simples sobre algo que ela está fazendo já é um bom começo.',
        'Dica: comentar algo em comum ajuda a conversa fluir.',
        'Dica: não tem problema se a conversa tiver silêncios — respire e continue quando quiser.'
      ],
      sugestao: 'Oi, posso sentar aqui? Que caderno legal, o que você está desenhando?',
      icone: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
    },
    {
      id: 'desentendimento',
      tituloCard: 'Resolver um desentendimento',
      descCard: 'Um amigo ficou chateado com você. Pratique se explicar sem brigar.',
      tag: 'Resolver conflito',
      personagem: 'Diego',
      objetivo: 'um amigo ficou chateado porque você cancelou um combinado em cima da hora.',
      abertura: 'Fiquei chateado que você cancelou sem avisar antes...',
      respostas: [
        'Entendo. Da próxima vez me avisa mais cedo, tá?',
        'Tudo bem, obrigado por explicar. Fico mais tranquilo agora.',
        'Valeu por falar isso comigo.'
      ],
      dicas: [
        'Dica: explicar o motivo sem se justificar demais mostra que você se importa.',
        'Dica: reconhecer o incômodo do outro ("entendo que isso te chateou") ajuda muito.',
        'Dica: prometer algo simples e cumprível fecha bem a conversa.'
      ],
      sugestao: 'Desculpa, surgiu um imprevisto. Da próxima vez te aviso antes.',
      icone: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
    },
    {
      id: 'loja',
      tituloCard: 'Pedir algo em uma loja',
      descCard: 'Você quer trocar um produto com defeito. Pratique explicar o problema à atendente.',
      tag: 'Atendimento',
      personagem: 'Atendente Carla',
      objetivo: 'você quer trocar um produto que veio com defeito.',
      abertura: 'Oi, bem-vindo! Posso ajudar em alguma coisa?',
      respostas: [
        'Sem problema, vou verificar a troca pra você.',
        'Entendi o problema. Tem a nota fiscal com você?',
        'Perfeito, já vou resolver isso.'
      ],
      dicas: [
        'Dica: descrever o defeito de forma direta facilita o atendimento.',
        'Dica: ter a nota ou o pedido em mãos agiliza a troca.',
        'Dica: pedir educadamente já é suficiente, não precisa se desculpar por pedir.'
      ],
      sugestao: 'Oi, esse produto veio com um defeito, gostaria de trocar.',
      icone: '<path d="M3 9.5 12 4l9 5.5v8a2 2 0 0 1-2 2h-3v-6H8v6H5a2 2 0 0 1-2-2z"/>'
    },
    {
      id: 'apresentar',
      tituloCard: 'Se apresentar a alguém novo',
      descCard: 'Você entrou em um grupo novo. Pratique se apresentar de um jeito tranquilo.',
      tag: 'Se apresentar',
      personagem: 'Rafael',
      objetivo: 'você entrou em um grupo novo e quer se apresentar.',
      abertura: 'Oi, você é novo aqui né? Eu sou o Rafael.',
      respostas: [
        'Prazer! De onde você é?',
        'Legal! O que você curte fazer no tempo livre?',
        'Ah, seja bem-vindo então! Qualquer dúvida pode perguntar.'
      ],
      dicas: [
        'Dica: dizer seu nome e uma coisa curta sobre você já é uma boa apresentação.',
        'Dica: perguntar algo sobre a outra pessoa mostra interesse genuíno.',
        'Dica: não precisa falar muito — uma apresentação curta e simpática já funciona.'
      ],
      sugestao: 'Oi, eu sou o [seu nome], acabei de chegar aqui.',
      icone: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'
    },
    {
      id: 'brincadeira',
      tituloCard: 'Lidar com uma brincadeira que incomodou',
      descCard: 'Um colega fez uma brincadeira que te incomodou. Pratique colocar um limite sem brigar.',
      tag: 'Colocar limites',
      personagem: 'Léo',
      objetivo: 'um colega fez uma brincadeira que te incomodou e você quer falar isso.',
      abertura: 'Relaxa, era só brincadeira!',
      respostas: [
        'Ah desculpa, não sabia que tinha incomodado. Não faço mais.',
        'Foi mal mesmo, valeu por falar.',
        'Combinado, não vou mais falar disso.'
      ],
      dicas: [
        'Dica: dizer "isso me incomodou" é mais direto do que explicar demais o motivo.',
        'Dica: você pode aceitar que era sem querer e ainda pedir para não repetir.',
        'Dica: colocar um limite não é briga — é se cuidar.'
      ],
      sugestao: 'Sei que foi brincadeira, mas isso me incomodou. Pode parar?',
      icone: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    }
  ];

  var el = {};
  var estado = {
    cenario: null, mensagens: [], turno: 0, sugestaoAberta: false, inicio: 0, focoAntes: null,
    aguardando: false, objetivoCumprido: false, sessaoId: 0
  };
  var proximaSessaoId = 0;

  function porId(id) { return document.getElementById(id); }
  function porCenario(id) {
    for (var i = 0; i < CENARIOS.length; i++) if (CENARIOS[i].id === id) return CENARIOS[i];
    return null;
  }

  /* ============================================================
     GRADE DE CENÁRIOS
     ============================================================ */
  function montarGrade() {
    el.grade.innerHTML = CENARIOS.map(function (c) {
      return '<article class="jg-card">' +
        '<div class="jg-card-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + c.icone + '</svg></div>' +
        '<h2>' + esc(c.tituloCard) + '</h2>' +
        '<p>' + esc(c.descCard) + '</p>' +
        '<div class="jg-tags"><span class="jg-tag">' + esc(c.tag) + '</span></div>' +
        '<div class="jg-card-rodape"><button type="button" class="jg-btn jg-btn-primario" data-cenario="' + esc(c.id) + '">Começar</button></div>' +
        '</article>';
    }).join('');
    el.grade.querySelectorAll('[data-cenario]').forEach(function (btn) {
      btn.addEventListener('click', function () { abrirCenario(btn.getAttribute('data-cenario')); });
    });
  }

  /* ============================================================
     SINAIS DE RISCO (autolesão) E DE AGRESSÃO (dano a terceiros)
     Cópia local — mesmo padrão de diario.html/calendario.html,
     de propósito (evita arriscar aqueles sistemas ao mexer aqui).
     Detecção determinística, independente da IA: dispara um
     alerta silencioso pro responsável vinculado. O adolescente
     NUNCA é avisado disso e a mensagem NUNCA é bloqueada.
     ============================================================ */
  var SINAIS_AUTOLESAO = ['me matar', 'suicíd', 'suicid', 'não aguento mais', 'nao aguento mais',
    'me cortar', 'queria morrer', 'quero morrer', 'vou morrer', 'sumir do mundo', 'acabar com tudo',
    'me machucar', 'tirar minha vida', 'não quero viver', 'nao quero viver'];
  var SINAIS_AGRESSAO = ['bati em', 'bati no', 'bati na', 'agredi', 'espanquei', 'esmurrei', 'soquei',
    'dei um soco', 'dei uma surra', 'chutei ele', 'chutei ela', 'machuquei de propósito',
    'machuquei ele', 'machuquei ela', 'quebrei a cara', 'parti a cara', 'matei ele', 'matei ela',
    'matei um amigo', 'matei uma amiga', 'matei meu amigo', 'matei minha amiga'];
  function rpContemTermo(t, termo) {
    if (termo.indexOf(' ') !== -1) return t.indexOf(termo) !== -1;
    var e = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-zà-öø-ÿ])' + e).test(t);
  }
  function rpPrimeiroTermo(lista, t) {
    for (var i = 0; i < lista.length; i++) { if (rpContemTermo(t, lista[i])) return lista[i]; }
    return null;
  }
  function rpTrechoDetectado(t, termo, textoOriginal) {
    if (termo.indexOf(' ') !== -1) return termo;
    var e = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = new RegExp('(^|[^a-zà-öø-ÿ])(' + e + '[a-zà-öø-ÿ]*)').exec(t);
    if (!m) return termo;
    return textoOriginal.substr(m.index + m[1].length, m[2].length);
  }
  function categoriaRiscoRoleplay(texto) {
    var t = (texto || '').toLowerCase();
    var termo = rpPrimeiroTermo(SINAIS_AUTOLESAO, t);
    if (termo) return { categoria: 'autolesao', trecho: rpTrechoDetectado(t, termo, texto) };
    termo = rpPrimeiroTermo(SINAIS_AGRESSAO, t);
    if (termo) return { categoria: 'agressao', trecho: rpTrechoDetectado(t, termo, texto) };
    return null;
  }
  async function avisarCuidadorSeNecessario(texto) {
    try {
      var deteccao = categoriaRiscoRoleplay(texto);
      if (!deteccao) return;
      var sb = J.supabase;
      if (!sb || !J.usuario.id) return;
      var trecho = (deteccao.trecho || '').slice(0, 200);
      var autolesao = deteccao.categoria === 'autolesao';
      var tipo = autolesao ? 'crise' : 'aviso';
      var titulo = autolesao ? 'Sinal de risco no roleplay' : 'Sinal de agressão no roleplay';
      var descricao = (autolesao
        ? 'Uma mensagem no roleplay indicou possível risco (autolesão/suicídio).'
        : 'Uma mensagem no roleplay mencionou ter machucado outra pessoa.')
        + (trecho ? ' Trecho: "' + trecho + '".' : '');
      var r = await sb.from('alertas').insert({
        id_neurodivergente: J.usuario.id, tipo: tipo, titulo: titulo, descricao: descricao, destino: 'responsavel'
      });
      if (r.error) console.warn('[Roleplay] Não foi possível registrar alerta de segurança:', r.error.code, '|', r.error.message);
    } catch (e) {
      console.warn('[Roleplay] Falha ao checar sinais de segurança:', e);
    }
  }

  /* ============================================================
     IA (Groq) — persona do cenário + avaliação do objetivo
     ============================================================ */
  function montarPromptSistema(c) {
    return 'Você é "Theo", ajudando um adolescente autista brasileiro a treinar uma conversa do dia a dia ' +
      'através de uma encenação (roleplay). Nesta encenação você faz só o papel de "' + c.personagem + '".\n\n' +
      'Cena: ' + c.objetivo + '\n\n' +
      'Regras:\n' +
      '- Fale SEMPRE na primeira pessoa como ' + c.personagem + '. Nunca saia do personagem e nunca mencione ' +
      'que é uma IA.\n' +
      '- Respostas curtas (1 a 3 frases), tom natural, caloroso e apropriado pra um adolescente.\n' +
      '- Conduza a cena gentilmente na direção do objetivo, dando oportunidades reais de praticar a ' +
      'habilidade de "' + c.tag + '", sem facilitar demais nem dificultar sem necessidade.\n' +
      '- Mesmo interpretando um papel difícil (ex.: alguém chateado), nunca seja cruel ou sarcástico — ' +
      'conduza a cena para uma resolução positiva.\n' +
      '- Depois de CADA mensagem do adolescente, avalie se ele JÁ demonstrou a habilidade central desta cena ' +
      'de forma clara, mesmo que de um jeito simples ou imperfeito — não exija perfeição nem que a situação ' +
      'toda se resolva, só que a habilidade tenha aparecido.\n\n' +
      'Responda SEMPRE e SOMENTE com um JSON válido, sem nenhum texto antes ou depois e sem marcação de ' +
      'código, exatamente neste formato: {"resposta":"sua fala como ' + c.personagem + ', em português do ' +
      'Brasil","dica":"uma dica curta (1 frase) de comunicação pro adolescente, sobre o que ele acabou de ' +
      'escrever","concluido": true ou false}';
  }

  function construirHistoricoIA() {
    return estado.mensagens
      .filter(function (m) { return m.tipo === 'personagem' || m.tipo === 'usuario'; })
      .map(function (m) { return { role: m.tipo === 'usuario' ? 'user' : 'assistant', content: m.texto }; });
  }

  async function chamarGroq(systemPrompt, msgs, maxTokens) {
    async function tentar(modelo) {
      var r = await g.LUMITEA.groqFetch({
        model: modelo, max_tokens: maxTokens || 450, temperature: 0.7,
        messages: [{ role: 'system', content: systemPrompt }].concat(msgs)
      });
      if (!r.ok) {
        var corpo = await r.text().catch(function () { return ''; });
        throw new Error('HTTP ' + r.status + (corpo ? ' — ' + corpo.slice(0, 300) : ''));
      }
      var d = await r.json();
      return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    }
    try { return await tentar(GROQ_MODEL); }
    catch (e) { return await tentar('openai/gpt-oss-20b'); }
  }

  function tentarParseJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  /* Se a IA não devolver um JSON completo e válido (ex.: cortado no meio por
     falta de tokens, ou algum texto solto que não dá pra recuperar), retorna
     null — NUNCA deve aparecer um pedaço de JSON quebrado como se fosse a
     fala do personagem. null aqui é tratado pelo chamador exatamente como
     uma falha de rede: cai no roteiro de reserva do cenário. */
  function interpretarRespostaIA(texto) {
    var limpo = (texto || '').trim();
    var fence = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) limpo = fence[1].trim();
    var obj = tentarParseJSON(limpo);
    if (!obj) {
      var m = limpo.match(/\{[\s\S]*\}/);
      if (m) obj = tentarParseJSON(m[0]);
    }
    if (!obj || typeof obj.resposta !== 'string' || !obj.resposta.trim()) return null;
    return {
      resposta: obj.resposta.trim(),
      dica: obj.dica ? String(obj.dica).trim() : '',
      concluido: !!obj.concluido
    };
  }

  /* ============================================================
     ENCENAÇÃO (modal)
     ============================================================ */
  function bolhaHTML(msg, animar) {
    var classeAnim = animar && !J.calmo() ? ' lt-anim' : '';
    if (msg.tipo === 'usuario') {
      return '<div class="rp-msg rp-msg--usuario' + classeAnim + '">' +
        '<div class="rp-msg-corpo">' +
        '<span class="rp-msg-quem">Você</span>' +
        '<div class="rp-msg-bolha">' + esc(msg.texto) + '</div>' +
        '</div>' +
        '<div class="rp-msg-av"><img src="img/urso-coder.png" alt=""></div>' +
        '</div>';
    }
    if (msg.tipo === 'dica') {
      return '<div class="rp-msg rp-msg--dica' + classeAnim + '">' + J.icone('lightbulb') +
        '<span>' + esc(msg.texto) + '</span></div>';
    }
    return '<div class="rp-msg rp-msg--personagem' + classeAnim + '">' +
      '<div class="rp-msg-av" aria-hidden="true">' + J.icone('smile') + '</div>' +
      '<div class="rp-msg-corpo">' +
      '<span class="rp-msg-quem">' + esc(estado.cenario.personagem) + '</span>' +
      '<div class="rp-msg-bolha">' + esc(msg.texto) + '</div>' +
      '</div></div>';
  }

  function rolarParaFinal() {
    el.mensagens.scrollTop = el.mensagens.scrollHeight;
  }

  function adicionarMensagem(msg) {
    estado.mensagens.push(msg);
    el.mensagens.insertAdjacentHTML('beforeend', bolhaHTML(msg, true));
    rolarParaFinal();
    if ((msg.tipo === 'personagem' || msg.tipo === 'dica') && J.som.ligado()) J.som.falar(msg.texto);
  }

  function mostrarDigitando() {
    var div = document.createElement('div');
    div.className = 'rp-msg rp-msg--personagem';
    div.id = 'rp-digitando';
    div.innerHTML = '<div class="rp-msg-av" aria-hidden="true">' + J.icone('smile') + '</div>' +
      '<div class="rp-msg-corpo">' +
      '<span class="rp-msg-quem">' + esc(estado.cenario.personagem) + '</span>' +
      '<div class="rp-msg-bolha rp-digitando-pontos" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '</div></div>';
    el.mensagens.appendChild(div);
    rolarParaFinal();
  }
  function esconderDigitando() {
    var d = porId('rp-digitando');
    if (d && d.parentNode) d.parentNode.removeChild(d);
  }

  function travarCompositor(travado) {
    el.input.disabled = travado;
    el.enviarBtn.disabled = travado;
  }

  function marcarObjetivoCumprido() {
    if (estado.objetivoCumprido) return;
    estado.objetivoCumprido = true;
    el.objetivoOkTxt.textContent = 'Você já demonstrou isso! Pode continuar treinando ou concluir quando quiser.';
    el.objetivoOk.classList.remove('escondido');
  }

  function abrirCenario(id) {
    var c = porCenario(id);
    if (!c) return;
    estado.cenario = c;
    estado.mensagens = [];
    estado.turno = 0;
    estado.sugestaoAberta = false;
    estado.aguardando = false;
    estado.objetivoCumprido = false;
    estado.inicio = Date.now();
    estado.focoAntes = document.activeElement;
    estado.sessaoId = ++proximaSessaoId;

    el.avatar.innerHTML = J.icone('smile');
    el.nome.textContent = c.personagem;
    el.papel.textContent = 'papel encenado pelo Theo · ' + c.tag;
    el.cenarioInfo.innerHTML = '<b>Cenário:</b> ' + esc(c.objetivo);
    el.sugestao.classList.add('escondido');
    el.sugestaoTxt.textContent = '';
    el.objetivoOk.classList.add('escondido');
    el.input.value = '';
    travarCompositor(false);

    el.mensagens.innerHTML = '';
    adicionarMensagem({ tipo: 'personagem', texto: c.abertura });

    var calmo = J.calmo();
    el.backdrop.classList.toggle('lt-anim', !calmo);
    el.backdrop.classList.add('aberto');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclaGlobal);
    el.modal.addEventListener('keydown', trapFoco);

    el.input.focus();
  }

  function trapFoco(e) {
    if (e.key !== 'Tab') return;
    var f = el.modal.querySelectorAll('button:not(:disabled), textarea:not(:disabled), [href]');
    if (!f.length) return;
    var primeiro = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function aoTeclaGlobal(e) {
    if (e.key === 'Escape') concluirTreino();
  }

  async function enviarMensagem() {
    var texto = (el.input.value || '').trim();
    if (!texto || !estado.cenario || estado.aguardando) return;
    var c = estado.cenario;
    var sessaoId = estado.sessaoId;

    adicionarMensagem({ tipo: 'usuario', texto: texto });
    J.som.encaixe();
    avisarCuidadorSeNecessario(texto); // silencioso, em paralelo — nunca bloqueia o envio

    el.input.value = '';
    ajustarAlturaInput();
    el.sugestao.classList.add('escondido');
    estado.sugestaoAberta = false;

    estado.aguardando = true;
    travarCompositor(true);
    mostrarDigitando();

    var parsed = null;
    try {
      var respostaTexto = await chamarGroq(montarPromptSistema(c), construirHistoricoIA());
      parsed = interpretarRespostaIA(respostaTexto);
      if (!parsed) console.warn('[Roleplay] Resposta da IA não veio em JSON válido, usando roteiro de reserva:', respostaTexto);
    } catch (e) {
      console.warn('[Roleplay] Falha ao falar com a IA, usando roteiro de reserva:', e);
    }

    if (estado.sessaoId !== sessaoId) return; // o cenário mudou/fechou enquanto esperava a resposta

    esconderDigitando();
    if (parsed) {
      adicionarMensagem({ tipo: 'personagem', texto: parsed.resposta });
      if (parsed.dica) adicionarMensagem({ tipo: 'dica', texto: parsed.dica });
      if (parsed.concluido) marcarObjetivoCumprido();
    } else {
      // IA fora do ar: roteiro fixo de reserva (nunca marca o objetivo como cumprido —
      // só a IA consegue avaliar isso, então essa rodada não vai gerar XP).
      adicionarMensagem({ tipo: 'personagem', texto: c.respostas[estado.turno % c.respostas.length] });
      adicionarMensagem({ tipo: 'dica', texto: c.dicas[estado.turno % c.dicas.length] });
    }
    estado.turno++;
    estado.aguardando = false;
    travarCompositor(false);
    el.input.focus();
  }

  function pedirIdeia() {
    if (!estado.cenario) return;
    estado.sugestaoAberta = !estado.sugestaoAberta;
    if (estado.sugestaoAberta) {
      el.sugestaoTxt.textContent = '"' + estado.cenario.sugestao + '"';
      el.sugestao.classList.remove('escondido');
    } else {
      el.sugestao.classList.add('escondido');
    }
  }

  function usarSugestao() {
    if (!estado.cenario) return;
    el.input.value = estado.cenario.sugestao;
    ajustarAlturaInput();
    el.sugestao.classList.add('escondido');
    estado.sugestaoAberta = false;
    el.input.focus();
  }

  function ajustarAlturaInput() {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 120) + 'px';
  }

  /* J.ligarBotaoSom (base.js) usa os ícones 'radio'/'x' — os mesmos de
     todo jogo. Aqui o botão de som fica ao lado do X de fechar de
     verdade, e os dois ficariam idênticos quando o som está desligado.
     Reaproveita o estado/lógica real de J.som (mesma chave de
     localStorage, mesmo respeito ao modo calmo) e só troca o ícone por
     um alto-falante, que não colide com o X de fechar. */
  function ligarBotaoSomModal(btn) {
    function pintar() {
      var on = J.som.ligado();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = J.icone('volume-2');
      if (!J.som.disponivel()) {
        btn.disabled = true;
        btn.title = 'Som desligado pelo modo calmo';
        btn.setAttribute('aria-label', 'Som desligado pelo modo calmo');
      } else {
        btn.disabled = false;
        btn.title = on ? 'Desligar som' : 'Ligar som';
        btn.setAttribute('aria-label', on ? 'Desligar som e narração' : 'Ligar som e narração');
      }
    }
    btn.addEventListener('click', function () {
      var on = J.som.alternar();
      pintar();
      if (on) J.som.acerto(); else J.som.calar();
    });
    pintar();
  }

  /* ============================================================
     CONCLUIR / VOLTAR
     XP só é concedido quando a IA marcou o objetivo como cumprido
     em algum momento da conversa (estado.objetivoCumprido).
     ============================================================ */
  function botoesFimHTML() {
    return '<div class="jg-fim-btns">' +
      '<button type="button" class="jg-btn jg-btn-primario" id="rp-fim-denovo">Tentar de novo</button>' +
      '<button type="button" class="jg-btn jg-btn-secundario" id="rp-fim-outro">Escolher outro cenário</button>' +
      '<a class="jg-btn jg-btn-suave" href="games.html">Voltar aos jogos</a>' +
      '</div>';
  }

  function concluirTreino() {
    if (!estado.cenario) return;
    var c = estado.cenario;
    var falas = estado.mensagens.filter(function (m) { return m.tipo === 'usuario'; }).length;
    var sucesso = !!estado.objetivoCumprido;
    var pontuacao = sucesso ? Math.max(20, falas * 10) : 0;
    var duracao = Math.round((Date.now() - estado.inicio) / 1000);
    var ganho = pontuacao ? J.ganharXP(pontuacao) : null;

    J.salvarSessao({
      jogoId: JOGO,
      duracao: duracao,
      pontuacao: pontuacao,
      acertos: falas,
      total: falas,
      terminou: true,
      extra: { cenario: c.id, objetivoCumprido: sucesso }
    });

    el.backdrop.classList.remove('aberto', 'lt-anim');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', aoTeclaGlobal);
    el.modal.removeEventListener('keydown', trapFoco);

    mostrarFim(c, ganho, sucesso);
    estado.cenario = null;
  }

  function mostrarFim(c, ganho, sucesso) {
    el.grade.classList.add('escondido');
    if (sucesso) {
      el.fim.innerHTML =
        '<img src="img/urso-joinha.png" alt="">' +
        '<h2>Muito bem! Você treinou com ' + esc(c.personagem) + '</h2>' +
        '<p>Você praticou ' + esc(c.tag.toLowerCase()) + ' e conseguiu o objetivo da cena. Cada vez que ' +
        'você treina uma conversa difícil aqui, fica um pouco mais fácil quando ela acontecer de verdade.</p>' +
        (ganho ? '<p class="jg-xp-ganho">+' + ganho.ganho + ' XP nos jogos' +
          (ganho.subiuNivel ? ' — você subiu para o nível ' + ganho.nivel + '!' : '') + '</p>' : '') +
        botoesFimHTML();
      J.som.fim();
    } else {
      el.fim.innerHTML =
        '<img src="img/urso-conersando.png" alt="">' +
        '<h2>Tudo bem por hoje</h2>' +
        '<p>Você já começou a treinar essa conversa com ' + esc(c.personagem) + '. Sem problema nenhum sair ' +
        'agora — pode voltar e tentar de novo quando quiser, sem pressa nem contagem.</p>' +
        botoesFimHTML();
    }
    el.fim.classList.add('aberto');

    porId('rp-fim-denovo').addEventListener('click', function () { voltarEscolha(); abrirCenario(c.id); });
    porId('rp-fim-outro').addEventListener('click', voltarEscolha);
    porId('rp-fim-denovo').focus();
  }

  function voltarEscolha() {
    el.fim.classList.remove('aberto');
    el.fim.innerHTML = '';
    el.grade.classList.remove('escondido');
    if (estado.focoAntes && estado.focoAntes.focus) estado.focoAntes.focus();
  }

  /* ============================================================
     INÍCIO
     ============================================================ */
  J.pronto(function () {
    J.boot();

    el.grade = porId('rp-grade');
    el.fim = porId('rp-fim');
    el.backdrop = porId('rp-backdrop');
    el.modal = porId('rp-modal');
    el.avatar = porId('rp-avatar');
    el.nome = porId('rp-modal-nome');
    el.papel = porId('rp-papel');
    el.cenarioInfo = porId('rp-cenario-info');
    el.mensagens = porId('rp-mensagens');
    el.sugestao = porId('rp-sugestao');
    el.sugestaoTxt = porId('rp-sugestao-txt');
    el.objetivoOk = porId('rp-objetivo-ok');
    el.objetivoOkTxt = porId('rp-objetivo-ok-txt');
    el.input = porId('rp-input');
    el.enviarBtn = porId('rp-enviar');

    montarGrade();

    ligarBotaoSomModal(porId('rp-btn-som'));
    porId('rp-btn-fechar').addEventListener('click', concluirTreino);
    porId('rp-concluir-2').addEventListener('click', concluirTreino);
    porId('rp-ideia').addEventListener('click', pedirIdeia);
    porId('rp-usar-sugestao').addEventListener('click', usarSugestao);
    el.enviarBtn.addEventListener('click', enviarMensagem);
    el.backdrop.addEventListener('click', function (e) { if (e.target === el.backdrop) concluirTreino(); });

    el.input.addEventListener('input', ajustarAlturaInput);
    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
    });
  });
})(window);
