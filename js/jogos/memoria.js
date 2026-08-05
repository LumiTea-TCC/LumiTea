/* ============================================================
   LumiTEA — js/jogos/memoria.js
   Jogo da memória: encontrar os pares de figuras iguais.

   Trabalha memória de curto prazo, atenção sustentada e
   associação visual.

   Decisões de acessibilidade que NÃO devem ser revertidas:
     · nenhum cronômetro na tela e nenhum ponto negativo;
     · errar não produz som, cor vermelha nem mensagem — as
       cartas só voltam a virar;
     · o tempo que as cartas ficam abertas é ajustável;
     · cada carta é um <button> com rótulo falado para leitor de
       tela; o giro some no modo calmo (vira sem animação).
   ============================================================ */
(function (g) {
  'use strict';
  var J = g.LUMIJOGOS;
  var S = J.sprites;
  var esc = (g.LUMITEA && g.LUMITEA.esc) || function (s) { return String(s == null ? '' : s); };

  var JOGO = 'memoria';
  var prefs = J.prefs(JOGO);

  /* Verso das cartas: patinha do Theo. */
  var VERSO =
    '<svg class="jg-fig" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<ellipse cx="50" cy="66" rx="25" ry="20" fill="currentColor"/>' +
    '<circle cx="24" cy="42" r="9.5" fill="currentColor"/>' +
    '<circle cx="42" cy="28" r="9.5" fill="currentColor"/>' +
    '<circle cx="60" cy="28" r="9.5" fill="currentColor"/>' +
    '<circle cx="78" cy="42" r="9.5" fill="currentColor"/></svg>';

  /* Quantidade de pares → colunas da grade. */
  var COLUNAS = { 3: 3, 4: 4, 6: 4, 8: 4 };

  var CAMPOS = [
    {
      chave: 'pares', padrao: '4',
      titulo: 'Quantos pares',
      dica: 'Comece com poucos. Você aumenta quando se sentir pronto.',
      opcoes: [
        { valor: '3', rotulo: '3 pares' },
        { valor: '4', rotulo: '4 pares' },
        { valor: '6', rotulo: '6 pares' },
        { valor: '8', rotulo: '8 pares' }
      ]
    },
    {
      chave: 'tema', padrao: 'animais',
      titulo: 'Tema das figuras',
      dica: 'Escolha o assunto de que você mais gosta.',
      opcoes: Object.keys(S.TEMAS).map(function (k) {
        return { valor: k, rotulo: S.TEMAS[k].nome };
      })
    },
    {
      chave: 'espera', padrao: '1500',
      titulo: 'Tempo até as cartas virarem de volta',
      dica: 'Quanto tempo as cartas ficam abertas quando as figuras são diferentes.',
      opcoes: [
        { valor: '1000', rotulo: 'Rápido' },
        { valor: '1500', rotulo: 'Normal' },
        { valor: '2500', rotulo: 'Com calma' }
      ]
    }
  ];

  var el = {};
  var estado = { total: 0, encontrados: 0, tentativas: 0, abertas: [], bloqueado: false, inicio: 0, tema: 'animais' };
  var timerVolta = null;
  var timerFim = null;

  function porId(id) { return document.getElementById(id); }

  /* ---------- montagem de uma partida ---------- */
  function novaPartida() {
    /* recomeçar no meio de uma jogada não pode deixar timer velho vivo */
    if (timerVolta) { clearTimeout(timerVolta); timerVolta = null; }
    if (timerFim) { clearTimeout(timerFim); timerFim = null; }
    J.som.calar();

    var pares = parseInt(prefs.get('pares', '4'), 10) || 4;
    var tema = prefs.get('tema', 'animais');
    if (!S.TEMAS[tema]) tema = 'animais';

    var itens = J.embaralhar(S.itens(tema)).slice(0, pares);
    var baralho = J.embaralhar(itens.concat(itens));

    estado.total = pares;
    estado.encontrados = 0;
    estado.tentativas = 0;
    estado.abertas = [];
    estado.bloqueado = false;
    estado.inicio = Date.now();
    estado.tema = tema;

    el.cartas.style.setProperty('--jg-cols', String(COLUNAS[pares] || 4));
    var html = '';
    baralho.forEach(function (item, i) {
      html +=
        '<button type="button" class="jg-carta" data-id="' + esc(item.id) + '" data-nome="' + esc(item.nome) + '" ' +
        'aria-label="Carta ' + (i + 1) + ', virada para baixo">' +
        '<span class="jg-carta-face jg-carta-verso" aria-hidden="true">' + VERSO + '</span>' +
        '<span class="jg-carta-face jg-carta-frente" aria-hidden="true"><span class="jg-fig-cx">' + item.svg + '</span></span>' +
        '</button>';
    });
    el.cartas.innerHTML = html;

    el.palco.classList.remove('escondido');
    el.fim.classList.remove('aberto');
    el.fim.innerHTML = '';
    el.aviso.textContent = '';
    atualizarProgresso();
  }

  function atualizarProgresso() {
    var pct = estado.total ? Math.round((estado.encontrados / estado.total) * 100) : 0;
    el.fill.style.width = pct + '%';
    el.progresso.setAttribute('aria-valuenow', String(pct));
    el.progressoTxt.textContent = estado.encontrados + ' de ' + estado.total +
      (estado.total === 1 ? ' par encontrado' : ' pares encontrados');
  }

  /* ---------- virar cartas ---------- */
  function virar(carta) {
    if (estado.bloqueado) return;
    if (carta.classList.contains('resolvida') || carta.classList.contains('virada')) return;

    carta.classList.add('virada');
    carta.setAttribute('aria-label', carta.getAttribute('data-nome'));
    J.som.falar(carta.getAttribute('data-nome'));
    estado.abertas.push(carta);

    if (estado.abertas.length < 2) return;

    estado.bloqueado = true;
    estado.tentativas++;
    var a = estado.abertas[0], b = estado.abertas[1];

    if (a.getAttribute('data-id') === b.getAttribute('data-id')) {
      // par encontrado
      [a, b].forEach(function (c) {
        c.classList.add('resolvida');
        c.setAttribute('aria-label', c.getAttribute('data-nome') + ', par encontrado');
      });
      estado.encontrados++;
      estado.abertas = [];
      estado.bloqueado = false;
      J.som.acerto();
      el.aviso.textContent = 'Par encontrado: ' + a.getAttribute('data-nome') + '.';
      atualizarProgresso();
      if (estado.encontrados === estado.total) finalizar();
      return;
    }

    // não combinaram: sem som, sem mensagem — as cartas só voltam.
    var espera = parseInt(prefs.get('espera', '1500'), 10) || 1500;
    timerVolta = setTimeout(function () {
      [a, b].forEach(function (c) {
        c.classList.remove('virada');
        c.setAttribute('aria-label', 'Carta virada para baixo');
      });
      estado.abertas = [];
      estado.bloqueado = false;
      timerVolta = null;
    }, espera);
  }

  /* ---------- fim da rodada ---------- */
  function finalizar() {
    var duracao = Math.round((Date.now() - estado.inicio) / 1000);
    var pares = estado.total;
    var proximo = { 3: 4, 4: 6, 6: 8 }[pares] || null;
    var pontuacao = pares * 10;
    var xpGanho = J.ganharXP(pontuacao);

    J.salvarSessao({
      jogoId: JOGO,
      duracao: duracao,
      pontuacao: pontuacao,
      acertos: pares,
      total: estado.tentativas,
      terminou: true,
      extra: { tema: estado.tema, pares: pares, tentativas: estado.tentativas }
    });

    timerFim = setTimeout(function () {
      timerFim = null;
      el.palco.classList.add('escondido');
      el.fim.innerHTML =
        '<img src="img/urso-joia.png" alt="">' +
        '<h2>Você encontrou todos os pares!</h2>' +
        '<p>Foram ' + pares + (pares === 1 ? ' par' : ' pares') + ' em ' + estado.tentativas +
        (estado.tentativas === 1 ? ' tentativa' : ' tentativas') + '. Cada carta que você lembrou foi sua memória trabalhando.</p>' +
        (xpGanho ? '<p class="jg-xp-ganho">+' + xpGanho.ganho + ' XP' +
          (xpGanho.subiuNivel ? ' — você subiu para o nível ' + xpGanho.nivel + '!' : '') + '</p>' : '') +
        '<div class="jg-fim-btns">' +
        '<button type="button" class="jg-btn jg-btn-primario" id="fim-denovo">Jogar de novo</button>' +
        (proximo ? '<button type="button" class="jg-btn jg-btn-secundario" id="fim-mais">Tentar com ' + proximo + ' pares</button>' : '') +
        '<a class="jg-btn jg-btn-suave" href="games.html">Voltar aos jogos</a>' +
        '</div>';
      el.fim.classList.add('aberto');
      J.som.fim();

      porId('fim-denovo').addEventListener('click', novaPartida);
      var mais = porId('fim-mais');
      if (mais) {
        mais.addEventListener('click', function () {
          prefs.set('pares', String(proximo));
          montarAjustes();
          novaPartida();
        });
      }
    }, 520);
  }

  /* ---------- ajustes ---------- */
  function montarAjustes() {
    J.montarAjustes(el.campos, CAMPOS, prefs, function () { novaPartida(); });
  }

  /* ---------- início ---------- */
  J.pronto(function () {
    J.boot();

    el.cartas = porId('cartas');
    el.palco = porId('palco');
    el.fim = porId('fim');
    el.aviso = porId('aviso');
    el.fill = porId('progresso-fill');
    el.progresso = porId('progresso');
    el.progressoTxt = porId('progresso-txt');
    el.campos = porId('ajustes-campos');

    var btnReiniciar = porId('btn-reiniciar');
    btnReiniciar.innerHTML = J.icone('refresh-cw');
    btnReiniciar.addEventListener('click', novaPartida);

    J.ligarBotaoSom(porId('btn-som'));

    var painel = porId('ajustes');
    var btnAjustes = porId('btn-ajustes');
    btnAjustes.innerHTML = J.icone('sliders');
    btnAjustes.addEventListener('click', function () {
      var aberto = painel.classList.toggle('aberto');
      btnAjustes.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      btnAjustes.setAttribute('aria-label', aberto ? 'Fechar ajustes do jogo' : 'Abrir ajustes do jogo');
    });

    el.cartas.addEventListener('click', function (e) {
      var carta = e.target.closest('.jg-carta');
      if (carta && el.cartas.contains(carta)) { J.som.destravar(); virar(carta); }
    });

    montarAjustes();
    novaPartida();
  });
})(window);
