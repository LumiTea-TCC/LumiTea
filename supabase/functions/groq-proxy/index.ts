// ============================================================
// LumiTEA — Supabase Edge Function: groq-proxy
// ------------------------------------------------------------
// Esconde a GROQ_API_KEY NO SERVIDOR. O navegador NUNCA fala com
// a Groq direto: ele chama esta função (autenticado com a sessão
// Supabase do usuário) e ela repassa o pedido com a chave secreta.
//
// Deploy:  supabase functions deploy groq-proxy
// Secret:  supabase secrets set GROQ_API_KEY=xxxxxxxx
// Local:   supabase functions serve groq-proxy
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELOS_OK = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
]);

// Defina ALLOW_ORIGIN no deploy para travar a origem (ex.: https://seu-site).
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // ── 1) Autenticação: exige sessão Supabase válida (usuário logado) ──
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) return json({ error: "Sessão inválida" }, 401);

  // ── 2) Chave secreta do servidor ──
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) return json({ error: "IA não configurada no servidor" }, 503);

  // ── 3) Validação de entrada (anti-abuso e controle de custo) ──
  let payload: any;
  try { payload = await req.json(); }
  catch { return json({ error: "JSON inválido" }, 400); }

  const messages = Array.isArray(payload?.messages) ? payload.messages : null;
  if (!messages || messages.length === 0 || messages.length > 30) {
    return json({ error: "campo 'messages' inválido" }, 400);
  }
  for (const m of messages) {
    if (
      !m || typeof m.content !== "string" || m.content.length > 8000 ||
      !["system", "user", "assistant"].includes(m.role)
    ) {
      return json({ error: "mensagem malformada" }, 400);
    }
  }

  const model = MODELOS_OK.has(payload?.model)
    ? payload.model
    : "openai/gpt-oss-120b";
  const max_tokens = Math.min(Math.max(parseInt(payload?.max_tokens) || 700, 1), 1000);
  let temperature = typeof payload?.temperature === "number" ? payload.temperature : 0.78;
  temperature = Math.min(Math.max(temperature, 0), 1.3);
  // Repassado só se vier exatamente nesse formato — usado pelo roleplay pra
  // forçar a Groq devolver JSON completo e válido (evita resposta cortada
  // no meio virando texto quebrado exibido como fala do personagem).
  const response_format = (payload?.response_format?.type === "json_object")
    ? { type: "json_object" as const }
    : undefined;

  // ── 4) Repasse pra Groq (com a chave secreta) ──
  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature, response_format }),
    });
  } catch (_e) {
    return json({ error: "Falha ao contatar a IA" }, 502);
  }

  const data = await groqRes.json().catch(() => null);
  if (!groqRes.ok) {
    return json({ error: "Erro na IA", status: groqRes.status }, 502);
  }
  return json(data, 200);
});
