/* ================================================================
   LUMI — lumi-ia.js
   Integração client-side com a Groq API.
   ================================================================ */

var LumiIA = (function () {
  // A chave da Groq vive NO SERVIDOR (Supabase Edge Function "groq-proxy").
  // O cliente só conhece a URL do proxy e envia a sessão do usuário.
  function cfg() { return (window.LUMITEA || {}); }
  function proxyUrl() {
    return (cfg().GROQ_PROXY_URL) ||
           ((cfg().SUPABASE_URL || '').replace(/\/+$/, '') + '/functions/v1/groq-proxy');
  }
  function temChave() { return !!(cfg().SUPABASE_URL); }
  async function authHeader() {
    try {
      var c = window.supabaseClient;
      if (c && c.auth && c.auth.getSession) {
        var r = await c.auth.getSession();
        var tok = r && r.data && r.data.session && r.data.session.access_token;
        if (tok) return 'Bearer ' + tok;
      }
    } catch (e) {}
    return 'Bearer ' + (cfg().SUPABASE_ANON_KEY || '');
  }

  var PERSONALIDADE_BASE =
    'Você é o Lumi Theo, psicólogo especializado em TEA ' +
    'que acompanha um adolescente autista.\n\n' +
    'PERSONALIDADE FIXA (não mude nunca):\n' +
    '- Fala simples e direta, sem termos técnicos\n' +
    '- Empática, NUNCA julgadora\n' +
    '- Máximo 2 emojis por resposta\n' +
    '- NUNCA finge que emoções difíceis não existem\n' +
    '- VALIDE sempre os sentimentos antes de sugerir qualquer coisa\n' +
    '- Regra importante: validar o SENTIMENTO nunca é validar uma AÇÃO que machucou alguém — o próprio\n' +
    '  adolescente ou outra pessoa (violência, agressão física, ameaça, autolesão). Se o relato descrever\n' +
    '  algo assim, acolha o sentimento por trás (raiva, frustração, desespero) mas diga com clareza e sem\n' +
    '  julgar a pessoa que a ação em si não foi certa, oriente um passo de reparação (pedir desculpa,\n' +
    '  conversar com a pessoa) ou buscar um adulto de confiança — nunca elogie, comemore ou trate a ação\n' +
    '  como normal do dia\n' +
    '- Quando aprender algo novo sobre o usuário, diga: "Vou lembrar disso!"\n' +
    '- Responda SEMPRE em português brasileiro\n' +
    '- MÁXIMO 3 parágrafos curtos\n' +
    '- Em sofrimento intenso ou sinal de risco à própria vida, priorize acolhimento e oriente buscar ajuda\n' +
    '  agora (adulto de confiança ou CVV 188) em vez de qualquer outra sugestão — você NÃO substitui\n' +
    '  acompanhamento profissional\n\n' +
    'FORMATO:\n- Sem markdown (sem **, sem ##, sem listas com -)\n- Frases curtas\n- Quebras de parágrafo naturais';

  function montarSystemPrompt(perfil, contextoExtra) {
    var partes = [PERSONALIDADE_BASE];
    var apelido = (perfil && (perfil.apelido || perfil.nome)) || 'amigo';
    var nomeMascote = (perfil && perfil.nome_mascote) || 'Lumi Theo';
    partes.push(''); partes.push('SOBRE O ADOLESCENTE:');
    partes.push('- Como ele(a) prefere ser chamado(a): ' + apelido);
    partes.push('- Como ele(a) chama você: ' + nomeMascote);
    if (perfil && perfil.nivel) partes.push('- Nível atual no app: ' + perfil.nivel);
    if (perfil && perfil.humorRecente !== undefined && perfil.humorRecente !== null) {
      var labels = ['com raiva','ansioso','triste','mais ou menos','bem','ótimo'];
      partes.push(''); partes.push('HUMOR RECENTE: "' + (labels[perfil.humorRecente] || 'neutro') + '" (nível ' + perfil.humorRecente + '/5).');
    }
    if (contextoExtra) { partes.push(''); partes.push(contextoExtra); }
    return partes.join('\n');
  }

  async function chamarGroq(messages, opts) {
    opts = opts || {};
    var modelPrimary = cfg().GROQ_MODEL || 'openai/gpt-oss-120b';
    var modelFallback = 'openai/gpt-oss-20b';
    var url = proxyUrl();
    var auth = await authHeader();
    var anon = cfg().SUPABASE_ANON_KEY || '';
    async function tentar(model) {
      var body = { model: model, messages: messages,
        max_tokens: opts.maxTokens || 700, temperature: opts.temperature || 0.78 };
      var res;
      if (cfg().groqFetch) {
        res = await cfg().groqFetch(body);
      } else {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'apikey': anon },
          body: JSON.stringify(body)
        });
      }
      if (!res.ok) {
        var detail = await res.text().catch(function () { return ''; });
        throw new Error('Groq HTTP ' + res.status + ': ' + detail.slice(0, 200));
      }
      var data = await res.json();
      var text = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      if (!text) throw new Error('Groq retornou vazio');
      return text;
    }
    try { return await tentar(modelPrimary); }
    catch (e1) {
      console.warn('[LumiIA] primário falhou:', e1.message);
      try { return await tentar(modelFallback); }
      catch (e2) { console.error('[LumiIA] fallback falhou:', e2.message); throw e2; }
    }
  }

  function indisponivelTexto() {
    return 'O Lumi Theo não está conseguindo conectar agora. Verifique sua conexão e tente de novo em alguns segundos. 🐻';
  }

  async function responder(historico, opts, perfil) {
    if (!temChave()) return { texto: 'A IA não está configurada (Supabase ausente).' };
    var systemPrompt = montarSystemPrompt(perfil || {}, opts && opts.contextoExtra);
    var messages = [{ role: 'system', content: systemPrompt }];
    var hist = (historico || []).slice(-20);
    for (var i = 0; i < hist.length; i++) {
      var m = hist[i];
      if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
        messages.push({ role: m.role, content: m.content });
      }
    }
    try {
      var texto = await chamarGroq(messages, { maxTokens: 700, temperature: 0.78 });
      return { texto: texto.trim() };
    } catch (e) { return { texto: indisponivelTexto() }; }
  }

  async function enviar(texto, perfil) {
    var r = await responder([{ role: 'user', content: texto }], null, perfil);
    return r.texto;
  }

  async function enviarRoleplay(historico, cenario, perfil) {
    if (!temChave()) return indisponivelTexto();
    var ctx = '';
    if (cenario) {
      ctx = 'CONTEXTO DE ROLEPLAY:\nCENÁRIO: ' + (cenario.nome || '') + '\nCONTEXTO: ' + (cenario.contexto || '') + '\nSEU PAPEL: ' + (cenario.personagem || '') + '\nVocê está fazendo um PERSONAGEM, não o Lumi Theo. Máximo 2-3 frases.';
    }
    var r = await responder(historico, { contextoExtra: ctx, maxTokens: 400, temperature: 0.85 }, perfil);
    return r.texto;
  }

  async function analisarDiario(textoDiario) {
    if (!temChave()) return null;
    try {
      var t = await chamarGroq([
        { role: 'system', content: 'Você é o Lumi Theo. Analise o diário e responda em até 3 parágrafos, validando sentimentos antes. PT-BR sem markdown.' },
        { role: 'user', content: textoDiario }
      ], { maxTokens: 500, temperature: 0.7 });
      return t.trim();
    } catch (e) { return null; }
  }

  async function gerarRelatorio(dados) {
    if (!temChave()) return null;
    try {
      var t = await chamarGroq([
        { role: 'system', content: 'Você é o Lumi Theo. Gere relatório breve para o cuidador. Tom acolhedor. Máx 4 parágrafos.' },
        { role: 'user', content: JSON.stringify(dados).slice(0, 4000) }
      ], { maxTokens: 700, temperature: 0.6 });
      return t.trim();
    } catch (e) { return null; }
  }

  async function sugerirRespostasRapidas(historico) {
    if (!temChave()) return [];
    var ultimas = (historico || []).slice(-4).map(function (m) {
      return (m.role === 'user' ? 'Adolescente: ' : 'Lumi Theo: ') + m.content;
    }).join('\n');
    try {
      var t = await chamarGroq([
        { role: 'system', content: 'Sugira 3 respostas curtas (máx 6 palavras). Devolva APENAS JSON: ["...","...","..."]' },
        { role: 'user', content: ultimas || 'Início de conversa.' }
      ], { maxTokens: 120, temperature: 0.6 });
      var match = t.match(/\[[\s\S]*\]/);
      if (!match) return [];
      var arr = JSON.parse(match[0]);
      return Array.isArray(arr) ? arr.slice(0, 3) : [];
    } catch (e) { return []; }
  }

  return {
    enviar: enviar, responder: responder, enviarRoleplay: enviarRoleplay,
    analisarDiario: analisarDiario, gerarRelatorio: gerarRelatorio,
    sugerirRespostasRapidas: sugerirRespostasRapidas,
    avaliarRoleplay: function () { return Promise.resolve(null); },
    analisar: analisarDiario,
    sugerirResposta: function () { return Promise.resolve(null); },
    revisarPost: function () { return Promise.resolve(null); },
    sugerirRoupa: function () { return Promise.resolve(null); },
    getCenarios: function () { return {}; }
  };
})();
