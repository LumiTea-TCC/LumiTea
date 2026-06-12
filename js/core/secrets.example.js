/* ============================================================
   LumiTEA — secrets.example.js  (MODELO — pode versionar)
   Copie este arquivo para "secrets.js" (na mesma pasta) e
   preencha com as chaves reais. O secrets.js fica no .gitignore
   e NÃO deve ser enviado ao GitHub.
   ============================================================ */
(function (g) {
  g.LUMITEA_SECRETS = {
    // ⚠️ A chave da Groq NÃO fica mais aqui (lado do cliente).
    // Ela vive como secret no servidor (Supabase Edge Function "groq-proxy").
    // Veja supabase/README-PROXY.md. Depois de publicar o proxy, REMOVA
    // qualquer GROQ_API_KEY do seu secrets.js local e ROTACIONE a chave antiga.

    // ElevenLabs (voz) — ainda client-side por enquanto (será movido depois).
    ELEVEN_API_KEY: ''
  };
})(window);
