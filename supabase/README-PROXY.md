# Proxy da IA (Groq) — esconder a chave de verdade

Antes, o navegador chamava a Groq direto com `Authorization: Bearer <chave>`.
Qualquer visitante via a chave no DevTools. Agora a chave fica **só no
servidor** (Supabase Edge Function) e o navegador chama a função, autenticado
com a sessão do usuário.

## Fluxo
```
navegador (sessão Supabase)  ──►  groq-proxy (Edge Function)  ──►  Groq API
                                   ▲ guarda a GROQ_API_KEY
```

## Como publicar (uma vez)

1. Instale a CLI do Supabase: https://supabase.com/docs/guides/cli
2. Faça login e linke o projeto:
   ```
   supabase login
   supabase link --project-ref yuwdckenzpfdlyawkibn
   ```
3. Guarde a chave como **secret do servidor** (NÃO vai pro código/Git):
   ```
   supabase secrets set GROQ_API_KEY=COLE_SUA_CHAVE_GROQ_AQUI
   ```
   (Opcional, trave a origem em produção:)
   ```
   supabase secrets set ALLOW_ORIGIN=https://SEU-DOMINIO
   ```
4. Publique a função:
   ```
   supabase functions deploy groq-proxy
   ```

## Rodar localmente (dev)
```
supabase functions serve groq-proxy
```
A função fica em `http://localhost:54321/functions/v1/groq-proxy`.
O `js/core/config.js` aponta para `${SUPABASE_URL}/functions/v1/groq-proxy`
automaticamente — em produção já funciona; para teste local, troque
`SUPABASE_URL` por `http://localhost:54321` enquanto desenvolve.

## Segurança aplicada na função
- Exige **sessão Supabase válida** (usuário logado) — `auth.getUser(token)`.
- **Allowlist de modelos** e **teto de tokens** (controle de custo/abuso).
- Limite de tamanho/quantidade de mensagens.
- CORS configurável por `ALLOW_ORIGIN`.

## IMPORTANTE — rotacione a chave
A chave antiga já circulou no `secrets.js` (lado do cliente). **Gere uma chave
nova** no painel da Groq e use só ela no `supabase secrets set`. A antiga deve
ser revogada.

---

# Proxy da Voz (ElevenLabs) — `eleven-proxy`

A tela de voz (`audio.html`) **não fala mais com a ElevenLabs direto**. Ela chama
a Edge Function `eleven-proxy`, autenticada com a sessão do usuário. A função faz
duas coisas, escolhidas por `?op=`:

- `POST .../eleven-proxy?op=stt` — recebe um áudio (`multipart/form-data`, campo
  `file`) e devolve `{ "text": "..." }` (speech-to-text).
- `POST .../eleven-proxy?op=tts` — recebe `{ "text": "..." }` e devolve `audio/mpeg`.

O cliente usa os helpers `LUMITEA.elevenSTT(blob)` e `LUMITEA.elevenTTS(texto)`
(em `js/core/config.js`). Se o proxy falhar, há fallback para
`SpeechRecognition`/`speechSynthesis` do navegador.

## Publicar
```
supabase secrets set ELEVENLABS_API_KEY=COLE_A_CHAVE_NOVA_AQUI
supabase secrets set ELEVEN_VOICE_ID=<id-de-voz-valido>   # opcional; padrão = Rachel
supabase functions deploy eleven-proxy
```
> Use um **voice id válido** da ElevenLabs (ex.: `21m00Tcm4TlvDq8ikWAM`). O valor
> antigo no projeto (`87325...`, 64 hex) **não era um id válido** e fazia o TTS cair
> sempre no fallback.

---

# ⚠️ ROTACIONE TODAS as chaves expostas
As seguintes chaves já circularam (em `secrets.js`, em `conta.html` e/ou fora do
repositório) e devem ser consideradas **comprometidas** — gere novas e revogue as
antigas nos respectivos painéis:

1. **Supabase `service_role`** — a mais crítica (ignora RLS, acesso total ao banco).
2. **Groq** `GROQ_API_KEY`.
3. **ElevenLabs** `ELEVENLABS_API_KEY`.

Nenhuma dessas deve voltar para o lado do cliente: todas vivem como
`supabase secrets set ...` no servidor.
