# CLAUDE.md — LumiTEA

Contexto e regras para o Claude continuar o trabalho neste projeto. Leia antes de editar qualquer coisa.

## O que é
App web de apoio socioemocional para **adolescentes autistas (TEA)** e **pais/cuidadores**.
Duas áreas: **teen (calma)** e **cuidador (sóbria)**. Mascote: urso **Lumi/Theo**.

- Raiz do app: `C:\Users\193912024\lumiTea\LumiTea\` (repo git em `C:\Users\193912024\lumiTea`).
- Roda **sem servidor** (caminhos relativos). Local: `serve.ps1` / `rodar-local.bat` (= localhost).
- Node portátil já no PATH; `npx supabase` v2.x funciona, mas **non-TTY** (deploy precisa de PAT/login do usuário).

## Stack
- **Frontend:** HTML/CSS/JS **vanilla**, sem framework. (Houve um Next.js em `web/` — ABANDONADO, ignore.)
- **Backend:** **Supabase** (Postgres + Auth + RLS + Edge Functions). Projeto ref: `yuwdckenzpfdlyawkibn`.
- **IA:** Groq (texto). **Voz:** ElevenLabs. Ambas via proxy no servidor (ver Segurança).

## ⛔ Restrições inegociáveis (o usuário enfatizou)
1. **Paleta de cores e mascote urso são IMUTÁVEIS.** Toda melhoria acontece ao redor disso, nunca por cima.
2. **Público TEA:** acessibilidade WCAG AA, linguagem clara/acolhedora, baixa carga sensorial.
3. **"Modo calmo soberano"** (`html[data-modo-calmo="true"]`) e **`prefers-reduced-motion`**: TODO movimento
   deve estar desligado nesses estados. "Calma é função": motion só de ESTADO, ≤4–6px, 150–260ms, ease-out.
   Sem parallax/zoom/bounce/confete.
4. **Zero estilo inline** novo (usar classes + tokens). Exceção tolerada: definir variáveis locais
   (ex.: `--feature-color`) e `style.display` dinâmico por JS (padrão já usado no projeto).

## Design system (consultar SEMPRE antes de mexer em UI)
- Docs: `DESIGN.md`, `PRODUCT.md`. Tokens: `css/tokens.css` (v2).
- CSS: `lumitea.css` (global/landing) → `app.css` (telas internas) → `css/tokens.css` → `css/enhance.css` (carrega
  por ÚLTIMO; é a camada de polish/motion, já gated por calmo/reduced-motion).
- Skill do Claude: **`lumitea-design-system`** trava tokens + paleta/mascote. Use-a ao criar/editar UI.
- Ícones: SVG via `js/core/icons.js` — `<i class="lt-i" data-lt-icon="nome">` (estático) ou `LUMI.icon(n)`/
  `LUMI.hydrateIcons(el)` (dinâmico). NUNCA usar emoji como ícone funcional.

## Helpers criados (REUSAR, não reinventar)
- `js/core/reveal.js` — reveal on scroll via classe `.lt-reveal` (IntersectionObserver, gated, com fallback).
  Já usado nas duas homes; pode plugar em qualquer página interna (incluir o script + pôr `.lt-reveal` nos blocos).
- `js/core/ui.js` → **`LumiUI`**: `toast(msg,{type})`, `alert(msg,{...})`→Promise, `confirm(msg,{...})`→Promise<bool>.
  Acessível (foco, Esc, ARIA, gated). **Usar no lugar de `alert()/confirm()` nativos** (abruptos demais p/ TEA).
- Escape de HTML: **`window.LUMITEA.esc()` / `.escBr()`** (em `js/core/config.js`). SEMPRE escapar dado de
  usuário/IA/teen antes de injetar via `innerHTML`.

## 🎮 Jogos do Theo (`games.html` = hub + 4 páginas)
Substituiu o antigo "Mundo Gelado do Theo" (mundo aberto em canvas), **removido do projeto em 2026-08-04**.
- `games.html` (hub) → `jogo-memoria.html`, `jogo-classificar.html`, `jogo-encaixe.html`, `jogo-imagem-palavra.html`.
- Estilo comum: `css/jogos.css` (prefixo `.jg-`). Motor comum: **`js/jogos/base.js`** (`window.LUMIJOGOS`):
  `boot()`, `pronto()`, `prefs(jogoId)`, `montarAjustes()`, `arrastar()`, `salvarSessao()`, `som`, `embaralhar()`.
- **`js/jogos/sprites.js`**: 40 figuras SVG desenhadas em código (5 temas × 8) + 7 formas geométricas, com o
  nome em pt-BR de cada uma. **Não há assets de imagem novos** — nada a baixar, nada que quebre offline.
- **`arrastar()` aceita 4 caminhos**: mouse, dedo, toque-em-duas-etapas e teclado. Tolerância de encaixe
  ampliada de propósito (28–40px). Nunca reduzir: motricidade fina varia muito no público.
- **Som DESLIGADO por padrão** (`localStorage['lt-jogos-som']`), tom suave via WebAudio + narração via
  `speechSynthesis` (pt-BR, offline, sem custo — não usa o proxy ElevenLabs). O **modo calmo silencia tudo**.
- Regras que NÃO podem ser revertidas: sem cronômetro visível, sem pontuação negativa, **erro é silencioso**
  (sem som, sem vermelho, sem mensagem — a peça só volta), reiniciar sempre à mão, dificuldade só sobe se o
  usuário pedir. Partidas vão para `sessoes_jogo` com `jogo_id` = `memoria`/`classificar`/`encaixe`/`imagem-palavra`.
- `roleplay.html` e `rpg-social.html` continuam como redirects para `games.html`.

## 🔐 Segurança (estado atual e regras)
- **Chaves de IA/voz são gated por origem** (`js/core/config.js` + `js/core/secrets.js`): só carregam em DEV
  (localhost / `file://` / IP privado). Em domínio público ficam vazias → IA/voz passam pelos **proxies**.
  Provado por simulação: prod = chave vazia e `window.LUMITEA_SECRETS` indefinido.
- **`secrets.js` é gitignored** e só deve existir na máquina local. NUNCA versionar/publicar. NUNCA pôr
  `service_role` no cliente. Nunca colar chave no editor web do GitHub (foi assim que o secret scanning
  disparou em 2026-08-03).
- **Hook `pre-commit`** (`tools/git-hooks/pre-commit`) barra commit com padrão de chave (`gsk_`, `sk_`, `sk-`,
  JWT `eyJhbGciOi…`) ou com arquivo `secrets.js`/`.env`. Hooks não são versionados: cada pessoa roda
  `powershell -ExecutionPolicy Bypass -File tools/instalar-hooks.ps1` uma vez por clone.
- **Histórico do git purgado em 2026-08-03**: `js/core/secrets.js` (com a Groq `gsk_KRomykdn…` e a ElevenLabs
  `sk_ce3e755a…`) foi removido de todos os commits via `git filter-branch --index-filter`. Os SHAs mudaram —
  quem tiver clone antigo precisa re-clonar, nunca dar merge do clone velho.
- **Edge Functions** (`supabase/functions/groq-proxy`, `eleven-proxy`) existem mas **NÃO estão deployadas**
  (retornam 404). Deploy pelo PAINEL web ou via PAT. Secrets do servidor: `GROQ_API_KEY`, `ELEVENLABS_API_KEY`
  (+ `ELEVEN_VOICE_ID`/`ALLOW_ORIGIN` opcionais). `SUPABASE_URL`/`SUPABASE_ANON_KEY` são auto-injetadas.
- **PENDENTE do usuário:** (1) **revogar** na Groq a chave `gsk_KRomykdn…` e na ElevenLabs a `sk_ce3e755a…` —
  ficaram públicas no GitHub; purgar o histórico NÃO as torna seguras, só a revogação torna; (2) deployar os
  2 proxies; (3) commitar o `.gitignore` (o repo público estava sem ele).
- **RLS:** sólida (sem `using(true)`, políticas self-scoped `= auth.uid()`). Dados de saúde mental de menores =
  risco LGPD alto: qualquer mudança em SQL/RLS/Auth deve passar pela skill `supabase-security`.
- Risco conhecido NÃO corrigido: `email_por_telefone`/`telefone_existe` são `GRANT ... TO anon` (login por
  telefone) → enumeração de PII. Mitigar exige repensar o fluxo de login; não mexer sem combinar.

## Já corrigido (não refazer)
- Bug crítico `NIVEL_EMOJIS` na `home-autista.html` (quebrava XP + vínculo) → `NIVEL_ICONES` + try/catch.
- XSS no painel do cuidador (`home-cuidador.html`) → `LUMITEA.esc()` em todo innerHTML de dado do teen.
- Polish de acessibilidade da home teen (progressbar ARIA, burger aria-expanded, avatar, modal acolhedor no humor
  difícil em vez de `confirm()`), cores inline dos feature-link → token.
- Animações sutis e gated nas duas homes (reveal + hover + float só no mascote livre da teen).
- 4 `alert()` do cuidador → `LumiUI.toast`.

## 📋 Backlog (próximos passos, sem quebrar nada)
1. Migrar os ~27 `alert/confirm` nativos restantes (conta, diário, calendário, conversa) para `LumiUI`.
   Atenção: `confirm()` síncrono → `LumiUI.confirm()` é Promise; ajustar para `await`/`.then`.
2. Conferir/padronizar escape em `chat.js`, `apoio.js` (provável OK).
3. Avaliar mitigação da enumeração de PII (item de Segurança) — só com aval do usuário.

## Subagents/skills úteis
`frontend-reviewer`, `accessibility-auditor`, `supabase-security-reviewer` (só rodar se o usuário pedir).
MCP `playwright` disponível, mas as páginas internas exigem sessão Supabase real (redirecionam p/ login sem auth) —
verificação aqui é majoritariamente estática + simulação (`node --check`, parse de scripts inline, vm).

## Convenções de trabalho
- Validar JS com `node --check`; conferir balanceamento de chaves do CSS; re-parsear `<script>` inline com `vm`.
- Português brasileiro em UI e mensagens.
- Confirmar antes de ações destrutivas/irreversíveis ou que afetem produção (deploy, rotação, login, SQL).
