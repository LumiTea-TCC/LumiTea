/* ============================================================
   LumiTEA — config.js
   Configuração central. Carregue ANTES dos outros scripts.
   ============================================================ */
(function (g) {
  g.LUMITEA = g.LUMITEA || {};
  g.LUMITEA.SUPABASE_URL      = 'https://yuwdckenzpfdlyawkibn.supabase.co';
  g.LUMITEA.SUPABASE_ANON_KEY = 'sb_publishable_JtP1wsTu2QQ1xFjlrDBu9g_ZKYkW59N';

  // Chaves de API vêm de secrets.js (não versionado). Veja secrets.example.js.
  var SECRETS = g.LUMITEA_SECRETS || {};

  // ── Origem de desenvolvimento? ──────────────────────────────────────────
  // As chaves de API SÓ podem tocar o navegador em DEV (localhost / arquivo
  // local). Em QUALQUER origem pública, as chaves são ignoradas e a IA/voz
  // passam OBRIGATORIAMENTE pelos proxies (Edge Functions), que guardam a chave
  // no servidor. Assim a chave nunca é exposta no site publicado.
  var _host = (g.location && g.location.hostname) || '';
  g.LUMITEA.IS_DEV = (g.location && g.location.protocol === 'file:') ||
    _host === 'localhost' || _host === '0.0.0.0' || _host === '[::1]' ||
    /\.local$/.test(_host) ||
    // IPs privados / loopback (teste em rede local, ex.: celular no mesmo Wi-Fi)
    /^127\./.test(_host) || /^10\./.test(_host) || /^192\.168\./.test(_host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(_host) || /^169\.254\./.test(_host);
  function _devKey(v) { return g.LUMITEA.IS_DEV ? (v || '') : ''; }

  // IA (Groq). Em DEV usa a chave de secrets.js (direto, sem deploy).
  // Em produção: sem chave no cliente → usa o proxy "groq-proxy".
  g.LUMITEA.GROQ_MODEL     = 'llama-3.3-70b-versatile';
  g.LUMITEA.GROQ_API_KEY   = _devKey(SECRETS.GROQ_API_KEY);
  g.LUMITEA.GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions';
  g.LUMITEA.GROQ_PROXY_URL = g.LUMITEA.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/groq-proxy';

  // Escape de HTML (defesa contra XSS ao injetar texto de IA/usuário via innerHTML).
  g.LUMITEA.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  // Versão que preserva quebras de linha como <br> (texto já escapado).
  g.LUMITEA.escBr = function (s) { return g.LUMITEA.esc(s).replace(/\n/g, '<br>'); };

  // Helper único de IA: manda o corpo {model,messages,max_tokens,temperature}
  // pro proxy (que guarda a chave), autenticando com a sessão do usuário.
  // Devolve uma Response com o MESMO formato da Groq (d.choices[0].message...),
  // então o código existente das páginas continua funcionando.
  g.LUMITEA.groqFetch = async function (body) {
    // Caminho direto (chave no navegador) — funciona sem deploy.
    if (g.LUMITEA.GROQ_API_KEY) {
      return fetch(g.LUMITEA.GROQ_DIRECT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + g.LUMITEA.GROQ_API_KEY
        },
        body: JSON.stringify(body)
      });
    }
    // Sem chave no cliente (produção): usa o proxy (Edge Function "groq-proxy"),
    // que guarda a GROQ_API_KEY no servidor e autentica pela sessão do usuário.
    var anon = g.LUMITEA.SUPABASE_ANON_KEY || '';
    var auth = anon;
    try {
      if (g.supabaseClient && g.supabaseClient.auth && g.supabaseClient.auth.getSession) {
        var r = await g.supabaseClient.auth.getSession();
        var tok = r && r.data && r.data.session && r.data.session.access_token;
        if (tok) auth = tok;
      }
    } catch (e) {}
    return fetch(g.LUMITEA.GROQ_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + auth,
        'apikey': anon
      },
      body: JSON.stringify(body)
    });
  };

  // ElevenLabs (voz) — a chave vive NO SERVIDOR (Edge Function "eleven-proxy").
  // O navegador chama o proxy autenticado com a sessão do usuário.
  g.LUMITEA.ELEVEN_PROXY_URL = g.LUMITEA.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/eleven-proxy';
  g.LUMITEA.ELEVEN_API_KEY  = _devKey(SECRETS.ELEVEN_API_KEY);
  g.LUMITEA.ELEVEN_VOICE_ID = SECRETS.ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  // Transcreve um Blob de áudio. Direto na ElevenLabs se houver chave; senão proxy.
  g.LUMITEA.elevenSTT = async function (blob) {
    if (g.LUMITEA.ELEVEN_API_KEY) {
      var fdd = new FormData();
      fdd.append('file', blob, 'audio.webm');
      fdd.append('model_id', 'scribe_v1');
      return fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': g.LUMITEA.ELEVEN_API_KEY },
        body: fdd
      });
    }
    var anon = g.LUMITEA.SUPABASE_ANON_KEY || '', auth = anon;
    try {
      if (g.supabaseClient && g.supabaseClient.auth) {
        var r = await g.supabaseClient.auth.getSession();
        var tok = r && r.data && r.data.session && r.data.session.access_token;
        if (tok) auth = tok;
      }
    } catch (e) {}
    var fd = new FormData();
    fd.append('file', blob, 'audio.webm');
    return fetch(g.LUMITEA.ELEVEN_PROXY_URL + '?op=stt', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + auth, 'apikey': anon },
      body: fd
    });
  };

  // Sintetiza voz a partir de texto. Direto na ElevenLabs se houver chave; senão proxy.
  g.LUMITEA.elevenTTS = async function (texto) {
    if (g.LUMITEA.ELEVEN_API_KEY) {
      return fetch('https://api.elevenlabs.io/v1/text-to-speech/' + g.LUMITEA.ELEVEN_VOICE_ID, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': g.LUMITEA.ELEVEN_API_KEY,
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2' })
      });
    }
    var anon = g.LUMITEA.SUPABASE_ANON_KEY || '', auth = anon;
    try {
      if (g.supabaseClient && g.supabaseClient.auth) {
        var r = await g.supabaseClient.auth.getSession();
        var tok = r && r.data && r.data.session && r.data.session.access_token;
        if (tok) auth = tok;
      }
    } catch (e) {}
    return fetch(g.LUMITEA.ELEVEN_PROXY_URL + '?op=tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth, 'apikey': anon },
      body: JSON.stringify({ text: texto })
    });
  };

  // Aplica preferências de acessibilidade salvas (modo calmo / tema) o mais cedo
  // possível, em TODAS as páginas. A tela de Conta grava esses valores.
  try {
    // aceita as duas chaves usadas no app: conta.html ('lt-modo-calmo') e
    // sobrecarga.js ('lt_modo_calmo').
    var calmo = localStorage.getItem('lt-modo-calmo') || localStorage.getItem('lt_modo_calmo');
    if (calmo === '1') document.documentElement.setAttribute('data-modo-calmo', 'true');
    var tema = localStorage.getItem('lt-tema');
    if (tema && tema !== 'default') document.documentElement.setAttribute('data-tema', tema);
  } catch (e) {}

  g.LUMITEA.criarSupabase = function () {
    if (!g.supabase || !g.supabase.createClient) return null;
    return g.supabase.createClient(g.LUMITEA.SUPABASE_URL, g.LUMITEA.SUPABASE_ANON_KEY);
  };

  // Auto-cria window.supabaseClient global se ainda não foi criado
  if (!g.supabaseClient && g.supabase && g.supabase.createClient) {
    g.supabaseClient = g.supabase.createClient(
      g.LUMITEA.SUPABASE_URL,
      g.LUMITEA.SUPABASE_ANON_KEY
    );
  }

  // "Modo calmo" mora de verdade em preferencias_usuario.reduzAnim (banco,
  // padrão desligado) — o localStorage acima é só um cache pra aplicar sem
  // esperar a rede (evita flash) e pra páginas deslogadas. Aqui a gente
  // confere a conta e corrige o cache se o valor salvo for diferente, pra
  // ligar/desligar valer em qualquer aparelho, não só no navegador onde foi
  // trocado. A troca em si continua em conta.html (aplicarCalmo/salvarPrefs).
  function sincronizarModoCalmo() {
    try {
      // Período de graça: se o modo calmo acabou de ser trocado nesta aba
      // (FAB "Estou sobrecarregado" em sobrecarga.js ou o toggle de
      // conta.html), o upsert que grava isso no banco pode ainda estar a
      // caminho quando a PRÓXIMA página carrega e chama esta função. Sem essa
      // guarda, ela lia o valor antigo do banco e desligava o modo calmo que
      // o usuário tinha acabado de ligar.
      var ts = parseInt(localStorage.getItem('lt-modo-calmo-ts') || '0', 10);
      if (ts && (Date.now() - ts) < 15000) return;
      if (!g.supabaseClient || !g.supabaseClient.auth) return;
      g.supabaseClient.auth.getSession().then(function (r) {
        var uid = r && r.data && r.data.session && r.data.session.user && r.data.session.user.id;
        if (!uid) return;
        return g.supabaseClient.from('preferencias_usuario').select('reduzAnim,anim')
          .eq('id_neurodivergente', uid).maybeSingle().then(function (res) {
            if (!res || res.error || !res.data) return;
            var ligado = !!(res.data.reduzAnim || res.data.anim === false);
            document.documentElement.setAttribute('data-modo-calmo', ligado ? 'true' : 'false');
            try {
              localStorage.setItem('lt-modo-calmo', ligado ? '1' : '0');
              localStorage.setItem('lt_modo_calmo', ligado ? '1' : '0');
            } catch (e) {}
          });
      }).catch(function () {});
    } catch (e) {}
  }
  sincronizarModoCalmo();
})(window);
