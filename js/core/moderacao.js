/* ============================================================
   LumiTEA — moderacao.js  (window.Moderacao)
   Filtro de segurança da Comunidade (mural, comentários e chat).

   TRÊS NÍVEIS, TRÊS RESPOSTAS DIFERENTES — a diferença é de propósito:

     'apoio'    publica normalmente + card acolhedor do Lumi Theo.
                (sinais leves de sofrimento: "não aguento mais", "tô mal")
     'risco'    NÃO publica + card acolhedor + alerta 'crise' pro cuidador.
                NÃO bloqueia o adolescente. Crise e relato de abuso NUNCA
                são punidos: banir alguém que pediu socorro é o pior
                resultado possível deste app.
     'cuidado'  NÃO publica + card explicando + alerta pro cuidador.
                NÃO bloqueia. (dados pessoais, dúvida sobre sexo, drogas,
                e xingamento leve dirigido a si mesmo)
     'ofensa'   NÃO publica + BLOQUEIA a comunidade por 1 hora + card +
                alerta pro cuidador. (xingamento, ódio, ameaça, pornografia,
                crime)

   ONDE O BLOQUEIO VIVE: na tabela `comunidade_bloqueios` (ver
   db/MODERACAO_SCHEMA.sql). O RLS de comunidade_posts/comentarios/chat
   recusa insert de quem está bloqueado, então recarregar a página, trocar
   de navegador ou abrir o DevTools não devolve o acesso. O localStorage
   aqui é só um espelho pra UI responder na hora (e pra degradar com
   elegância se o schema ainda não tiver sido aplicado).

   A LISTA DE TERMOS É A FONTE DA VERDADE. O gatilho do banco carrega uma
   cópia dela, gerada por `node tools/gerar-termos-sql.js` — não edite a
   lista dentro do .sql à mão.
   ============================================================ */
(function (g) {
  'use strict';

  var LT = g.LUMITEA || {};
  function esc(s) { return LT.esc ? LT.esc(s) : String(s == null ? '' : s); }

  var MINUTOS_BLOQUEIO = 60;
  var CHAVE_LOCAL = 'lt-mod-bloqueio';

  /* ══════════════════════════════════════════════════════════
     1. TERMOS
     Escreva SEMPRE já normalizado: minúsculo, sem acento, sem
     pontuação, palavras separadas por um espaço só. O teste
     tools/gerar-termos-sql.js reclama se algum termo fugir disso.
     Frase é melhor que palavra solta: "vou te matar" não pega
     "matar o boss", e é o falso positivo que quebra a confiança
     de um adolescente com o app.
     ══════════════════════════════════════════════════════════ */

  /* ── risco: crise e abuso. Bloqueia a publicação, acolhe, avisa
        o cuidador — e NUNCA bloqueia o adolescente. ─────────── */
  var RISCO = {
    suicidio: [
      'suicidio', 'suicida', 'me suicidar', 'se suicidar', 'cometer suicidio',
      'me matar', 'vou me matar', 'quero me matar', 'pensando em me matar',
      'penso em me matar', 'tirar minha vida', 'tirar a minha vida',
      'acabar com a minha vida', 'dar fim na minha vida', 'dar fim a minha vida',
      'por um fim na minha vida', 'quero morrer', 'queria morrer', 'so quero morrer',
      'preferia morrer', 'melhor morrer', 'desejo morrer', 'vontade de morrer',
      'nao quero viver', 'nao quero mais viver', 'nao aguento mais viver',
      'cansei de viver', 'desisti de viver', 'sem vontade de viver',
      'a vida nao vale a pena', 'nao vejo saida', 'nao tem saida pra mim',
      'sumir do mundo', 'sumir pra sempre', 'desaparecer pra sempre',
      'acabar com tudo', 'ninguem sentiria minha falta',
      'ninguem vai sentir minha falta', 'seria melhor se eu morresse',
      'seria melhor sem mim', 'o mundo seria melhor sem mim',
      'todo mundo ficaria melhor sem mim', 'carta de despedida',
      'me despedir de todo mundo', 'me enforcar', 'me jogar da janela',
      'me jogar do predio', 'pular do predio', 'tomar todos os remedios',
      'overdose de remedio', 'cartela inteira de remedio'
    ],
    autolesao: [
      'me cortar', 'me cortando', 'me cortei', 'cortar o pulso', 'cortar os pulsos',
      'me machucar', 'me machuquei de proposito', 'me ferir', 'automutilacao',
      'auto mutilacao', 'autolesao', 'auto lesao', 'me queimar de proposito',
      'arranhar ate sangrar', 'ate sangrar'
    ],
    /* Relato de violência/abuso. Vítima nunca é punida — por isso
       'pedofilo' mora aqui e não na lista de pornografia. */
    abuso: [
      'abuso sexual', 'me abusou', 'abusaram de mim', 'fui abusada', 'fui abusado',
      'ele me tocou', 'ela me tocou', 'me tocou sem eu querer', 'tocou minhas partes',
      'me obrigou a fazer', 'pedofilo', 'pedofila', 'pedofilia',
      'meu pai me bate', 'minha mae me bate', 'apanho em casa', 'apanhei em casa',
      'me batem em casa', 'me trancam', 'me deixam sem comer'
    ]
  };

  /* ── cuidado: assunto que não cabe num mural público de menores,
        mas cuja escrita não é uma infração. Bloqueia e redireciona
        pro Lumi Theo, sem bloquear a comunidade. ─────────────── */
  var CUIDADO = {
    /* Segurança contra aliciamento: o vetor clássico é levar a criança
       pra fora da plataforma ou pedir dado que identifique/localize. */
    dados_pessoais: [
      'meu whatsapp', 'meu zap', 'me chama no zap', 'me chama no whats',
      'meu numero e', 'meu telefone e', 'qual seu numero', 'manda seu numero',
      'manda seu whatsapp', 'manda seu zap', 'meu insta e', 'meu instagram e',
      'me segue no insta', 'meu discord', 'me chama no discord', 'meu telegram',
      'me chama no telegram', 'meu tiktok e', 'qual seu endereco', 'meu endereco e',
      'onde voce mora', 'onde vc mora', 'onde tu mora', 'minha escola e',
      'estudo na escola', 'manda sua localizacao', 'manda sua foto',
      'manda uma foto sua', 'manda foto do seu rosto', 'liga a camera',
      'chamada de video comigo', 'me chama no privado', 'fala comigo no pv',
      'vamos nos encontrar', 'nos encontrar pessoalmente',
      'quero te conhecer pessoalmente', 'me encontra depois da aula',
      'nao conta pros seus pais', 'nao conta pra sua mae', 'nao conta pra ninguem',
      'segredo nosso', 'fica entre nos dois'
    ],
    sexualidade: [
      'sexo', 'fazer sexo', 'transar', 'transei', 'perder a virgindade', 'virgindade'
    ],
    substancias: [
      'maconha', 'fumar maconha', 'cocaina', 'crack', 'lsd', 'ecstasy', 'heroina',
      'metanfetamina', 'lanca perfume', 'cheirar cola', 'usar droga', 'usar drogas',
      'comprar droga', 'comprar drogas', 'ficar chapado', 'ficar doidao',
      'encher a cara', 'beber ate cair', 'ficar bebado', 'vape', 'cigarro eletronico'
    ]
  };

  /* ── ofensa: bloqueia a comunidade por 1 hora. ──────────────── */
  var OFENSA = {
    xingamento: [
      'fdp', 'filho da puta', 'filha da puta', 'puta que pariu', 'puta', 'putinha',
      'foda se', 'fodase', 'vai se foder', 'vai se fuder', 'se fode', 'foda',
      'vai tomar no cu', 'tomar no cu', 'toma no cu', 'vtnc', 'caralho', 'krl',
      'porra', 'merda', 'bosta', 'buceta', 'boceta', 'xoxota', 'cu', 'cuzao',
      'arrombado', 'arrombada', 'corno', 'corna', 'escroto', 'escrota',
      'desgracado', 'desgracada', 'vagabundo', 'vagabunda', 'vadia', 'piranha',
      'safado', 'safada', 'pilantra', 'canalha', 'miseravel', 'verme', 'pentelho',
      'otario', 'otaria'
    ],
    /* Slurs. As duas primeiras linhas são capacitistas: exatamente o que
       este público leva na cara fora do app — aqui dentro, não. */
    odio: [
      'retardado', 'retardada', 'retardo', 'mongoloide', 'mongol', 'debil mental',
      'aleijado', 'aleijada', 'capenga',
      'viado', 'viadinho', 'bicha', 'baitola', 'boiola', 'traveco', 'sapatao',
      'crioulo', 'preto fedido', 'preta fedida', 'preto imundo', 'volta pra senzala',
      'seu macaco', 'sua macaca', 'nazista', 'heil hitler', 'viva hitler',
      'hitler tinha razao', 'supremacia branca'
    ],
    ameaca: [
      'vou te matar', 'vou matar voce', 'vou matar vc', 'te matar', 'te mato',
      'vou te bater', 'vou te socar', 'vou te dar uma surra', 'vou te esfaquear',
      'quebrar sua cara', 'arrebentar sua cara', 'vou acabar com voce',
      'vou acabar com vc', 'sei onde voce mora', 'sei onde vc mora', 'vou te achar',
      'te espero na saida', 'te encontro na saida', 'levar faca pra escola',
      'levar arma pra escola', 'atirar na escola', 'atirar em todo mundo',
      'matar todo mundo', 'matar geral', 'fazer um massacre', 'tiroteio na escola',
      'explodir a escola'
    ],
    /* Mandar outra pessoa se matar. É a linha mais grave do bullying
       adolescente e por isso é ofensa, não crise. */
    bullying: [
      'se mata', 'vai se matar', 'se mata logo', 'morre logo', 'vai morrer logo',
      'ninguem gosta de voce', 'ninguem gosta de vc', 'ninguem te aguenta',
      'ninguem te suporta', 'voce e um erro', 'vc e um erro',
      'voce nao deveria ter nascido', 'vc nao deveria ter nascido',
      'o mundo seria melhor sem voce', 'ninguem sentiria sua falta',
      'volta pro seu buraco', 'some da comunidade'
    ],
    pornografia: [
      'porno', 'pornografia', 'pornhub', 'xvideos', 'xnxx', 'onlyfans', 'hentai',
      'rule34', 'nsfw', 'nudes', 'nude', 'manda nudes', 'mandar nudes',
      'pack de nudes', 'vender pack', 'foto pelada', 'fotos peladas', 'video de sexo',
      'se masturbar', 'masturbacao', 'punheta', 'siririca', 'pau duro', 'rola dura',
      'gozar', 'gozada', 'tesao', 'sexo anal', 'sexo oral', 'boquete',
      'chupar o pau', 'novinha safada'
    ],
    crime: [
      'como roubar', 'vamos roubar', 'roubar uma loja', 'assaltar', 'assalto a mao armada',
      'vender droga', 'vender drogas', 'traficar', 'trafico de drogas',
      'comprar arma', 'arma ilegal', 'fazer uma bomba', 'bomba caseira',
      'coquetel molotov', 'como hackear', 'clonar cartao', 'cartao roubado'
    ]
  };

  /* ── xingamento leve: SÓ conta com um alvo declarado. ───────────
     "você é burro" → ofensa (bloqueia).
     "eu sou burro" → cuidado (card acolhedor, NÃO bloqueia).
     "meu cachorro é gordo" → não é nada.
     Autodepreciação é o pão de cada dia num espaço de apoio pra
     adolescentes autistas; bloquear por isso seria punir a dor. */
  var LEVE = [
    'burro', 'burra', 'idiota', 'imbecil', 'estupido', 'estupida', 'babaca',
    'bobo', 'boba', 'inutil', 'fracassado', 'fracassada', 'fracasso', 'lixo',
    'ridiculo', 'ridicula', 'patetico', 'patetica', 'nojento', 'nojenta',
    'feio', 'feia', 'gordo', 'gorda', 'jumento', 'trouxa', 'panaca', 'anormal',
    'incapaz', 'burrice', 'estorvo', 'peso morto'
  ];
  var ALVO_OUTRO = ['seu', 'sua', 'voce e', 'voce eh', 'vc e', 'vc eh', 'tu e',
    'tu eh', 'tu es', 'voces sao', 'vcs sao', 'ele e um', 'ela e uma'];
  var ALVO_EU = ['sou', 'eu sou', 'sou um', 'sou uma', 'sou tao', 'so sou',
    'me sinto', 'eu me sinto', 'me sinto tao', 'me acho', 'acho que sou',
    'sinto que sou', 'sempre fui', 'me chamam de', 'me chamaram de',
    'disseram que sou', 'todo mundo diz que sou'];

  /* ── apoio: publica normalmente, mas o Lumi Theo dá um aceno.
        Veio do antigo checarSinais() do js/chat.js. Frases comuns
        demais pra bloquear e sérias demais pra ignorar. ──────── */
  var APOIO = [
    'nao aguento mais', 'to no meu limite', 'estou no meu limite', 'to muito mal',
    'estou muito mal', 'to mal demais', 'to me sentindo horrivel',
    'nao consigo mais', 'to cansado de tudo', 'to cansada de tudo',
    'me sinto sozinho', 'me sinto sozinha', 'ninguem me entende',
    'to sem forcas', 'estou sem forcas', 'tudo da errado comigo',
    'queria sumir', 'so queria sumir', 'to surtando', 'to em crise'
  ];

  /* ── exceções: trechos em que o termo é inofensivo. São apagados
        do texto ANTES da busca, então "matar aula" nunca vira ameaça
        e "sexo feminino" nunca vira assunto adulto. ───────────── */
  var EXCECOES = [
    'matar aula', 'matar a aula', 'matar a saudade', 'matar o tempo',
    'matar a charada', 'matar a curiosidade', 'matar o boss', 'matar o chefe',
    'matar zumbi', 'matar zumbis', 'matar mob', 'matar mobs', 'matar no jogo',
    'matar a fome', 'matar a sede',
    'morrer de rir', 'morrer de fome', 'morrer de sono', 'morrer de calor',
    'morrer de frio', 'morrer de vergonha', 'morrer de amores', 'morrer de medo',
    'de morrer de',
    'sexo masculino', 'sexo feminino', 'sexo biologico', 'educacao sexual',
    'jogar pelada', 'uma pelada', 'pelada de rua',
    'porra louca'
  ];

  /* ══════════════════════════════════════════════════════════
     2. NORMALIZAÇÃO
     ══════════════════════════════════════════════════════════ */

  /* Os acentos são descartados pelo código do caractere (faixa
     U+0300–U+036F depois do NFD) e não por uma classe de regex com os
     caracteres literais — mesmo motivo do slugCat() do comunidade.js:
     acento solto é invisível no editor e some numa "arrumação" de
     encoding sem ninguém perceber. */
  function semAcento(s) {
    return String(s == null ? '' : s).normalize('NFD').split('').filter(function (ch) {
      var n = ch.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    }).join('');
  }

  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i' };

  function normalizar(t) {
    var s = semAcento(String(t == null ? '' : t)).toLowerCase();
    s = s.replace(/[013457@$!|]/g, function (c) { return LEET[c] || c; });
    s = s.replace(/[^a-z0-9]+/g, ' ');
    // "fodaaaa" → "foda": 3 repetições ou mais viram uma só
    s = s.replace(/([a-z])\1{2,}/g, '$1');
    return ' ' + s.trim().replace(/\s+/g, ' ') + ' ';
  }

  function limparExcecoes(norm) {
    var s = norm;
    for (var i = 0; i < EXCECOES.length; i++) {
      var alvo = ' ' + EXCECOES[i] + ' ';
      while (s.indexOf(alvo) !== -1) s = s.replace(alvo, ' ');
    }
    return s;
  }

  // busca por palavra inteira: o termo tem que estar cercado de espaço
  function achar(norm, termo) {
    var i = norm.indexOf(' ' + termo + ' ');
    return i === -1 ? -1 : i + 1;
  }

  /* ══════════════════════════════════════════════════════════
     3. PADRÕES (dado pessoal que nenhuma lista de palavras pega)
     Rodam no texto ORIGINAL: o normalizador destrói pontuação e
     traduz dígito em letra, então @ e telefone precisam vir antes.
     ══════════════════════════════════════════════════════════ */
  function acharPadroes(texto) {
    var t = String(texto || '');
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) {
      return { nivel: 'cuidado', categoria: 'dados_pessoais', termo: 'e-mail' };
    }
    if (/(^|[^a-z0-9])@[a-z0-9._]{3,}/i.test(t)) {
      return { nivel: 'cuidado', categoria: 'dados_pessoais', termo: 'perfil de rede social' };
    }
    /* Telefone: sequência de dígitos com os separadores de sempre que,
       sem eles, tem de 10 a 13 dígitos (DDD + número, com ou sem o 55).
       O teto de 13 evita pegar código/id colado por engano, e o teto de
       3 espaços evita pegar uma lista de números ("1 2 3 4 5 6 7 8 9 10"),
       porque telefone escrito à mão não tem mais que dois. */
    var m = t.match(/(?:\+?\d[\s().+-]{0,3}){10,16}/);
    if (m) {
      // o quantificador é guloso e leva junto o separador do fim
      var seq = m[0].replace(/[\s().+-]+$/, '');
      var digitos = seq.replace(/\D/g, '').length;
      var espacos = (seq.match(/\s/g) || []).length;
      // sem nenhum separador, exige 11 dígitos (celular com DDD): 10 dígitos
      // seguidos ainda podem ser pontuação de jogo ("fiz 1000000000 pontos")
      var minimo = /^\d+$/.test(seq) ? 11 : 10;
      if (digitos >= minimo && digitos <= 13 && espacos <= 3) {
        return { nivel: 'cuidado', categoria: 'dados_pessoais', termo: 'telefone' };
      }
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     4. ANÁLISE
     Devolve { nivel, categoria, termo }. Ordem importa: risco antes
     de tudo (uma frase de crise que também tem palavrão é crise, e
     crise não bloqueia ninguém).
     ══════════════════════════════════════════════════════════ */
  function varrer(grupos, norm, nivel) {
    for (var cat in grupos) {
      if (!Object.prototype.hasOwnProperty.call(grupos, cat)) continue;
      var termos = grupos[cat];
      for (var i = 0; i < termos.length; i++) {
        if (achar(norm, termos[i]) !== -1) {
          return { nivel: nivel, categoria: cat, termo: termos[i] };
        }
      }
    }
    return null;
  }

  function varrerLeve(norm) {
    for (var i = 0; i < LEVE.length; i++) {
      var pos = achar(norm, LEVE[i]);
      if (pos === -1) continue;
      // 28 caracteres antes do termo bastam pra "todo mundo diz que sou "
      var janela = norm.slice(Math.max(0, pos - 28), pos);
      if (ALVO_EU.some(function (m) { return janela.indexOf(' ' + m + ' ') !== -1; })) {
        return { nivel: 'cuidado', categoria: 'autoimagem', termo: LEVE[i] };
      }
      if (ALVO_OUTRO.some(function (m) { return janela.indexOf(' ' + m + ' ') !== -1; })) {
        return { nivel: 'ofensa', categoria: 'xingamento', termo: LEVE[i] };
      }
      // sem alvo declarado não é ofensa nenhuma ("meu cachorro é gordo")
    }
    return null;
  }

  function analisar(texto) {
    var bruto = String(texto || '');
    if (!bruto.trim()) return { nivel: 'ok' };
    var norm = limparExcecoes(normalizar(bruto));

    return varrer(RISCO, norm, 'risco')
      || varrer(OFENSA, norm, 'ofensa')
      || varrerLeve(norm)
      || varrer(CUIDADO, norm, 'cuidado')
      || acharPadroes(bruto)
      || (APOIO.some(function (s) { return achar(norm, s) !== -1; })
            ? { nivel: 'apoio', categoria: 'sofrimento', termo: '' }
            : { nivel: 'ok' });
  }

  /* ══════════════════════════════════════════════════════════
     5. ESTADO DO BLOQUEIO
     A tabela manda; o localStorage é só o espelho que deixa a UI
     responder sem esperar a rede (e funcionar se o schema novo
     ainda não tiver sido aplicado no projeto).
     ══════════════════════════════════════════════════════════ */
  var cfg = { sb: null, userId: null, publico: 'teen', nome: 'você' };
  var bloqueadoAte = null;          // Date | null
  var bloqueadoPermanente = false;  // 4ª+ ofensa: só o cuidador libera (liberar_bloqueio_comunidade)
  var ouvintes = [];

  function lerLocal() {
    try {
      var v = localStorage.getItem(CHAVE_LOCAL);
      if (!v) return null;
      var d = new Date(v);
      return isNaN(d.getTime()) || d <= new Date() ? null : d;
    } catch (e) { return null; }
  }
  function gravarLocal(d) {
    try {
      if (d) localStorage.setItem(CHAVE_LOCAL, d.toISOString());
      else localStorage.removeItem(CHAVE_LOCAL);
    } catch (e) {}
  }

  var timerFim = null;
  /* `registrar_ocorrencia_moderacao` só devolve o `ate` (timestamptz), não
     a coluna `permanente` — o banimento (4ª+ ofensa) grava um `ate` bem no
     futuro (100 anos) como sentinela, então detectar por aí é suficiente e
     evita mudar a assinatura da RPC. `sincronizar()` usa o valor real da
     coluna quando disponível (mais preciso), essa função é só o plano B. */
  function pareceSentinelaPermanente(d) {
    return !!(d && (d.getFullYear() - new Date().getFullYear()) > 1);
  }

  function definirBloqueio(d, permanenteExplicito) {
    bloqueadoAte = (d && d > new Date()) ? d : null;
    bloqueadoPermanente = bloqueadoAte
      ? (permanenteExplicito !== undefined ? !!permanenteExplicito : pareceSentinelaPermanente(bloqueadoAte))
      : false;
    gravarLocal(bloqueadoAte);
    /* A pausa tem que acabar sozinha: sem isto, quem deixou a aba aberta
       continuaria com o compositor desligado depois da hora, mesmo o
       banco já aceitando de novo. */
    if (timerFim) { clearTimeout(timerFim); timerFim = null; }
    if (bloqueadoAte) {
      var ms = Math.min(bloqueadoAte - new Date() + 1000, 2147483647);
      timerFim = setTimeout(function () { definirBloqueio(null); }, ms);
    }
    ouvintes.forEach(function (fn) {
      try { fn(bloqueadoAte); } catch (e) {}
    });
  }

  function bloqueado() { return !!(bloqueadoAte && bloqueadoAte > new Date()); }

  function horaFim() {
    if (!bloqueadoAte) return '';
    return bloqueadoAte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* Lê o bloqueio ativo direto da tabela. Chamado no início e sempre que
     um insert volta sem linha (sinal de que o gatilho do banco derrubou a
     mensagem — ver comentário em `db/MODERACAO_SCHEMA.sql`). */
  async function sincronizar() {
    if (!cfg.sb || !cfg.userId) return bloqueadoAte;
    try {
      var r = await cfg.sb.from('comunidade_bloqueios')
        .select('ate, permanente').eq('user_id', cfg.userId)
        .gt('ate', new Date().toISOString())
        .order('ate', { ascending: false }).limit(1);
      if (r.error) {
        // schema ainda não aplicado: segue com o espelho local
        console.warn('[moderacao] bloqueios:', r.error.message);
        return bloqueadoAte;
      }
      var linha = r.data && r.data[0];
      definirBloqueio(linha ? new Date(linha.ate) : null, linha ? linha.permanente : false);
    } catch (e) { console.warn('[moderacao] bloqueios:', e.message); }
    return bloqueadoAte;
  }

  async function iniciar(opts) {
    opts = opts || {};
    cfg.sb = opts.sb || cfg.sb;
    cfg.userId = opts.userId || cfg.userId;
    cfg.publico = opts.publico || cfg.publico;
    cfg.nome = opts.nome || cfg.nome;
    definirBloqueio(lerLocal());
    await sincronizar();
    return bloqueadoAte;
  }

  /* Grava a ocorrência: bloqueio (só em 'ofensa') + alerta pro cuidador.
     Uma RPC SECURITY DEFINER porque o adolescente não pode ter permissão
     de escrever `ate` à vontade — senão bastaria um insert com ate no
     passado pra se livrar da pausa. */
  async function registrar(r, contexto) {
    if (!cfg.sb || !cfg.userId) return null;
    try {
      var res = await cfg.sb.rpc('registrar_ocorrencia_moderacao', {
        p_nivel: r.nivel, p_categoria: r.categoria, p_contexto: contexto || 'comunidade'
      });
      if (res.error) throw res.error;
      if (res.data) { definirBloqueio(new Date(res.data)); return bloqueadoAte; }
      return null;
    } catch (e) {
      console.warn('[moderacao] registrar:', e.message);
      /* Sem a RPC (schema não aplicado) o bloqueio ainda vale nesta
         sessão — melhor um freio contornável do que nenhum. */
      if (r.nivel === 'ofensa') {
        definirBloqueio(new Date(Date.now() + MINUTOS_BLOQUEIO * 60000));
      }
      return bloqueadoAte;
    }
  }

  /* ══════════════════════════════════════════════════════════
     6. O CARD
     Sem contagem regressiva correndo na tela: relógio piscando é
     movimento e ansiedade. Mostra o horário de volta, parado.
     ══════════════════════════════════════════════════════════ */
  var CVV = 'Se estiver muito pesado agora, o CVV atende de graça no 188, 24 horas por dia.';

  function textos(r) {
    var cuidador = cfg.publico === 'cuidador';
    var cat = r.categoria;

    /* Já está em pausa e tentou escrever de novo: não repete a bronca,
       só lembra quando volta. */
    if (cat === 'pausa') {
      if (bloqueadoPermanente) {
        return {
          titulo: 'A comunidade está pausada pra você',
          corpo: ['Depois de várias mensagens que precisaram ser bloqueadas, só seu cuidador pode liberar a ' +
                  'comunidade de novo pra você. Dá pra ler tudo normalmente enquanto isso.',
                  'Se quiser conversar, eu tô aqui.']
        };
      }
      return {
        titulo: 'A comunidade está em pausa pra você',
        corpo: [horaFim()
          ? 'Você volta a escrever por aqui às ' + horaFim() + '. Até lá dá pra ler tudo normalmente.'
          : 'Daqui a pouco você já pode escrever de novo. Até lá dá pra ler tudo normalmente.',
          'Se quiser conversar enquanto isso, eu tô aqui.']
      };
    }

    /* O gatilho do banco recusou algo que o filtro daqui deixou passar.
       Sem saber o motivo exato, o texto fica genérico e sem acusação. */
    if (r.nivel === 'recusado') {
      return {
        titulo: 'Não consegui publicar isso',
        corpo: ['Essa mensagem não passou pelo cuidado da comunidade, então ela não foi publicada.',
                'Tenta escrever de outro jeito — ou, se for algo pesado, vem falar comigo em particular.']
      };
    }

    if (r.nivel === 'risco') {
      if (cat === 'abuso') {
        return {
          titulo: 'Eu li o que você escreveu',
          corpo: ['Isso que você contou é sério e não é culpa sua. Eu não vou publicar aqui no mural — ' +
                  'não porque você fez algo errado, mas porque isso merece um lugar mais seguro que uma sala aberta.',
                  'Conta pra mim ou pra um adulto em quem você confia. Você não precisa lidar com isso sozinho.',
                  CVV]
        };
      }
      return {
        titulo: 'Fico aqui com você',
        corpo: ['Percebi uma dor grande no que você escreveu, então preferi não publicar isso na sala — ' +
                'quero falar com você primeiro. Você não está encrencado. Você importa.',
                'Se der, chama agora um adulto de confiança pra ficar perto de você.',
                CVV]
      };
    }

    if (r.nivel === 'apoio') {
      return {
        titulo: 'Tô por aqui',
        corpo: ['Li o que você mandou e queria dizer que você não está sozinho nisso. Sua mensagem foi publicada normalmente.',
                'Se quiser desabafar com calma, é só me chamar.']
      };
    }

    if (r.nivel === 'cuidado') {
      if (cat === 'dados_pessoais') {
        return {
          titulo: 'Isso é melhor guardar pra você',
          corpo: ['Não publiquei essa mensagem porque ela tem um dado que te identifica ou diz onde te achar — ' +
                  'telefone, endereço, rede social, foto, esse tipo de coisa.',
                  'Aqui a gente conversa sem trocar contato. Se alguém pedir isso pra você, ou pedir segredo, ' +
                  'conta pra um adulto de confiança.']
        };
      }
      if (cat === 'sexualidade') {
        return {
          titulo: 'Vamos falar disso em particular',
          corpo: ['Essa é uma dúvida legítima, mas o mural é aberto pra outros adolescentes, então não publiquei.',
                  'Me pergunta na conversa privada, ou fala com um adulto de confiança. Não tem nada de errado em querer entender.']
        };
      }
      if (cat === 'substancias') {
        return {
          titulo: 'Melhor conversar sobre isso comigo',
          corpo: ['Não publiquei essa mensagem no mural. Esse assunto pede uma conversa com calma, não uma sala aberta.',
                  'Se isso está acontecendo perto de você, ou com você, me conta — ou fala com um adulto de confiança.']
        };
      }
      // autoimagem
      return {
        titulo: 'Ei, pega leve com você',
        corpo: ['Não publiquei o que você escreveu porque você falou de você de um jeito bem duro. ' +
                'Você não é nada disso.',
                'Quer conversar comigo sobre o que aconteceu hoje?']
      };
    }

    // ofensa
    if (bloqueadoPermanente) {
      return {
        titulo: 'A comunidade foi pausada pra você',
        corpo: [cuidador
          ? 'Essa mensagem não foi publicada. Depois de várias mensagens bloqueadas, a comunidade fica pausada até o cuidador vinculado liberar de novo.'
          : 'Essa mensagem não foi publicada. Isso já aconteceu várias vezes, então agora só seu cuidador pode liberar a comunidade de novo pra você.',
          'Enquanto isso, se algo te deixou com raiva ou magoado, vem conversar comigo. Eu escuto.']
      };
    }
    var quanto = MINUTOS_BLOQUEIO === 60 ? '1 hora' : MINUTOS_BLOQUEIO + ' minutos';
    return {
      titulo: 'Essa mensagem não pode ficar aqui',
      corpo: [cuidador
        ? 'Essa mensagem não foi publicada: ela machuca quem está do outro lado. A comunidade fica em pausa pra você por ' + quanto + '.'
        : 'Essa mensagem não foi publicada, porque ela machuca quem está do outro lado. A comunidade fica em pausa pra você por ' + quanto + ' — não é castigo, é um tempo pra respirar.',
        (horaFim() ? 'Você volta a escrever por aqui às ' + horaFim() + '.' : ''),
        'Enquanto isso, se algo te deixou com raiva ou magoado, vem conversar comigo. Eu escuto.']
    };
  }

  function linkTheo() {
    return cfg.publico === 'cuidador' ? 'consultoria-cuidador.html' : 'conversa.html';
  }

  function mostrarCard(r) {
    var t = textos(r);
    var corpo = t.corpo.filter(Boolean).map(function (p) {
      return '<p>' + esc(p) + '</p>';
    }).join('');

    var html = '<div class="mod-card-txt">' + corpo + '</div>';

    if (g.LumiUI && g.LumiUI.painel) {
      return g.LumiUI.painel({
        titulo: t.titulo,
        html: html,
        /* urso-estrelhinha e não urso-conersando: aquele é uma cena de
           1536×1024 (1,3 MB) que vira um borrão nos 76px do card. */
        mascote: 'img/urso-estrelhinha.png',
        classe: 'mod-card mod-card--' + r.nivel,
        acoes: [
          { texto: 'Agora não', tipo: 'ghost' },
          { texto: 'Conversar com o Lumi Theo', tipo: 'primary', href: linkTheo() }
        ]
      });
    }
    // sem ui.js na página: o aviso ainda tem que chegar
    if (g.LumiUI && g.LumiUI.alert) return g.LumiUI.alert(t.corpo.filter(Boolean).join('\n\n'), { titulo: t.titulo });
    alert(t.titulo + '\n\n' + t.corpo.filter(Boolean).join('\n\n'));
    return Promise.resolve();
  }

  /* ══════════════════════════════════════════════════════════
     7. O PORTÃO — é isso que chat.js e comunidade.js chamam
     ══════════════════════════════════════════════════════════ */

  /* true  = pode publicar
     false = não publica (o card já foi mostrado ao usuário) */
  async function checar(texto, contexto) {
    if (bloqueado()) {
      mostrarCard({ nivel: 'ofensa', categoria: 'pausa' });
      return false;
    }
    var r = analisar(texto);
    if (r.nivel === 'ok') return true;
    if (r.nivel === 'apoio') { mostrarCard(r); return true; }

    await registrar(r, contexto || 'comunidade');
    mostrarCard(r);
    return false;
  }

  /* Rede de segurança do outro lado: se o gatilho do banco derrubar uma
     linha que o filtro do navegador deixou passar, o insert volta sem
     linha nenhuma. Quem chamou avisa aqui, a gente relê o bloqueio e
     mostra o card certo. */
  async function conferirSumico() {
    await sincronizar();
    mostrarCard(bloqueado()
      ? { nivel: 'ofensa', categoria: 'pausa' }
      : { nivel: 'recusado', categoria: 'servidor' });
  }

  /* PostgREST não avisa "moderei sua mensagem" — ele avisa que não veio
     linha (PGRST116, gatilho descartou) ou que a política recusou
     (42501, pausa ativa). Quem insere pergunta aqui se o erro é isso. */
  function ehModeracao(err) {
    return !!err && (err.code === 'PGRST116' || err.code === '42501');
  }

  g.Moderacao = {
    // análise (puro, testável sem rede)
    normalizar: normalizar,
    analisar: analisar,
    LISTAS: { RISCO: RISCO, CUIDADO: CUIDADO, OFENSA: OFENSA, LEVE: LEVE, APOIO: APOIO, EXCECOES: EXCECOES },
    MINUTOS_BLOQUEIO: MINUTOS_BLOQUEIO,
    // estado
    iniciar: iniciar,
    sincronizar: sincronizar,
    bloqueado: bloqueado,
    horaFim: horaFim,
    aoMudarBloqueio: function (fn) { ouvintes.push(fn); try { fn(bloqueadoAte); } catch (e) {} },
    // uso
    checar: checar,
    ehModeracao: ehModeracao,
    conferirSumico: conferirSumico,
    mostrarCard: mostrarCard
  };
})(window);
