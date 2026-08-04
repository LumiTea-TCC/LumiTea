/* ============================================================
   LumiTEA — js/jogos/imagem-palavra.js
   Correspondência entre figura e palavra escrita.

   Trabalha a ponte entre o que se vê e o que se lê: apoio de
   leitura e ampliação de vocabulário.

   Duas formas de ligar, porque nem todo mundo tem a mesma
   facilidade de arrastar:
     · tocar na figura e depois na palavra (ou o contrário);
     · arrastar a palavra até a figura.

   Modo "ouvir a palavra": a coluna da direita esconde o texto e
   vira um botão de ouvir — a mesma tarefa, na modalidade
   sonora, para quem ainda não lê. Escolher esse modo liga o som
   automaticamente, porque sem som ele não faria sentido.

   Ligação errada não trava nada: a linha some e pronto.
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var S = J.sprites;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };

  var JOGO = 'imagem-palavra';
  var prefs = J.prefs(JOGO);

  var CAMPOS = [
    {
      chave: 'pares', padrao: '4',
      titulo: 'Quantas ligações por rodada',
      dica: 'Três ou quatro é um bom começo.',
      opcoes: [
        { valor: '3', rotulo: '3 pares' },
        { valor: '4', rotulo: '4 pares' },
        { valor: '6', rotulo: '6 pares' }
      ]
    },
    {
      chave: 'tema', padrao: 'animais',
      titulo: 'Tema do vocabulário',
      dica: 'Escolha o assunto que você quer treinar.',
      opcoes: Object.keys(S.TEMAS).map(function (k) {
        return { valor: k, rotulo: S.TEMAS[k].nome };
      })
    },
    {
      chave: 'modo', padrao: 'palavra',
      titulo: 'Como a palavra aparece',
      dica: '"Ouvir" esconde o texto e lê o nome em voz alta — para quem ainda não lê sozinho.',
      opcoes: [
        { valor: 'palavra', rotulo: 'Ler a palavra' },
        { valor: 'som', rotulo: 'Ouvir a palavra' }
      ]
    }
  ];

  var el = {};
  var estado = { total: 0, ligados: 0, tentativas: 0, inicio: 0, tema: 'animais', modo: 'palavra' };
  var pares = [];          /* [{img: el, pal: el}] já ligados — usados para desenhar as linhas */
  var figuraEscolhida = null;
  var drag = null;
  var repintarSom = null;
  var timerLinhas = null;
  var timerFim = null;
  var limpandoDepoisDeLigar = false;

  function porId(id) { return document.getElementById(id); }

  /* ---------- montagem de uma partida ---------- */
  function novaPartida() {
    /* limpa o que sobrou da rodada anterior: timer de fim e palavra escolhida
       (o botão velho some do DOM, mas a seleção continuaria apontando pra ele
        e bloquearia o clique nas figuras da rodada nova) */
    if (timerFim) { clearTimeout(timerFim); timerFim = null; }
    if (drag) drag.limparSelecao();
    J.som.calar();

    var n = parseInt(prefs.get('pares', '4'), 10) || 4;
    var tema = prefs.get('tema', 'animais');
    var modo = prefs.get('modo', 'palavra');
    if (!S.TEMAS[tema]) tema = 'animais';

    var itens = J.embaralhar(S.itens(tema)).slice(0, n);
    var figuras = J.embaralhar(itens);
    var palavras = J.embaralhar(itens);

    estado.total = n;
    estado.ligados = 0;
    estado.tentativas = 0;
    estado.inicio = Date.now();
    estado.tema = tema;
    estado.modo = modo;
    pares = [];
    figuraEscolhida = null;

    el.colFiguras.innerHTML = '<span class="jg-coluna-rotulo">Figuras</span>' +
      figuras.map(function (it) {
        return '<button type="button" class="jg-item-img" data-id="' + esc(it.id) + '" ' +
          'data-nome="' + esc(it.nome) + '" aria-label="Figura: ' + esc(it.nome) + '">' +
          '<span class="jg-fig-cx" aria-hidden="true">' + it.svg + '</span></button>';
      }).join('');

    el.colPalavras.innerHTML = '<span class="jg-coluna-rotulo">' +
      (modo === 'som' ? 'Palavras faladas' : 'Palavras') + '</span>' +
      palavras.map(function (it, i) {
        var conteudo = modo === 'som'
          ? '<span class="jg-ouvir" aria-hidden="true">' + J.icone('radio') + ' Ouvir ' + (i + 1) + '</span>'
          : esc(it.nome);
        var rotulo = modo === 'som' ? 'Palavra falada número ' + (i + 1) : 'Palavra: ' + it.nome;
        return '<button type="button" class="jg-item-palavra" data-id="' + esc(it.id) + '" ' +
          'data-nome="' + esc(it.nome) + '" aria-label="' + esc(rotulo) + '">' + conteudo + '</button>';
      }).join('');

    el.instrucaoTxt.innerHTML = modo === 'som'
      ? 'Toque em <b>Ouvir</b> para escutar o nome e depois na figura que combina.'
      : 'Toque numa figura e depois na <b>palavra</b> que combina com ela.';

    el.palco.classList.remove('escondido');
    el.instrucao.classList.remove('escondido');
    el.fim.classList.remove('aberto');
    el.fim.innerHTML = '';
    el.aviso.textContent = 'Toque numa figura e depois na palavra — ou arraste uma até a outra.';
    limparLinhas();
    atualizarProgresso();
  }

  function atualizarProgresso() {
    var pct = estado.total ? Math.round((estado.ligados / estado.total) * 100) : 0;
    el.fill.style.width = pct + '%';
    el.progresso.setAttribute('aria-valuenow', String(pct));
    el.progressoTxt.textContent = estado.ligados + ' de ' + estado.total +
      (estado.total === 1 ? ' ligação feita' : ' ligações feitas');
  }

  /* ---------- linhas de ligação ---------- */
  function limparLinhas() { el.linhas.innerHTML = ''; }

  function desenharLinhas() {
    if (!pares.length) { limparLinhas(); return; }
    var base = el.ligacao.getBoundingClientRect();
    var html = '';
    pares.forEach(function (p) {
      var a = p.img.getBoundingClientRect();
      var b = p.pal.getBoundingClientRect();
      var x1 = a.right - base.left, y1 = a.top + a.height / 2 - base.top;
      var x2 = b.left - base.left, y2 = b.top + b.height / 2 - base.top;
      html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" ' +
              'x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" ' +
              'stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
    });
    el.linhas.innerHTML = html;
  }

  function agendarLinhas() {
    if (timerLinhas) clearTimeout(timerLinhas);
    timerLinhas = setTimeout(function () { desenharLinhas(); timerLinhas = null; }, 120);
  }

  /* ---------- ligar figura + palavra ---------- */
  function tentarLigar(figura, palavra) {
    if (!figura || !palavra) return false;
    if (figura.classList.contains('ligado') || palavra.classList.contains('ligado')) return false;
    estado.tentativas++;

    if (figura.getAttribute('data-id') !== palavra.getAttribute('data-id')) {
      return false;   // não combinam: nada trava, nada aparece
    }

    figura.classList.add('ligado');
    palavra.classList.add('ligado');
    figura.classList.remove('escolhida');
    palavra.classList.remove('escolhida');
    figura.disabled = true;
    palavra.disabled = true;
    figura.setAttribute('aria-label', 'Figura ' + figura.getAttribute('data-nome') + ', já ligada');
    palavra.setAttribute('aria-label', 'Palavra ' + palavra.getAttribute('data-nome') + ', já ligada');

    /* no modo "ouvir", revela a palavra escrita depois do acerto */
    if (estado.modo === 'som') palavra.textContent = palavra.getAttribute('data-nome');

    pares.push({ img: figura, pal: palavra });
    desenharLinhas();

    estado.ligados++;
    J.som.acerto();
    J.som.falar(figura.getAttribute('data-nome'));
    el.aviso.textContent = figura.getAttribute('data-nome') + ': ligado.';
    atualizarProgresso();

    if (estado.ligados === estado.total) finalizar();
    return true;
  }

  function escolherFigura(figura) {
    if (figuraEscolhida === figura) figura = null;
    el.colFiguras.querySelectorAll('.jg-item-img').forEach(function (f) { f.classList.remove('escolhida'); });
    figuraEscolhida = figura;
    if (figura) {
      figura.classList.add('escolhida');
      J.som.falar(figura.getAttribute('data-nome'));
      el.aviso.textContent = 'Você escolheu a figura ' + figura.getAttribute('data-nome') +
        '. Agora toque na palavra que combina.';
    } else {
      el.aviso.textContent = 'Toque numa figura e depois na palavra — ou arraste uma até a outra.';
    }
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
      extra: { tema: estado.tema, modo: estado.modo, pares: estado.total, tentativas: estado.tentativas }
    });

    timerFim = setTimeout(function () {
      timerFim = null;
      el.palco.classList.add('escondido');
      el.instrucao.classList.add('escondido');
      el.fim.innerHTML =
        '<img src="img/urso-estrelhinha.png" alt="">' +
        '<h2>Todas as ligações certas!</h2>' +
        '<p>Você ligou ' + estado.total + (estado.total === 1 ? ' palavra' : ' palavras') +
        ' às figuras certas. Cada uma dessas é uma palavra que agora é sua.</p>' +
        '<div class="jg-fim-btns">' +
        '<button type="button" class="jg-btn jg-btn-primario" id="fim-denovo">Jogar de novo</button>' +
        '<button type="button" class="jg-btn jg-btn-secundario" id="fim-ajustes">Trocar o tema</button>' +
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
    }, 520);
  }

  /* ---------- ajustes ---------- */
  function montarAjustes() {
    J.montarAjustes(el.campos, CAMPOS, prefs, function (chave, valor) {
      /* pedir "ouvir a palavra" é pedir som: liga sozinho, senão o modo não funciona */
      if (chave === 'modo' && valor === 'som' && J.som.disponivel() && !J.som.ligado()) {
        J.som.alternar();
        if (repintarSom) repintarSom();
      }
      novaPartida();
    });
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

    el.colFiguras = porId('col-figuras');
    el.colPalavras = porId('col-palavras');
    el.ligacao = porId('ligacao');
    el.linhas = porId('linhas');
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

    repintarSom = J.ligarBotaoSom(porId('btn-som'));

    var btnAjustes = porId('btn-ajustes');
    btnAjustes.innerHTML = J.icone('sliders');
    btnAjustes.addEventListener('click', function () {
      abrirAjustes(!porId('ajustes').classList.contains('aberto'));
    });

    /* arrastar palavra → figura */
    drag = J.arrastar({
      raiz: el.ligacao,
      peca: '.jg-item-palavra:not(.ligado)',
      alvo: '.jg-item-img:not(.ligado)',
      tolerancia: 30,
      aoSoltar: function (palavra, figura) { return tentarLigar(figura, palavra); },
      aoSelecionar: function (palavra) {
        if (palavra) {
          J.som.falar(palavra.getAttribute('data-nome'));
          if (figuraEscolhida) {
            var fig = figuraEscolhida;
            figuraEscolhida = null;
            fig.classList.remove('escolhida');
            tentarLigar(fig, palavra);
            /* a limpeza da seleção dispara aoSelecionar(null) de volta; o
               guarda evita que ela apague o "ligado" recém-anunciado */
            limpandoDepoisDeLigar = true;
            setTimeout(function () {
              if (drag) drag.limparSelecao();
              limpandoDepoisDeLigar = false;
            }, 0);
            return;
          }
          el.aviso.textContent = 'Você escolheu uma palavra. Agora toque na figura que combina.';
        } else if (!figuraEscolhida && !limpandoDepoisDeLigar) {
          el.aviso.textContent = 'Toque numa figura e depois na palavra — ou arraste uma até a outra.';
        }
      }
    });

    /* clicar na figura primeiro (captura roda antes do handler do arraste) */
    el.ligacao.addEventListener('click', function (e) {
      var figura = e.target.closest ? e.target.closest('.jg-item-img') : null;
      if (!figura || figura.classList.contains('ligado')) return;
      if (drag && drag.selecionada()) return;   // já há palavra escolhida: o arraste resolve
      escolherFigura(figura);
    }, true);

    g.addEventListener('resize', agendarLinhas);

    montarAjustes();
    novaPartida();
  });
})(window);
