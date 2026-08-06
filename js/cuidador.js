/* ================================================================
   LumiTEA — cuidador.js  v2.0 (Supabase Edition)
   ─────────────────────────────────────────────────────────────────
   home-cuidador.html contém toda a lógica principal embutida.
   Este arquivo fornece apenas helpers complementares.
   ================================================================ */

/* UM cliente Supabase por página. Criar um segundo faz dois GoTrueClient
   dividirem a mesma chave de sessão e o mesmo navigator.lock — o console avisa
   ("Multiple GoTrueClient instances detected") e getSession()/signOut() podem
   travar. Aqui só reaproveitamos o cliente que a página ou o config.js já criou. */
(function ensureClient() {
  // sb pode ser um const da página ainda em TDZ (se o script inline falhou):
  // nesse caso o próprio typeof lança, por isso o try.
  try { if (typeof sb !== 'undefined' && sb) return; } catch (e) {}
  if (window.sb) return;
  if (window.supabaseClient) { window.sb = window.supabaseClient; return; }
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      window.sb = supabase.createClient(
        'https://yuwdckenzpfdlyawkibn.supabase.co',
        'sb_publishable_JtP1wsTu2QQ1xFjlrDBu9g_ZKYkW59N'
      );
      window.supabaseClient = window.sb;
    } catch(e) {}
  }
})();

async function salvarRelatorioSupabase(teenId, relatorio) {
  if (!teenId || !relatorio) return { erro: 'Dados inválidos.' };
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (!client) return { erro: 'Cliente Supabase não inicializado.' };
  try {
    var payload = Object.assign({}, relatorio, {
      id_neurodivergente: teenId,
      timestamp: relatorio.timestamp || new Date().toISOString()
    });
    var { error } = await client.from('relatorios').insert(payload);
    if (error) return { erro: error.message };
    return { ok: true };
  } catch(e) { return { erro: e.message || 'Erro ao salvar.' }; }
}

async function buscarConversasSupabase(teenId, limite) {
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (!client || !teenId) return [];
  try {
    var { data } = await client.from('conversas').select('role, content, timestamp')
      .eq('id_neurodivergente', teenId).order('timestamp', { ascending: false }).limit(limite || 20);
    return (data || []).reverse();
  } catch(e) { return []; }
}

async function buscarRelatoriosSupabase(teenId, limite) {
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (!client || !teenId) return [];
  try {
    var { data } = await client.from('relatorios').select('*')
      .eq('id_neurodivergente', teenId).order('timestamp', { ascending: false }).limit(limite || 10);
    return data || [];
  } catch(e) { return []; }
}

async function buscarAlertasSupabase(teenId, limite) {
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (!client || !teenId) return [];
  try {
    var { data } = await client.from('alertas').select('*')
      .eq('id_neurodivergente', teenId).order('timestamp', { ascending: false }).limit(limite || 20);
    return data || [];
  } catch(e) { return []; }
}

async function salvarAlertaSupabase(teenId, tipo, titulo, desc, emoji) {
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (!client || !teenId) return;
  try {
    await client.from('alertas').insert({
      id_neurodivergente: teenId, tipo: tipo || 'info',
      titulo: titulo || 'Alerta', desc: desc || '',
      emoji: emoji || '📌', lido: false,
      timestamp: new Date().toISOString()
    });
  } catch(e) { console.warn('[LumiTEA] salvarAlerta:', e.message); }
}

async function sairDaConta() {
  var client = (typeof sb !== 'undefined') ? sb : null;
  if (client) { try { await client.auth.signOut(); } catch(e) {} }
  window.location.href = 'login.html';
}
