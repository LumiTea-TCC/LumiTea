/* ============================================================
   LumiTEA — js/jogos/lousa.js
   Lousa de pintar: uma folha em branco, sem tema e sem correção.

   É o único "jogo" do Theo que não é uma partida — não tem
   objetivo, placar, progresso nem fim de rodada. Por isso aqui
   não existe estado de erro: não há como fazer errado.

   Três caminhos para desenhar, porque motricidade fina varia:
     1. dedo / caneta (pointer events, com suavização);
     2. mouse;
     3. teclado — setas movem o pincel, espaço encosta e levanta.

   O desenho salvo vai para o aparelho (download em PNG) e para
   uma galeria local em localStorage. Nada é enviado ao servidor
   além do registro da sessão e do XP, como nos outros jogos.

   Carregar DEPOIS de js/jogos/base.js e js/core/ui.js.
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };

  var JOGO = 'lousa';
  var prefs = J.prefs(JOGO);

  /* Plano B do --lo-papel de css/jogos.css (o valor real é lido de lá). */
  var PAPEL_PADRAO = '#fffdf9';
  var papel = PAPEL_PADRAO;

  /* Tintas: nomeadas em voz alta pela narração e no aria-label,
     para que a escolha nunca dependa só de enxergar a cor.
     `marcaClara` diz se a marca de selecionado vai branca. */
  var CORES = [
    { chave: 'preto',      nome: 'preto',       hex: '#2b2b33', marcaClara: true },
    { chave: 'azul',       nome: 'azul',        hex: '#3f7fbf', marcaClara: true },
    { chave: 'azul-claro', nome: 'azul-claro',  hex: '#8ecdf7', marcaClara: false },
    { chave: 'verde',      nome: 'verde',       hex: '#3f9e73', marcaClara: false },
    { chave: 'amarelo',    nome: 'amarelo',     hex: '#dda423', marcaClara: false },
    { chave: 'laranja',    nome: 'laranja',     hex: '#e08e30', marcaClara: false },
    { chave: 'vermelho',   nome: 'vermelho',    hex: '#d15b4c', marcaClara: true },
    { chave: 'rosa',       nome: 'rosa',        hex: '#e987c4', marcaClara: false },
    { chave: 'roxo',       nome: 'roxo',        hex: '#7c5cbf', marcaClara: true },
    { chave: 'marrom',     nome: 'marrom',      hex: '#8d6247', marcaClara: true }
  ];

  var ESPESSURAS = [
    { chave: 'fino',   nome: 'traço fino',   px: 4,  ponto: 6 },
    { chave: 'medio',  nome: 'traço médio',  px: 10, ponto: 11 },
    { chave: 'grosso', nome: 'traço grosso', px: 22, ponto: 18 }
  ];

  var MAX_DESFAZER = 12;
  var MAX_GALERIA = 8;
  var LARGURA_MINI = 560;
  var CHAVE_GALERIA = 'lt-lousa-galeria';
  var CHAVE_XP = 'lt-lousa-xp';
  var XP_POR_DESENHO = 20;
  var XP_MAX_POR_DIA = 3;

  /* Ícones próprios da lousa (pincel, borracha e desfazer não
     existem em js/core/icons.js e são só desta página). */
  var IC = {
    pincel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20.7 3.3a1.9 1.9 0 0 0-2.7 0l-7.3 7.3 2.7 2.7 7.3-7.3a1.9 1.9 0 0 0 0-2.7z"/>' +
      '<path d="M9.4 12.2c-1.6.6-2.6 1.9-2.9 3.4-.2 1.1-.9 1.6-2.1 1.9 1.1 1.5 2.7 2.3 4.4 2.3 2.3 0 4.1-1.6 4.1-3.8"/></svg>',
    borracha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20.5 20.5H8.2l-4.6-4.6a1.4 1.4 0 0 1 0-2l8.4-8.4a1.4 1.4 0 0 1 2 0l6.6 6.6a1.4 1.4 0 0 1 0 2l-6.2 6.4"/>' +
      '<path d="M9.2 8.7 16.9 16.4"/></svg>',
    desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="m8 5-4 4 4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m5 12.5 4.5 4.5L19 7"/></svg>'
  };

  var el = {};
  var ctx = null;
  var dpr = 1;
  var pilha = [];
  var estado = {
    ferramenta: 'pincel',
    cor: CORES[1],
    espessura: ESPESSURAS[1],
    sujo: false,
    tracos: 0,
    inicio: Date.now()
  };
  var traco = { ativo: false, ponteiro: null, ult: null, meio: null };
  var teclado = { x: 0, y: 0, baixo: false };

  function porId(id) { return document.getElementById(id); }
  function avisar(txt) { if (el.aviso) el.aviso.textContent = txt; }
  function toast(msg, tipo) {
    if (g.LumiUI && g.LumiUI.toast) g.LumiUI.toast(msg, { type: tipo || 'info' });
    else avisar(msg);
  }

  /* ============================================================
     A FOLHA
     ============================================================ */
  function largura() { return el.tela.width / dpr; }
  function altura() { return el.tela.height / dpr; }

  /* Redimensiona preservando o desenho (cópia síncrona num canvas
     auxiliar — carregar uma imagem seria assíncrono e piscaria). */
  function dimensionar() {
    var caixa = el.telaCx.getBoundingClientRect();
    var l = Math.max(1, Math.round(caixa.width));
    var a = Math.max(1, Math.round(caixa.height));
    dpr = Math.min(g.devicePixelRatio || 1, 2);
    if (el.tela.width === Math.round(l * dpr) && el.tela.height === Math.round(a * dpr)) return;

    var copia = null;
    if (el.tela.width && el.tela.height) {
      copia = document.createElement('canvas');
      copia.width = el.tela.width;
      copia.height = el.tela.height;
      copia.getContext('2d').drawImage(el.tela, 0, 0);
    }

    el.tela.width = Math.round(l * dpr);
    el.tela.height = Math.round(a * dpr);
    ctx = el.tela.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = papel;
    ctx.fillRect(0, 0, l, a);
    if (copia) ctx.drawImage(copia, 0, 0, l, a);
    aplicarPincel();

    teclado.x = Math.min(teclado.x || l / 2, l);
    teclado.y = Math.min(teclado.y || a / 2, a);
    posicionarCursor();
  }

  function aplicarPincel() {
    if (!ctx) return;
    ctx.strokeStyle = estado.ferramenta === 'borracha' ? papel : estado.cor.hex;
    ctx.lineWidth = estado.ferramenta === 'borracha' ? estado.espessura.px * 1.8 : estado.espessura.px;
  }

  function folhaLimpa(marcarLimpo) {
    if (!ctx) return;
    ctx.fillStyle = papel;
    ctx.fillRect(0, 0, largura(), altura());
    aplicarPincel();
    if (marcarLimpo) estado.sujo = false;
  }

  /* ============================================================
     DESFAZER — pilha de instantâneos (só na memória)
     ============================================================ */
  function instantaneo() {
    try { pilha.push(el.tela.toDataURL('image/png')); } catch (e) { return; }
    if (pilha.length > MAX_DESFAZER) pilha.shift();
    pintarDesfazer();
  }

  function desfazer() {
    if (!pilha.length) return;
    var url = pilha.pop();
    var img = new Image();
    img.onload = function () {
      folhaLimpa(false);
      ctx.drawImage(img, 0, 0, largura(), altura());
    };
    img.src = url;
    if (!pilha.length) estado.sujo = false;
    pintarDesfazer();
    avisar('Último traço desfeito.');
  }

  function pintarDesfazer() {
    if (el.btnDesfazer) el.btnDesfazer.disabled = pilha.length === 0;
  }

  /* ============================================================
     DESENHAR (dedo, caneta, mouse)
     ============================================================ */
  function ponto(e) {
    var r = el.tela.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function meio(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function comecar(p) {
    instantaneo();
    estado.sujo = true;
    estado.tracos++;
    traco.ativo = true;
    traco.ult = p;
    traco.meio = p;
    aplicarPincel();
    /* um toque parado também deixa marca: ponto com a ponta redonda */
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function seguir(p) {
    if (!traco.ativo) return;
    var m = meio(traco.ult, p);
    ctx.beginPath();
    ctx.moveTo(traco.meio.x, traco.meio.y);
    ctx.quadraticCurveTo(traco.ult.x, traco.ult.y, m.x, m.y);
    ctx.stroke();
    traco.meio = m;
    traco.ult = p;
  }

  function terminar() {
    traco.ativo = false;
    traco.ponteiro = null;
  }

  /* Os listeners de mover/soltar ficam no document (mesmo padrão do
     J.arrastar de base.js): a mão que sai da folha no meio do traço
     continua desenhando e volta sem perder o movimento — e o traço
     nunca fica "preso" se o dedo for solto fora da página. */
  function ligarPonteiro() {
    function mover(e) {
      if (!traco.ativo || e.pointerId !== traco.ponteiro) return;
      e.preventDefault();
      seguir(ponto(e));
    }
    function soltar(e) {
      if (e.pointerId !== traco.ponteiro) return;
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      terminar();
    }
    el.tela.addEventListener('pointerdown', function (e) {
      if (traco.ativo) return;
      e.preventDefault();
      traco.ponteiro = e.pointerId;
      J.som.destravar();
      comecar(ponto(e));
      avisar('');
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
      document.addEventListener('pointercancel', soltar);
    });
  }

  /* ============================================================
     DESENHAR PELO TECLADO
     Setas movem o pincel; espaço/enter encosta e levanta.
     ============================================================ */
  var PASSO = 14;
  var PASSO_FINO = 4;

  function posicionarCursor() {
    if (!el.cursor) return;
    el.cursor.style.left = teclado.x + 'px';
    el.cursor.style.top = teclado.y + 'px';
    el.cursor.classList.toggle('baixo', teclado.baixo);
  }

  function mostrarCursor(mostrar) {
    if (!el.cursor) return;
    el.cursor.hidden = !mostrar;
    if (mostrar) posicionarCursor();
  }

  function moverTeclado(dx, dy) {
    var alvo = {
      x: Math.max(0, Math.min(largura(), teclado.x + dx)),
      y: Math.max(0, Math.min(altura(), teclado.y + dy))
    };
    if (teclado.baixo) seguir(alvo);
    teclado.x = alvo.x;
    teclado.y = alvo.y;
    posicionarCursor();
  }

  function alternarCaneta() {
    if (teclado.baixo) {
      terminar();
      teclado.baixo = false;
      avisar('Pincel levantado. Use as setas para mover, espaço para desenhar de novo.');
    } else {
      comecar({ x: teclado.x, y: teclado.y });
      teclado.baixo = true;
      avisar('Pincel encostado no papel. As setas agora desenham.');
    }
    posicionarCursor();
  }

  function ligarTeclado() {
    el.tela.addEventListener('focus', function () {
      mostrarCursor(true);
      avisar('Setas movem o pincel. Espaço encosta e levanta o pincel.');
    });
    el.tela.addEventListener('blur', function () {
      if (teclado.baixo) { terminar(); teclado.baixo = false; }
      mostrarCursor(false);
      avisar('');
    });
    el.tela.addEventListener('keydown', function (e) {
      var passo = e.shiftKey ? PASSO_FINO : PASSO;
      if (e.key === 'ArrowLeft') { e.preventDefault(); moverTeclado(-passo, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); moverTeclado(passo, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moverTeclado(0, -passo); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); moverTeclado(0, passo); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternarCaneta(); }
    });
  }

  /* ============================================================
     FERRAMENTAS, ESPESSURA E TINTAS
     ============================================================ */
  function escolherFerramenta(chave) {
    estado.ferramenta = chave;
    prefs.set('ferramenta', chave);
    el.ferramentas.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-ferr') === chave ? 'true' : 'false');
    });
    aplicarPincel();
    avisar(chave === 'borracha' ? 'Borracha escolhida.' : 'Pincel escolhido.');
  }

  function escolherEspessura(chave) {
    var esp = ESPESSURAS[1];
    ESPESSURAS.forEach(function (x) { if (x.chave === chave) esp = x; });
    estado.espessura = esp;
    prefs.set('espessura', esp.chave);
    Array.prototype.forEach.call(el.espessuras.children, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-esp') === esp.chave ? 'true' : 'false');
    });
    aplicarPincel();
  }

  function escolherCor(chave) {
    var cor = CORES[1];
    CORES.forEach(function (c) { if (c.chave === chave) cor = c; });
    estado.cor = cor;
    prefs.set('cor', cor.chave);
    Array.prototype.forEach.call(el.cores.children, function (b) {
      var sel = b.getAttribute('data-cor') === cor.chave;
      b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      b.innerHTML = sel ? IC.check : '';
    });
    /* a tinta escolhida já implica o pincel: escolher cor sai da borracha */
    if (estado.ferramenta === 'borracha') escolherFerramenta('pincel');
    aplicarPincel();
    J.som.falar(cor.nome);
    avisar('Tinta ' + cor.nome + '.');
  }

  function montarCores() {
    CORES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lo-cor';
      b.setAttribute('data-cor', c.chave);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Tinta ' + c.nome);
      b.title = 'Tinta ' + c.nome;
      b.style.setProperty('--lo-tinta', c.hex);
      b.style.setProperty('color', c.marcaClara ? '#ffffff' : '#2b2b33');
      b.addEventListener('click', function () {
        J.som.destravar();
        escolherCor(c.chave);
      });
      el.cores.appendChild(b);
    });
  }

  function montarEspessuras() {
    ESPESSURAS.forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lo-esp';
      b.setAttribute('data-esp', x.chave);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', x.nome);
      b.title = x.nome;
      b.style.setProperty('--lo-ponto', x.ponto + 'px');
      b.innerHTML = '<span aria-hidden="true"></span>';
      b.addEventListener('click', function () { escolherEspessura(x.chave); });
      el.espessuras.appendChild(b);
    });
  }

  /* ============================================================
     LIMPAR A FOLHA
     ============================================================ */
  function limpar() {
    if (!estado.sujo) { avisar('A folha já está em branco.'); return; }
    var fazer = function () {
      instantaneo();
      folhaLimpa(true);
      avisar('Folha nova. Dá para trazer o desenho de volta no botão desfazer.');
    };
    if (!g.LumiUI || !g.LumiUI.confirm) { fazer(); return; }
    g.LumiUI.confirm('Quer começar uma folha nova? Os desenhos que você já guardou continuam na galeria.', {
      titulo: 'Limpar a folha',
      ok: 'Sim, folha nova',
      cancelar: 'Continuar desenhando'
    }).then(function (sim) { if (sim) fazer(); });
  }

  /* ============================================================
     GALERIA LOCAL (só neste aparelho)
     ============================================================ */
  function lerGaleria() {
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem(CHAVE_GALERIA) || '[]') || []; } catch (e) { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    /* nunca injetar no src algo que não seja imagem embutida */
    return lista.filter(function (it) {
      return it && typeof it.img === 'string' && it.img.indexOf('data:image/') === 0;
    });
  }

  /* Miniatura menor que a folha: localStorage tem uns 5MB no total
     e um PNG em tamanho cheio come a cota em poucos desenhos. */
  function miniatura() {
    var c = document.createElement('canvas');
    var razao = el.tela.height / el.tela.width;
    c.width = Math.min(LARGURA_MINI, el.tela.width);
    c.height = Math.round(c.width * razao);
    var cx = c.getContext('2d');
    cx.fillStyle = papel;
    cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(el.tela, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  function guardarNaGaleria(img) {
    var lista = lerGaleria();
    lista.unshift({ id: String(Date.now()), quando: new Date().toISOString(), img: img });
    while (lista.length > MAX_GALERIA) lista.pop();
    /* estourou a cota: sacrifica o desenho mais antigo e tenta de novo */
    while (lista.length) {
      try {
        localStorage.setItem(CHAVE_GALERIA, JSON.stringify(lista));
        return true;
      } catch (e) {
        lista.pop();
      }
    }
    return false;
  }

  function apagarDaGaleria(id) {
    var lista = lerGaleria().filter(function (it) { return it.id !== id; });
    try { localStorage.setItem(CHAVE_GALERIA, JSON.stringify(lista)); } catch (e) {}
    renderGaleria();
  }

  function dataCurta(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function baixar(url, nome) {
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function nomeArquivo(iso) {
    return 'lumitea-desenho-' + String(iso).replace(/[:.]/g, '-').slice(0, 19) + '.png';
  }

  function renderGaleria() {
    var lista = lerGaleria();
    if (!lista.length) {
      el.galeria.innerHTML = '<p class="lo-vazio">Nenhum desenho guardado ainda. ' +
        'Quando terminar um, toque em <b>Guardar desenho</b> — ele aparece aqui e também ' +
        'é baixado para o seu aparelho.</p>';
      return;
    }
    el.galeria.innerHTML = lista.map(function (it) {
      return '<figure class="lo-item">' +
        '<img src="' + esc(it.img) + '" alt="Desenho guardado em ' + esc(dataCurta(it.quando)) + '">' +
        '<figcaption class="lo-item-pe">' +
          '<span class="lo-item-data">' + esc(dataCurta(it.quando)) + '</span>' +
          '<span class="lo-item-acoes">' +
            '<button type="button" class="lo-mini-btn" data-baixar="' + esc(it.id) + '" ' +
              'title="Baixar de novo" aria-label="Baixar este desenho de novo">' + J.icone('download') + '</button>' +
            '<button type="button" class="lo-mini-btn" data-apagar="' + esc(it.id) + '" ' +
              'title="Tirar da galeria" aria-label="Tirar este desenho da galeria">' + J.icone('trash') + '</button>' +
          '</span>' +
        '</figcaption></figure>';
    }).join('');
    J.hidratar(el.galeria);
  }

  function ligarGaleria() {
    el.galeria.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-baixar], button[data-apagar]') : null;
      if (!btn) return;
      var idBaixar = btn.getAttribute('data-baixar');
      if (idBaixar) {
        lerGaleria().forEach(function (it) {
          if (it.id === idBaixar) baixar(it.img, nomeArquivo(it.quando));
        });
        return;
      }
      var idApagar = btn.getAttribute('data-apagar');
      if (!idApagar) return;
      var fazer = function () { apagarDaGaleria(idApagar); avisar('Desenho tirado da galeria.'); };
      if (!g.LumiUI || !g.LumiUI.confirm) { fazer(); return; }
      g.LumiUI.confirm('Quer tirar este desenho da galeria? Se você já baixou o arquivo, ele continua no seu aparelho.', {
        titulo: 'Tirar da galeria',
        ok: 'Sim, pode tirar',
        cancelar: 'Deixar aí'
      }).then(function (sim) { if (sim) fazer(); });
    });
  }

  /* ============================================================
     ANÁLISE DE RISCO (visão) — roda toda vez que um desenho é
     guardado, silenciosa, em paralelo, NUNCA bloqueia o guardar.
     Mesmo espírito do diário/roleplay/comunidade (o adolescente
     nunca sabe que foi avisado) — só que aqui o sinal não vem de
     palavra-chave, vem da IA "olhando" o desenho (único modelo com
     visão da Groq hoje, qwen/qwen3.6-27b, adicionado ao groq-proxy
     só pra esse uso).
     ============================================================ */
  async function analisarDesenhoRisco(dataUrlCompleto, dataUrlMini) {
    try {
      var LT = g.LUMITEA;
      if (!LT || !LT.groqFetch || !J.supabase || !J.usuario || !J.usuario.id) return;

      var res = await LT.groqFetch({
        model: 'qwen/qwen3.6-27b',
        messages: [
          { role: 'system', content:
            'Você analisa um desenho feito por um adolescente autista numa lousa digital de um app de apoio ' +
            'socioemocional. Olhe a imagem e responda SOMENTE com um JSON: ' +
            '{"nivel":"ok"|"atencao"|"risco","motivo":"..."}. ' +
            'Use "risco" só se o desenho sugerir de forma clara autolesão, suicídio, ou violência grave contra ' +
            'si ou terceiros. Use "atencao" para sinais mais brandos de sofrimento (tristeza intensa, ' +
            'isolamento, algo incomum que vale um olhar) sem ser uma emergência. Use "ok" pra desenhos sem ' +
            'nenhum sinal preocupante — rabiscos, formas abstratas ou sem sentido óbvio são "ok", não "atencao". ' +
            '"motivo" em no máximo 1 frase curta, em português.' },
          { role: 'user', content: [
            { type: 'text', text: 'Analise este desenho.' },
            { type: 'image_url', image_url: { url: dataUrlCompleto } }
          ] }
        ],
        max_tokens: 150, temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      if (!res.ok) return;
      var data = await res.json();
      var texto = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : '';
      if (!texto) return;

      var r = JSON.parse(texto);
      if (!r || !r.nivel || r.nivel === 'ok') return;

      var tipo = r.nivel === 'risco' ? 'crise' : 'aviso';
      var titulo = r.nivel === 'risco' ? 'Sinal de risco em um desenho' : 'Desenho pode merecer atenção';
      var descricao = r.motivo || 'A análise de imagem identificou algo que pode merecer atenção neste desenho.';

      var ins = await J.supabase.from('alertas').insert({
        id_neurodivergente: J.usuario.id, tipo: tipo, titulo: titulo, descricao: descricao,
        destino: 'responsavel', metadata: { imagem: dataUrlMini }
      }).select('id').single();
      if (ins.error) {
        console.warn('[Lousa] Não foi possível registrar alerta de segurança:', ins.error.code, '|', ins.error.message);
        return;
      }
      if (r.nivel === 'risco' && ins.data && LT.gerarAnaliseCritica) {
        LT.gerarAnaliseCritica({ idAlerta: ins.data.id, origem: 'um desenho na Lousa', categoria: 'risco', trecho: descricao });
      }
    } catch (e) {
      console.warn('[Lousa] Falha ao analisar risco do desenho:', e);
    }
  }

  /* ============================================================
     GUARDAR O DESENHO (download + galeria + XP)
     ============================================================ */
  function xpDoDia() {
    var hoje = new Date().toISOString().slice(0, 10);
    var reg = { dia: hoje, vezes: 0 };
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE_XP) || 'null');
      if (salvo && salvo.dia === hoje) reg = salvo;
    } catch (e) {}
    if (reg.vezes >= XP_MAX_POR_DIA) return null;

    var ganho = J.ganharXP(XP_POR_DESENHO);
    if (!ganho) return null;              /* sem sessão: não consome o limite */
    reg.vezes++;
    try { localStorage.setItem(CHAVE_XP, JSON.stringify(reg)); } catch (e) {}
    return ganho;
  }

  function guardar() {
    if (!estado.sujo) {
      toast('A folha ainda está em branco. Faça um traço e eu guardo pra você.', 'info');
      return;
    }
    var quando = new Date().toISOString();
    var completo = el.tela.toDataURL('image/png');
    baixar(completo, nomeArquivo(quando));

    var mini = miniatura();
    var coube = guardarNaGaleria(mini);
    renderGaleria();
    analisarDesenhoRisco(completo, mini); // silencioso, em paralelo — nunca trava o guardar

    var ganho = xpDoDia();
    J.salvarSessao({
      jogoId: JOGO,
      duracao: Math.round((Date.now() - estado.inicio) / 1000),
      pontuacao: ganho ? ganho.ganho : 0,
      acertos: estado.tracos,
      total: estado.tracos,
      terminou: true,
      extra: { tracos: estado.tracos, cor: estado.cor.chave, espessura: estado.espessura.chave }
    });

    J.som.acerto();
    if (!coube) {
      toast('Baixei o desenho pro seu aparelho, mas a galeria daqui está cheia. Apague um desenho antigo para guardar outro.', 'info');
    } else if (ganho) {
      toast('Desenho guardado! +' + ganho.ganho + ' XP' +
        (ganho.subiuNivel ? ' — você subiu para o nível ' + ganho.nivel + '!' : ''), 'success');
    } else {
      toast('Desenho guardado na galeria e baixado pro seu aparelho.', 'success');
    }
    avisar('Desenho guardado. A folha continua aí, do jeitinho que estava.');
  }

  /* ============================================================
     INÍCIO
     ============================================================ */
  J.pronto(function () {
    J.boot();

    el.telaCx = porId('tela-cx');
    el.tela = porId('tela');
    el.cursor = porId('cursor');
    el.cores = porId('cores');
    el.espessuras = porId('espessuras');
    el.galeria = porId('galeria');
    el.aviso = porId('aviso');
    el.btnDesfazer = porId('btn-desfazer');
    el.ferramentas = Array.prototype.slice.call(document.querySelectorAll('.lo-ferr'));

    /* o papel mora no CSS (--lo-papel); o JS só o lê */
    try {
      var lido = getComputedStyle(el.telaCx).getPropertyValue('--lo-papel').trim();
      if (lido) papel = lido;
    } catch (e) {}

    el.ferramentas.forEach(function (b) {
      b.innerHTML = IC[b.getAttribute('data-ferr')] + '<span>' + esc(b.getAttribute('data-rotulo')) + '</span>';
      b.addEventListener('click', function () { escolherFerramenta(b.getAttribute('data-ferr')); });
    });

    el.btnDesfazer.innerHTML = IC.desfazer;
    el.btnDesfazer.addEventListener('click', desfazer);

    var btnLimpar = porId('btn-limpar');
    btnLimpar.innerHTML = J.icone('trash');
    btnLimpar.addEventListener('click', limpar);

    J.ligarBotaoSom(porId('btn-som'));

    var btnGuardar = porId('btn-guardar');
    btnGuardar.innerHTML = J.icone('download') + '<span>Guardar desenho</span>';
    btnGuardar.addEventListener('click', guardar);

    montarCores();
    montarEspessuras();
    dimensionar();

    escolherFerramenta('pincel');
    escolherEspessura(prefs.get('espessura', 'medio'));
    escolherCor(prefs.get('cor', 'azul'));
    avisar('');
    pintarDesfazer();

    ligarPonteiro();
    ligarTeclado();
    ligarGaleria();
    renderGaleria();

    /* atalho de teclado que todo mundo já conhece */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        desfazer();
      }
    });

    /* a folha acompanha a largura da tela sem perder o desenho */
    var pendente = false;
    function aoRedimensionar() {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () { pendente = false; dimensionar(); });
    }
    if (g.ResizeObserver) new g.ResizeObserver(aoRedimensionar).observe(el.telaCx);
    else g.addEventListener('resize', aoRedimensionar);
  });
})(window);
