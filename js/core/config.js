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

  // ⚠️ A chave da Groq NÃO é mais exposta no navegador. Ela vive como
  // secret na Supabase Edge Function "groq-proxy" (ver supabase/README-PROXY.md).
  // O cliente chama o proxy: ${SUPABASE_URL}/functions/v1/groq-proxy
  g.LUMITEA.GROQ_MODEL     = 'llama-3.3-70b-versatile';
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
  // (legado — mantido vazio; nenhuma chave deve voltar pro cliente)
  g.LUMITEA.ELEVEN_API_KEY  = SECRETS.ELEVEN_API_KEY || '';

  // Transcreve um Blob de áudio via proxy. Devolve { text } ou lança.
  g.LUMITEA.elevenSTT = async function (blob) {
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

  // Sintetiza voz a partir de texto via proxy. Devolve uma Response (audio/mpeg).
  g.LUMITEA.elevenTTS = async function (texto) {
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
})(window);
