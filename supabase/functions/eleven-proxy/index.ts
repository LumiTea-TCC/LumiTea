// ============================================================
// LumiTEA — Supabase Edge Function: eleven-proxy
// ------------------------------------------------------------
// Esconde a ELEVENLABS_API_KEY NO SERVIDOR. O navegador nunca
// fala com a ElevenLabs direto: ele chama esta função (autenticado
// com a sessão Supabase do usuário) para:
//   - op=stt : transcrever áudio (speech-to-text)
//   - op=tts : sintetizar voz a partir de texto (text-to-speech)
//
// Deploy:  supabase functions deploy eleven-proxy
// Secrets: supabase secrets set ELEVENLABS_API_KEY=xxxx
//          supabase secrets set ELEVEN_VOICE_ID=<id da voz>   (opcional)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const TTS_BASE = "https://api.elevenlabs.io/v1/text-to-speech/";
// Voz padrão "Rachel" (pública da ElevenLabs) caso nenhuma seja configurada.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const TTS_MODEL = "eleven_multilingual_v2";

const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // ── 1) Autenticação: exige sessão Supabase válida ──
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) return json({ error: "Sessão inválida" }, 401);

  // ── 2) Chave secreta ──
  const KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!KEY) return json({ error: "Voz não configurada no servidor" }, 503);

  const op = new URL(req.url).searchParams.get("op") ?? "tts";

  // ── 3a) Speech-to-text ──
  if (op === "stt") {
    let inForm: FormData;
    try { inForm = await req.formData(); }
    catch { return json({ error: "Esperado multipart/form-data com 'file'" }, 400); }
    const file = inForm.get("file");
    if (!(file instanceof File)) return json({ error: "campo 'file' ausente" }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: "áudio grande demais" }, 413);

    const fd = new FormData();
    fd.append("file", file, "audio.webm");
    fd.append("model_id", "scribe_v1");
    fd.append("language_code", "por");
    let res: Response;
    try {
      res = await fetch(STT_URL, { method: "POST", headers: { "xi-api-key": KEY }, body: fd });
    } catch { return json({ error: "Falha ao contatar a voz" }, 502); }
    const data = await res.json().catch(() => null);
    if (!res.ok) return json({ error: "Erro na transcrição", status: res.status }, 502);
    return json({ text: (data?.text ?? "").trim() }, 200);
  }

  // ── 3b) Text-to-speech ──
  if (op === "tts") {
    let payload: any;
    try { payload = await req.json(); }
    catch { return json({ error: "JSON inválido" }, 400); }
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return json({ error: "campo 'text' obrigatório" }, 400);
    if (text.length > 1500) return json({ error: "texto longo demais" }, 413);

    const voice = Deno.env.get("ELEVEN_VOICE_ID") || DEFAULT_VOICE;
    let res: Response;
    try {
      res = await fetch(TTS_BASE + voice, {
        method: "POST",
        headers: { "xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL,
          voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
        }),
      });
    } catch { return json({ error: "Falha ao contatar a voz" }, 502); }
    if (!res.ok) return json({ error: "Erro na síntese de voz", status: res.status }, 502);
    return new Response(res.body, {
      status: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg" },
    });
  }

  return json({ error: "op inválido (use stt ou tts)" }, 400);
});
