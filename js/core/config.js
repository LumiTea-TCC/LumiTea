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

  // ElevenLabs (voz)
  g.LUMITEA.ELEVEN_API_KEY  = SECRETS.ELEVEN_API_KEY || '';
  g.LUMITEA.ELEVEN_VOICE_ID = '87325cfcb7a1c4ae06b8611b8118c0fae8d10569fdf7dcbf5090a44c3ad97055';
  g.LUMITEA.ELEVEN_MODEL    = 'eleven_multilingual_v2';

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
