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

  g.LUMITEA.GROQ_API_KEY = SECRETS.GROQ_API_KEY || '';
  g.LUMITEA.GROQ_MODEL   = 'llama-3.3-70b-versatile';

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
