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
