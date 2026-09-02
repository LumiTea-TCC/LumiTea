/* ================================================================
   LumiTEA — guia.js
   ─────────────────────────────────────────────────────────────────
   "Guia do Lumi Theo": um tour guiado, passo a passo, entre páginas,
   disparado pela conversa com a IA quando o adolescente diz que está
   com dificuldade em usar alguma função (2026-08-19).

   Como funciona:
     1. Na conversa (conversa.html), a IA reconhece que o pedido bate
        com um tour do CATALOGO abaixo e devolve o id dele junto da
        resposta normal (ver js/lumi-ia.js → responder()/montarSystemPrompt).
     2. conversa.html mostra um botão "Começar tour" embaixo da fala da
        Lumi; ao tocar, chama window.LUMITEA.iniciarTour(id) — a
        navegação em si é sempre um clique do adolescente, nunca
        automática, pra não quebrar a previsibilidade do app.
     3. iniciarTour guarda o progresso em sessionStorage e navega pro
        primeiro passo.
     4. Este arquivo roda em TODA página que pode fazer parte de um
        tour: no carregamento, olha se o passo atual é desta página;
        se for, mostra uma bolha flutuante do Lumi com o texto do
        passo + os botões "Próximo"/"Terminar tour", e destaca
        (contorno, sem animação) o elemento com
        [data-tour="<passo.elemento>"], se houver.

   Tour novo = só adicionar uma entrada em CATALOGO — nenhuma mudança
   de mecânica é necessária. `elemento` é opcional (passo sem destaque
   visual, só a bolha explicando). `pagina` é comparado com o nome do
   arquivo atual (ex.: "diario.html").
   ================================================================ */
(function (g) {
  'use strict';

  var CHAVE = 'lt-tour-ativo';

  var CATALOGO = {
    diario: {
      nome: 'Como usar o Diário',
      passos: [
        { pagina: 'home-autista.html', elemento: 'home-diario',
          texto: 'O Diário fica aqui, no card "Diário e perfil". Toque em "Abrir diário" pra ir até lá.' },
        { pagina: 'diario.html', elemento: 'diario-nova',
          texto: 'Aqui! Toque em "Nova Entrada" pra escrever como você está se sentindo. Depois de salvar, eu leio e te mando uma reflexão.' }
      ]
    },
    calendario: {
      nome: 'Como organizar sua rotina no Calendário',
      passos: [
        { pagina: 'home-autista.html', elemento: 'home-calendario',
          texto: 'O Calendário fica aqui. Toque em "Organizar rotina" pra abrir.' },
        { pagina: 'calendario.html', elemento: 'calendario-form',
          texto: 'É aqui que você cria um evento: escreve o título, escolhe o dia e a hora, e toca em "Salvar evento".' }
      ]
    },
    jogos: {
      nome: 'Como jogar os Jogos do Theo',
      passos: [
        { pagina: 'home-autista.html', elemento: 'home-jogos',
          texto: 'Os jogos ficam aqui. Toque em "Ver jogos" pra ver todos.' },
        { pagina: 'games.html', elemento: 'jogos-grid',
          texto: 'Escolha qualquer um pra jogar. Nenhum tem cronômetro ou jeito de perder — pode ir no seu ritmo.' }
      ]
    },
    humor: {
      nome: 'Como registrar como você está se sentindo',
      passos: [
        { pagina: 'home-autista.html', elemento: 'home-humor',
          texto: 'É só tocar em um desses botões, do jeito que você estiver se sentindo agora. Não precisa pensar muito, é rapidinho.' }
      ]
    },
    vinculo: {
      nome: 'Como se conectar com seu cuidador',
      passos: [
        { pagina: 'home-autista.html', elemento: 'home-vinculo',
          texto: 'Esse é o seu código. Compartilhe com quem cuida de você — a pessoa digita ele no painel dela pra vocês ficarem conectados.' }
      ]
    },

    /* Tours do painel do cuidador (publico:'cuidador') — mesma mecânica, catálogo
       de IA separado (ver CATALOGO_CUI_IA abaixo) pra não misturar com os tours do
       adolescente: o cuidador nunca deveria receber uma sugestão de tour que
       aponta pra uma tela do teen, e vice-versa. */
    'cui-alertas': {
      nome: 'Como ver os alertas do adolescente',
      publico: 'cuidador',
      passos: [
        { pagina: 'alertas-cuidador.html', elemento: 'cui-alertas-lista',
          texto: 'Os alertas sobre o adolescente ficam aqui — inclusive os críticos, que também aparecem sozinhos como um aviso na tela quando surgem. Toque em um alerta pra ver os detalhes e a análise.' }
      ]
    },
    'cui-calendario': {
      nome: 'Como adicionar um evento pro adolescente',
      publico: 'cuidador',
      passos: [
        { pagina: 'calendario-cuidador.html', elemento: 'cal-cuidador-form',
          texto: 'É aqui que você adiciona um evento na agenda do adolescente: escolha quem, escreva o título, a data e toque em "Enviar para a agenda".' }
      ]
    },
    'cui-vinculo': {
      nome: 'Como se conectar com um adolescente',
      publico: 'cuidador',
      passos: [
        { pagina: 'vinculos-cuidador.html', elemento: 'cui-vinculo-codigo',
          texto: 'Peça ao adolescente o código de 6 dígitos dele, digite aqui e toque em "Conectar" pra vincular a conta.' }
      ]
    },
    'cui-relatorios': {
      nome: 'Como gerar um relatório do adolescente',
      publico: 'cuidador',
      passos: [
        { pagina: 'relatorios-cuidador.html', elemento: 'cui-btn-gerar-relatorio',
          texto: 'Toque em "Gerar relatório" pra pedir ao Lumi Theo um resumo do que ele tem observado sobre o adolescente recentemente.' }
      ]
    }
  };

  function esc(s) { return (g.LUMITEA && g.LUMITEA.esc) ? g.LUMITEA.esc(s) : String(s == null ? '' : s); }

  function paginaAtual() {
    return (g.location.pathname.split('/').pop() || 'home-autista.html');
  }

  function lerEstado() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; }
  }
  function gravarEstado(estado) {
    try {
      if (estado) sessionStorage.setItem(CHAVE, JSON.stringify(estado));
      else sessionStorage.removeItem(CHAVE);
    } catch (e) {}
  }

  function removerBolha() {
    var el = document.getElementById('lt-guia-bolha');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var destacados = document.querySelectorAll('.lt-guia-destaque');
    for (var i = 0; i < destacados.length; i++) destacados[i].classList.remove('lt-guia-destaque');
  }

  function encerrarTour() {
    gravarEstado(null);
    removerBolha();
  }

  function irParaPasso(id, indice) {
    var tour = CATALOGO[id];
    if (!tour || !tour.passos[indice]) { encerrarTour(); return; }
    gravarEstado({ id: id, indice: indice });
    var passo = tour.passos[indice];
    if (paginaAtual() === passo.pagina) mostrarPassoAtual();
    else g.location.href = passo.pagina;
  }

  function iniciarTour(id) {
    if (!CATALOGO[id]) return false;
    irParaPasso(id, 0);
    return true;
  }

  function proximoPasso() {
    var estado = lerEstado();
    if (!estado) return;
    irParaPasso(estado.id, estado.indice + 1);
  }

  function mostrarPassoAtual() {
    removerBolha();
    var estado = lerEstado();
    if (!estado) return;
    var tour = CATALOGO[estado.id];
    if (!tour) { encerrarTour(); return; }
    var passo = tour.passos[estado.indice];
    if (!passo || passo.pagina !== paginaAtual()) return;

    var ultimo = estado.indice === tour.passos.length - 1;
    var calmoOuReduz = document.documentElement.getAttribute('data-modo-calmo') === 'true' ||
      (g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var bolha = document.createElement('div');
    bolha.id = 'lt-guia-bolha';
    bolha.className = 'lt-guia-bolha' + (calmoOuReduz ? '' : ' lt-anim');
    bolha.setAttribute('role', 'status');
    bolha.innerHTML =
      '<img class="lt-guia-av" src="img/urso-joia.png" alt="">' +
      '<div class="lt-guia-corpo">' +
        '<div class="lt-guia-titulo">' + esc(tour.nome) + '</div>' +
        '<p class="lt-guia-texto">' + esc(passo.texto) + '</p>' +
        '<div class="lt-guia-acoes">' +
          '<button type="button" class="lt-guia-pular" id="lt-guia-pular">Terminar tour</button>' +
          '<button type="button" class="lt-guia-prox" id="lt-guia-prox">' + (ultimo ? 'Terminei!' : 'Próximo') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bolha);
    if (g.LUMI && g.LUMI.hydrateIcons) g.LUMI.hydrateIcons(bolha);

    document.getElementById('lt-guia-prox').addEventListener('click', proximoPasso);
    document.getElementById('lt-guia-pular').addEventListener('click', encerrarTour);

    if (passo.elemento) {
      var alvo = document.querySelector('[data-tour="' + passo.elemento + '"]');
      if (alvo) {
        alvo.classList.add('lt-guia-destaque');
        try { alvo.scrollIntoView({ behavior: calmoOuReduz ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
      }
    }

    requestAnimationFrame(function () { bolha.classList.add('is-in'); });
  }

  /* Listas enxutas (id + descrição) pra IA escolher — não expõem passos nem
     seletores, só o suficiente pra reconhecer a intenção de quem está falando.
     Separadas por público: a IA do adolescente (conversa.html) só pode sugerir
     tours do adolescente, e a IA do cuidador (consultoria-cuidador.html) só os
     do cuidador — misturar deixaria a IA de um lado sugerir uma tela do outro. */
  var CATALOGO_IA = Object.keys(CATALOGO).filter(function (id) {
    return CATALOGO[id].publico !== 'cuidador';
  }).map(function (id) { return { id: id, descricao: CATALOGO[id].nome }; });

  var CATALOGO_CUI_IA = Object.keys(CATALOGO).filter(function (id) {
    return CATALOGO[id].publico === 'cuidador';
  }).map(function (id) { return { id: id, descricao: CATALOGO[id].nome }; });

  g.LUMITEA = g.LUMITEA || {};
  g.LUMITEA.iniciarTour = iniciarTour;
  g.LUMITEA.TOUR_CATALOGO_IA = CATALOGO_IA;
  g.LUMITEA.TOUR_CATALOGO_CUI_IA = CATALOGO_CUI_IA;

  // Retoma um tour em andamento ao carregar qualquer página que faça parte dele.
  if (lerEstado()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarPassoAtual);
    else mostrarPassoAtual();
  }
})(window);
