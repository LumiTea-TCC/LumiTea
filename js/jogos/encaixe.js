/* ============================================================
   LumiTEA — js/jogos/encaixe.js
   Encaixe e correspondência peça-molde.

   Trabalha coordenação viso-motora, percepção de formas e
   reconhecimento de padrões.

   Dois modos:
     · silhueta geométrica — encaixar círculo, quadrado, triângulo
       e companhia nos contornos vazados;
     · duas peças — a figura foi cortada ao meio com um recorte
       irregular; é preciso reconhecer qual metade completa qual.

   A área de acerto é ampliada de propósito (tolerância de 40px):
   motricidade fina varia muito, e o jogo não é sobre pontaria.
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var S = J.sprites;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };

  var JOGO = 'encaixe';
  var prefs = J.prefs(JOGO);

  var FORMAS_BASE = ['circulo', 'quadrado', 'triangulo', 'estrela', 'coracao', 'losango', 'hexagono'];

  var CAMPOS = [
    {
      chave: 'modo', padrao: 'formas',
      titulo: 'Tipo de encaixe',
      dica: 'Comece pelas formas. As metades pedem mais atenção ao contorno.',
      opcoes: [
        { valor: 'formas', rotulo: 'Formas no contorno' },
        { valor: 'metades', rotulo: 'Duas metades' }
      ]
    },
    {
      chave: 'pecas', padrao: '3',
      titulo: 'Quantas peças ao mesmo tempo',
      dica: 'Três já é um bom começo. Aumente quando estiver tranquilo.',
      opcoes: [
        { valor: '3', rotulo: '3 peças' },
        { valor: '4', rotulo: '4 peças' },
        { valor: '6', rotulo: '6 peças' }
      ]
    },
    {
      chave: 'tema', padrao: 'animais',
      titulo: 'Tema das figuras',
      dica: 'Vale para o modo "duas metades".',
      opcoes: Object.keys(S.TEMAS).map(function (k) {
        return { valor: k, rotulo: S.TEMAS[k].nome };
      })
    }
  ];

  var el = {};
  var estado = { total: 0, encaixados: 0, tentativas: 0, inicio: 0, modo: 'formas' };
  var drag = null;
  var timerFim = null;

  function porId(id) { return document.getElementById(id); }
  function sorteio(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- montagem de uma partida ---------- */
  function novaPartida() {
    /* limpa o que sobrou da rodada anterior: timer de fim e peça escolhida
       (a peça velha some do DOM, mas a seleção continuaria apontando pra ela) */
    if (timerFim) { clearTimeout(timerFim); timerFim = null; }
    if (drag) drag.limparSelecao();
    J.som.calar();

    var modo = prefs.get('modo', 'formas');
    var n = parseInt(prefs.get('pecas', '3'), 10) || 3;
    var tema = prefs.get('tema', 'animais');
    if (!S.TEMAS[tema]) tema = 'animais';

    var pecas = [], moldes = [];

    if (modo === 'metades') {
      var itens = J.embaralhar(S.itens(tema)).slice(0, n);
      itens.forEach(function (it) {
        moldes.push({
          id: it.id,
          rotulo: 'Figura do ' + it.nome + ', faltando a metade da direita',
          html: '<span class="jg-meio-cx">' +
                  '<span class="jg-meio-esq" aria-hidden="true">' + it.svg + '</span>' +
                  '<span class="jg-meio-vazio" aria-hidden="true"></span>' +
                '</span>',
          preenche: '<span class="jg-meio-dir" aria-hidden="true">' + it.svg + '</span>'
        });
        pecas.push({
          id: it.id,
          rotulo: 'Metade da direita do ' + it.nome,
          fala: it.nome,
          html: '<span class="jg-meio-cx"><span class="jg-meio-dir" aria-hidden="true">' + it.svg + '</span></span>'
        });
      });
      el.instrucaoTxt.innerHTML = 'Cada figura perdeu a <b>metade da direita</b>. Encontre a metade que completa cada uma.';
    } else {
      var formas = J.embaralhar(FORMAS_BASE).slice(0, n);
      formas.forEach(function (f) {
        var cor = sorteio(S.CORES);
        moldes.push({
          id: f,
          rotulo: 'Contorno de ' + S.FORMAS[f].nome,
          html: '<span class="jg-fig-cx" aria-hidden="true">' + S.molde(f) + '</span>',
          preenche: '<span class="jg-fig-cx" aria-hidden="true">' + S.forma(f, cor.hex, 'grande') + '</span>'
        });
        pecas.push({
          id: f,
          rotulo: S.FORMAS[f].nome + ' ' + cor.nome,
          fala: S.FORMAS[f].nome,
          html: '<span class="jg-fig-cx" aria-hidden="true">' + S.forma(f, cor.hex, 'grande') + '</span>'
        });
      });
      el.instrucaoTxt.innerHTML = 'Arraste cada forma até o <b>contorno igual ao dela</b>.';
    }

    estado.total = n;
    estado.encaixados = 0;
    estado.tentativas = 0;
    estado.inicio = Date.now();
    estado.modo = modo;

    el.pecas.innerHTML = J.embaralhar(pecas).map(function (p) {
      return '<button type="button" class="jg-peca' + (modo === 'metades' ? ' jg-peca-meio' : '') + '" ' +
        'data-id="' + esc(p.id) + '" data-fala="' + esc(p.fala) + '" aria-label="' + esc(p.rotulo) + '">' +
        p.html + '</button>';
    }).join('');

    el.moldes.innerHTML = J.embaralhar(moldes).map(function (m) {
      return '<button type="button" class="jg-molde" data-id="' + esc(m.id) + '" ' +
        'data-preenche="' + esc(m.preenche) + '" aria-label="' + esc(m.rotulo) + '">' +
        m.html + '</button>';
    }).join('');

    el.palco.classList.remove('escondido');
    el.instrucao.classList.remove('escondido');
    el.fim.classList.remove('aberto');
    el.fim.innerHTML = '';
    el.aviso.textContent = 'Arraste uma peça até o molde — ou toque na peça e depois no molde.';
    atualizarProgresso();
  }

  function atualizarProgresso() {
    var pct = estado.total ? Math.round((estado.encaixados / estado.total) * 100) : 0;
    el.fill.style.width = pct + '%';
    el.progresso.setAttribute('aria-valuenow', String(pct));
    el.progressoTxt.textContent = estado.encaixados + ' de ' + estado.total +
      (estado.total === 1 ? ' peça encaixada' : ' peças encaixadas');
  }

  /* ---------- encaixar ---------- */
  function aoSoltar(peca, molde) {
    if (peca.classList.contains('colocada') || molde.classList.contains('encaixado')) return false;
    estado.tentativas++;

    if (peca.getAttribute('data-id') !== molde.getAttribute('data-id')) {
      return false;   // não é este molde: a peça volta, sem aviso de erro
    }

    /* o atributo guarda o HTML da figura completa deste molde */
    if (estado.modo === 'metades') {
      var vazio = molde.querySelector('.jg-meio-vazio');
      if (vazio) vazio.remove();
      var cx = molde.querySelector('.jg-meio-cx');
      if (cx) cx.insertAdjacentHTML('beforeend', molde.getAttribute('data-preenche'));
    } else {
      molde.innerHTML = molde.getAttribute('data-preenche');
    }
    molde.classList.add('encaixado');
    molde.setAttribute('aria-label', peca.getAttribute('aria-label') + ', encaixada');
    if (!J.calmo()) {
      molde.classList.add('jg-encaixou');
      setTimeout(function () { molde.classList.remove('jg-encaixou'); }, 320);
    }

    peca.classList.add('colocada');
    peca.classList.remove('escolhida');
    peca.disabled = true;

    estado.encaixados++;
    J.som.encaixe();
    J.som.falar(peca.getAttribute('data-fala'));
    el.aviso.textContent = peca.getAttribute('data-fala') + ' encaixou.';
    atualizarProgresso();

    if (estado.encaixados === estado.total) finalizar();
    return true;
  }

  /* ---------- fim da rodada ---------- */
  function finalizar() {
    var duracao = Math.round((Date.now() - estado.inicio) / 1000);

    J.salvarSessao({
      jogoId: JOGO,
      duracao: duracao,
      pontuacao: estado.total * 10,
      acertos: estado.total,
      total: estado.tentativas,
      terminou: true,
      extra: { modo: estado.modo, pecas: estado.total, tentativas: estado.tentativas }
    });

    timerFim = setTimeout(function () {
      timerFim = null;
      el.palco.classList.add('escondido');
      el.instrucao.classList.add('escondido');
      el.fim.innerHTML =
        '<img src="img/urso-estrelhinha.png" alt="">' +
        '<h2>Tudo no lugar!</h2>' +
        '<p>Você encaixou ' + estado.total + (estado.total === 1 ? ' peça' : ' peças') +
        '. Reconhecer contornos e encontrar onde cada coisa se encaixa é um treino e tanto.</p>' +
        '<div class="jg-fim-btns">' +
        '<button type="button" class="jg-btn jg-btn-primario" id="fim-denovo">Jogar de novo</button>' +
        '<button type="button" class="jg-btn jg-btn-secundario" id="fim-ajustes">Mudar o desafio</button>' +
        '<a class="jg-btn jg-btn-suave" href="games.html">Voltar aos jogos</a>' +
        '</div>';
      el.fim.classList.add('aberto');
      J.som.fim();

      porId('fim-denovo').addEventListener('click', novaPartida);
      porId('fim-ajustes').addEventListener('click', function () {
        novaPartida();
        abrirAjustes(true);
        porId('ajustes').scrollIntoView({ block: 'nearest' });
      });
    }, 480);
  }

  /* ---------- ajustes ---------- */
  function montarAjustes() {
    J.montarAjustes(el.campos, CAMPOS, prefs, function () { novaPartida(); });
  }
  function abrirAjustes(abrir) {
    var painel = porId('ajustes'), btn = porId('btn-ajustes');
    painel.classList.toggle('aberto', abrir);
    btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    btn.setAttribute('aria-label', abrir ? 'Fechar ajustes do jogo' : 'Abrir ajustes do jogo');
  }

  /* ---------- início ---------- */
  J.pronto(function () {
    J.boot();

    el.pecas = porId('pecas');
    el.moldes = porId('moldes');
    el.palco = porId('palco');
    el.fim = porId('fim');
    el.aviso = porId('aviso');
    el.fill = porId('progresso-fill');
    el.progresso = porId('progresso');
    el.progressoTxt = porId('progresso-txt');
    el.campos = porId('ajustes-campos');
    el.instrucao = porId('instrucao');
    el.instrucaoTxt = porId('instrucao-txt');

    var btnReiniciar = porId('btn-reiniciar');
    btnReiniciar.innerHTML = J.icone('refresh-cw');
    btnReiniciar.addEventListener('click', novaPartida);

    J.ligarBotaoSom(porId('btn-som'));

    var btnAjustes = porId('btn-ajustes');
    btnAjustes.innerHTML = J.icone('sliders');
    btnAjustes.addEventListener('click', function () {
      abrirAjustes(!porId('ajustes').classList.contains('aberto'));
    });

    el.pecas.addEventListener('pointerdown', function (e) {
      var p = e.target.closest ? e.target.closest('.jg-peca') : null;
      if (p) J.som.falar(p.getAttribute('data-fala'));
    });

    drag = J.arrastar({
      raiz: porId('palco'),
      peca: '.jg-peca:not(.colocada)',
      alvo: '.jg-molde:not(.encaixado)',
      tolerancia: 40,
      aoSoltar: aoSoltar,
      aoSelecionar: function (peca) {
        el.aviso.textContent = peca
          ? 'Você escolheu: ' + peca.getAttribute('aria-label') + '. Agora toque no molde certo.'
          : 'Arraste uma peça até o molde — ou toque na peça e depois no molde.';
      }
    });

    montarAjustes();
    novaPartida();
  });
})(window);
