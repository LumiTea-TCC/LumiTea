/* ============================================================
   LumiTEA — js/jogos/classificar.js
   Classificação por cor, forma ou tamanho.

   Trabalha raciocínio lógico, atenção sustentada e o vocabulário
   descritivo (grande/pequeno, redondo/quadrado, azul/verde).

   Regra de design que sustenta o jogo: UM critério por vez.
   Quando a criança classifica por cor, as formas variam de
   propósito — é o distrator que ensina a ignorar o resto. Só o
   modo avançado ("cor e forma") pede dois critérios ao mesmo
   tempo, e ele nunca é o padrão.

   Errar não gera som, cor vermelha nem mensagem: a peça volta.
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var S = J.sprites;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };

  var JOGO = 'classificar';
  var prefs = J.prefs(JOGO);

  var FORMAS_BASE = ['circulo', 'quadrado', 'triangulo', 'estrela', 'coracao', 'losango'];

  var CAMPOS = [
    {
      chave: 'criterio', padrao: 'cor',
      titulo: 'O que separa as caixas',
      dica: 'Um detalhe de cada vez deixa tudo mais claro. "Cor e forma" junta dois — deixe para quando os outros estiverem fáceis.',
      opcoes: [
        { valor: 'cor', rotulo: 'Cor' },
        { valor: 'forma', rotulo: 'Forma' },
        { valor: 'tamanho', rotulo: 'Tamanho' },
        { valor: 'cor-forma', rotulo: 'Cor e forma' }
      ]
    },
    {
      chave: 'categorias', padrao: '2',
      titulo: 'Quantas caixas',
      dica: 'Comece com duas. No modo tamanho são sempre duas, e em "cor e forma" são sempre quatro.',
      opcoes: [
        { valor: '2', rotulo: '2 caixas' },
        { valor: '3', rotulo: '3 caixas' },
        { valor: '4', rotulo: '4 caixas' }
      ]
    },
    {
      chave: 'objetos', padrao: '8',
      titulo: 'Quantas figuras',
      dica: 'Quantas figuras aparecem para guardar em cada rodada.',
      opcoes: [
        { valor: '8', rotulo: '8 figuras' },
        { valor: '12', rotulo: '12 figuras' }
      ]
    }
  ];

  var el = {};
  var estado = { total: 0, guardados: 0, tentativas: 0, inicio: 0, criterio: 'cor' };
  var drag = null;
  var timerFim = null;

  function porId(id) { return document.getElementById(id); }
  function sorteio(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ============================================================
     Monta categorias (as caixas) e as figuras da rodada.
     Devolve { cats: [...], pecas: [...] }
     ============================================================ */
  function montarRodada(criterio, k, n) {
    var cats = [], pecas = [], i;

    if (criterio === 'cor') {
      var cores = J.embaralhar(S.CORES).slice(0, k);
      cats = cores.map(function (c) {
        return { id: c.chave, rotulo: c.nome, fala: c.nome, amostra: S.forma('circulo', c.hex, 'grande') };
      });
      for (i = 0; i < n; i++) {
        var c1 = cores[i % k];
        var f1 = sorteio(FORMAS_BASE);
        pecas.push({
          cat: c1.chave, fala: c1.nome,
          descricao: S.FORMAS[f1].nome + ' ' + c1.nome,
          svg: S.forma(f1, c1.hex, 'grande')
        });
      }

    } else if (criterio === 'forma') {
      var formas = J.embaralhar(FORMAS_BASE).slice(0, k);
      cats = formas.map(function (f) {
        return { id: f, rotulo: S.FORMAS[f].nome, fala: S.FORMAS[f].nome, amostra: S.molde(f) };
      });
      for (i = 0; i < n; i++) {
        var f2 = formas[i % k];
        var c2 = sorteio(S.CORES);
        pecas.push({
          cat: f2, fala: S.FORMAS[f2].nome,
          descricao: S.FORMAS[f2].nome + ' ' + c2.nome,
          svg: S.forma(f2, c2.hex, 'grande')
        });
      }

    } else if (criterio === 'tamanho') {
      cats = S.TAMANHOS.map(function (t) {
        return { id: t.chave, rotulo: t.nome, fala: t.nome, amostra: S.forma('circulo', '#8fa4ba', t.chave) };
      });
      for (i = 0; i < n; i++) {
        var t = S.TAMANHOS[i % 2];
        var f3 = sorteio(FORMAS_BASE);
        var c3 = sorteio(S.CORES);
        pecas.push({
          cat: t.chave, fala: t.nome,
          descricao: S.FORMAS[f3].nome + ' ' + c3.nome + ' ' + t.nome,
          svg: S.forma(f3, c3.hex, t.chave)
        });
      }

    } else { /* cor-forma — sempre 2 cores × 2 formas = 4 caixas */
      var duasCores = J.embaralhar(S.CORES).slice(0, 2);
      var duasFormas = J.embaralhar(FORMAS_BASE).slice(0, 2);
      var combos = [];
      duasFormas.forEach(function (f) {
        duasCores.forEach(function (c) {
          combos.push({ forma: f, cor: c, id: f + '-' + c.chave, rotulo: S.FORMAS[f].nome + ' ' + c.nome });
        });
      });
      cats = combos.map(function (k2) {
        return { id: k2.id, rotulo: k2.rotulo, fala: k2.rotulo, amostra: S.forma(k2.forma, k2.cor.hex, 'grande') };
      });
      for (i = 0; i < n; i++) {
        var combo = combos[i % combos.length];
        pecas.push({
          cat: combo.id, fala: combo.rotulo,
          descricao: combo.rotulo,
          svg: S.forma(combo.forma, combo.cor.hex, 'grande')
        });
      }
    }

    return { cats: cats, pecas: J.embaralhar(pecas) };
  }

  var TEXTO_INSTRUCAO = {
    'cor':       'Leve cada figura para a caixa da <b>cor</b> dela. O formato não importa agora.',
    'forma':     'Leve cada figura para a caixa do <b>formato</b> dela. A cor não importa agora.',
    'tamanho':   'Leve cada figura para a caixa do <b>tamanho</b> dela: grande ou pequeno.',
    'cor-forma': 'Agora são <b>dois detalhes ao mesmo tempo</b>: a forma e a cor precisam bater.'
  };

  /* ---------- montagem de uma partida ---------- */
  function novaPartida() {
    /* limpa o que sobrou da rodada anterior: timer de fim e peça escolhida
       (a peça velha some do DOM, mas a seleção continuaria apontando pra ela) */
    if (timerFim) { clearTimeout(timerFim); timerFim = null; }
    if (drag) drag.limparSelecao();
    J.som.calar();

    var criterio = prefs.get('criterio', 'cor');
    var k = parseInt(prefs.get('categorias', '2'), 10) || 2;
    var n = parseInt(prefs.get('objetos', '8'), 10) || 8;
    if (criterio === 'tamanho') k = 2;
    if (criterio === 'cor-forma') k = 4;

    var rodada = montarRodada(criterio, k, n);

    estado.total = n;
    estado.guardados = 0;
    estado.tentativas = 0;
    estado.inicio = Date.now();
    estado.criterio = criterio;

    el.instrucaoTxt.innerHTML = TEXTO_INSTRUCAO[criterio] || TEXTO_INSTRUCAO.cor;

    el.pecas.innerHTML = rodada.pecas.map(function (p, i) {
      return '<button type="button" class="jg-peca" data-i="' + i + '" data-cat="' + esc(p.cat) + '" ' +
        'data-fala="' + esc(p.fala) + '" aria-label="' + esc(p.descricao) + '">' +
        '<span class="jg-fig-cx" aria-hidden="true">' + p.svg + '</span></button>';
    }).join('');

    el.alvos.innerHTML = rodada.cats.map(function (c) {
      return '<button type="button" class="jg-alvo" data-cat="' + esc(c.id) + '" ' +
        'aria-label="Caixa ' + esc(c.rotulo) + '">' +
        '<span class="jg-alvo-topo">' +
          '<span class="jg-alvo-amostra" aria-hidden="true">' + c.amostra + '</span>' +
          esc(c.rotulo) +
        '</span>' +
        '<span class="jg-alvo-conteudo"></span></button>';
    }).join('');

    el.palco.classList.remove('escondido');
    el.instrucao.classList.remove('escondido');
    el.fim.classList.remove('aberto');
    el.fim.innerHTML = '';
    el.aviso.textContent = 'Arraste uma figura até a caixa — ou toque na figura e depois na caixa.';
    atualizarProgresso();
  }

  function atualizarProgresso() {
    var pct = estado.total ? Math.round((estado.guardados / estado.total) * 100) : 0;
    el.fill.style.width = pct + '%';
    el.progresso.setAttribute('aria-valuenow', String(pct));
    el.progressoTxt.textContent = estado.guardados + ' de ' + estado.total +
      (estado.total === 1 ? ' figura guardada' : ' figuras guardadas');
  }

  /* ---------- soltar uma peça numa caixa ---------- */
  function aoSoltar(peca, alvo) {
    if (peca.classList.contains('colocada')) return false;
    estado.tentativas++;

    if (peca.getAttribute('data-cat') !== alvo.getAttribute('data-cat')) {
      return false;   // caixa errada: a peça só volta, em silêncio
    }

    var guardada = document.createElement('span');
    guardada.className = 'jg-guardada';
    guardada.innerHTML = peca.innerHTML;
    guardada.setAttribute('aria-hidden', 'true');
    alvo.querySelector('.jg-alvo-conteudo').appendChild(guardada);
    if (!J.calmo()) guardada.classList.add('jg-encaixou');

    peca.classList.add('colocada');
    peca.classList.remove('escolhida');
    peca.disabled = true;

    estado.guardados++;
    J.som.encaixe();
    J.som.falar(peca.getAttribute('data-fala'));
    el.aviso.textContent = peca.getAttribute('aria-label') + ' guardado.';
    atualizarProgresso();

    if (estado.guardados === estado.total) finalizar();
    return true;
  }

  /* ---------- fim da rodada ---------- */
  function finalizar() {
    var duracao = Math.round((Date.now() - estado.inicio) / 1000);
    var pontuacao = estado.total * 10;
    var xpGanho = J.ganharXP(pontuacao);

    J.salvarSessao({
      jogoId: JOGO,
      duracao: duracao,
      pontuacao: pontuacao,
      acertos: estado.total,
      total: estado.tentativas,
      terminou: true,
      extra: { criterio: estado.criterio, figuras: estado.total, tentativas: estado.tentativas }
    });

    timerFim = setTimeout(function () {
      timerFim = null;
      el.palco.classList.add('escondido');
      el.instrucao.classList.add('escondido');
      el.fim.innerHTML =
        '<img src="img/urso-joinha.png" alt="">' +
        '<h2>Tudo guardado no lugar certo!</h2>' +
        '<p>Você separou ' + estado.total + ' figuras olhando só para o que importava. ' +
        'Isso é atenção e lógica trabalhando juntas.</p>' +
        (xpGanho ? '<p class="jg-xp-ganho">+' + xpGanho.ganho + ' XP' +
          (xpGanho.subiuNivel ? ' — você subiu para o nível ' + xpGanho.nivel + '!' : '') + '</p>' : '') +
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
    el.alvos = porId('alvos');
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

    /* narra o atributo assim que a figura é pega (reforço de linguagem) */
    el.pecas.addEventListener('pointerdown', function (e) {
      var p = e.target.closest ? e.target.closest('.jg-peca') : null;
      if (p) J.som.falar(p.getAttribute('data-fala'));
    });

    drag = J.arrastar({
      raiz: porId('palco'),
      peca: '.jg-peca:not(.colocada)',
      alvo: '.jg-alvo',
      tolerancia: 34,
      aoSoltar: aoSoltar,
      aoSelecionar: function (peca) {
        el.aviso.textContent = peca
          ? 'Você escolheu: ' + peca.getAttribute('aria-label') + '. Agora toque na caixa certa.'
          : 'Arraste uma figura até a caixa — ou toque na figura e depois na caixa.';
      }
    });

    montarAjustes();
    novaPartida();
  });
})(window);
