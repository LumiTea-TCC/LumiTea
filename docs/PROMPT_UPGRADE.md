# 🐻 LumiTEA — Prompt Mestre de Upgrade (v2.0)

> Cole este arquivo como PRIMEIRA mensagem em qualquer sessão do Claude Code quando for trabalhar nas evoluções abaixo. Ele é o briefing completo e tem precedência sobre qualquer outro prompt curto. **Releia `LUMITEA_CHARTER.md` antes de tocar em arquivo.**

---

## 0. Quem você é nesta sessão

Você é uma equipe formada pelos maiores especialistas do mundo em:
inteligência artificial conversacional · UX/UI · neurodivergência e TEA · psicologia clínica · acessibilidade WCAG 2.2 AAA · desenvolvimento full-stack · design emocional · arquitetura de software · gamificação saudável · interfaces de voz · experiências sensoriais · startups de impacto social.

Sua missão é elevar a LumiTEA ao patamar de **plataforma referência mundial em suporte emocional para adolescentes autistas**: companheira emocional viva, segura e inteligente. Não é "mais um site funcional".

**Inspiração de tom visual:** premium, calmo, minimalista, glassmorphism leve, glow suave, profundidade, microanimações respiratórias — referência estética de Apple, Spotify, Linear, Notion, Headspace — mas com identidade própria centrada em neurodivergência.

**Inviolável:**
- Mantém o mascote urso Theo (todas as imagens em `web/public/img/`).
- Mantém a paleta atual (azul `#4a7eb5`/`#2e5fa3` + creme/branco + acentos `#7c5cbf`, `#e08e30`, `#3aa39f`). Só refina/eleva.
- Mantém Baloo 2 (títulos) + Nunito (texto). Pode adicionar Inter para microcopy de UI.
- Tudo no Charter (voz da Theo, sem streak, firewall cuidador-adolescente, opt-in pra crise, filtro das 5 perguntas).

---

## 1. Stack alvo

- **Front:** Next.js 15 (App Router) + TypeScript + Tailwind (já tem) + **Framer Motion** (já tem) + `@react-pdf/renderer` (adicionar) para relatórios.
- **Back:** Supabase (Postgres + Auth + RLS + Realtime).
- **IA texto:** Groq via `/api/lumi`. NUNCA expor key ao client.
- **IA voz:** STT via Web Speech API nativa (fallback) + opção de Whisper via OpenAI server-side. TTS via Web Speech API nativa (fallback) + opção ElevenLabs server-side com voz BR pt-BR feminina/calma/jovem. Chaves só em `process.env.*`, nunca no client.
- **Realtime:** Supabase Realtime para chip de check-in e relatórios.
- **HTMLs legados na raiz:** ignorar. Tudo novo entra em `web/`.

---

## 2. As 14 metas (siga tintim por tintim)

### Passo 1 — Identidade visual premium (design system)
- Criar `web/styles/tokens.css` (e estender `tailwind.config.ts`) com:
  - Cores (semânticas): `surface`, `surface-elevated`, `surface-glass`, `ink`, `ink-soft`, `ink-muted`, `accent`, `accent-soft`, `success`, `attention`, `danger`. Variantes `dark`.
  - Glass: `--glass-bg: rgba(255,255,255,0.55)`, `--glass-border: rgba(255,255,255,0.35)`, `--glass-blur: 18px`. Dark: `rgba(20,30,48,.6)`.
  - Sombras: 3 níveis (`shadow-1/2/3`) + 1 `shadow-glow` suave.
  - Raios: 12/16/20/24.
  - Espaçamentos: 4/8/12/16/24/32/48/64.
  - Easings: `--ease-soft: cubic-bezier(.22,.61,.36,1)`.
- Refazer cartões/inputs/botões com **vidro suave**: `backdrop-filter: blur(var(--glass-blur))` + borda 1px em `--glass-border` + sombra nível 1.
- Aumentar respiro: padding mínimo 24px nos cards, gap 18-24 entre seções, leading 1.55-1.65 em texto.
- Hierarquia tipográfica: H1 1.85rem / H2 1.35rem / corpo 0.95rem; line-height nunca abaixo de 1.5.
- Animações: transições 180-220ms, `ease-soft`. Tudo dentro de `@media(prefers-reduced-motion: reduce)` = none.

### Passo 2 — Theo vivo (mascote emocional)
- Criar `web/components/TheoMascote.tsx` que recebe `humor` ("calmo"|"feliz"|"acolhedor"|"explicador"|"crise"|"celebracao") + `falando` (boolean).
- Estado base: respiração suave (`scale 1.0 → 1.03 → 1.0`, 4s, infinito). Pisca leve a cada 5-9s aleatório.
- Trocas suaves entre PNGs do urso (`urso-estrelhinha`, `urso-joia`, `urso-aponta-lado`, `urso-skate`, `urso-nogelo-feliz`) com fade 220ms. Nunca girar/inverter — só fade.
- Glow ao redor reativo ao humor: azul calmo (default), verde joia (feliz), violeta suave (acolhedor), âmbar (explicador). Em "crise": glow some, urso fica em `urso-estrelhinha`, sem animação.
- Quando `falando=true`, anel pulsa sutilmente em volta.
- `prefers-reduced-motion`: tudo congela em pose neutra com glow estático.

### Passo 3 — Conversa por voz cinematográfica
- Componente `web/components/VozOrb.tsx`: orbe central com glow dinâmico (paleta da LumiTEA, **não usar verde neon do exemplo** — adaptar para azul-violeta-âmbar suaves). Estados:
  - `ocioso`: respiração lenta (4s).
  - `ouvindo`: pulsação rápida + anel de partículas suaves girando.
  - `pensando`: orbe contrai + shimmer.
  - `falando`: ondas sonoras sincronizadas com amplitude do TTS.
- Página `/conversa/voz`: tela full-screen escura suave (`#0f1626` glass dark), orbe no centro, botão grande mic embaixo, transcrição ao vivo em tipografia generosa acima do orbe. Botão "Voltar ao texto" no canto.
- API rotas:
  - `/api/voz/stt` (POST audio blob → texto). Default Web Speech API client-side; fallback servidor com Whisper se `OPENAI_API_KEY` setada.
  - `/api/voz/tts` (POST `{texto}` → audio stream). Default Web Speech `speechSynthesis` client; fallback ElevenLabs (`ELEVEN_API_KEY` + voz pt-BR calma) com cache em Supabase Storage por hash de texto.
- Configurável em `/conta`: velocidade (0.8–1.1), voz (sintética nativa / ElevenLabs), legenda em tempo real (default on).
- **NUNCA gravar áudio do adolescente no servidor sem opt-in explícito.** Padrão: STT client-side, áudio nunca sai do device.

### Passo 4 — IA Theo evoluída (memória + personalidade)
- `web/lib/lumi/memory.ts`: já existe. Estender para:
  - Categorizar fatos: `medos[]`, `eventos[]`, `dificuldades_sociais[]`, `padroes_emocionais[]`, `preferencias_sensoriais[]`, `pessoas[]`, `gostos[]`.
  - Função `extrairFatos(mensagem, contextoRecente)` que chama Groq com prompt extrator JSON estrito.
  - Limitar a 30 fatos por categoria; rotação por recência + relevância (LRU + score de uso).
- `system-prompt.ts`: injetar **sumário compacto** dos fatos (não literal — frases curtas como "tem dificuldade com barulho da cantina; gosta de desenhar; viaja com a tia Cláudia no sábado").
- Adaptação de tom: já existe modos. Adicionar **detector de estado** server-side em `/api/lumi` que olha últimas 3 mensagens e ajusta comprimento/quantidade de perguntas automaticamente.
- Theo nunca: diagnostica, recomenda medicação, faz ironia, faz 2 perguntas em sequência, usa metáforas vagas.

### Passo 5 — Perfil sensorial inteligente
- Tabela `perfil_sensorial` (adicionar via migration):
  - `sens_visual` (1-5), `sens_sonora` (1-5), `velocidade_cognitiva` (1-5), `nivel_estimulo_ideal` (1-5), `dificuldade_social` (1-5), `padrao_emocional` (texto), `preferencia_comunicacao` ('texto'|'voz'|'misto'), atualizado_em.
- Questionário curto opcional em `/conta/perfil-sensorial` (8 perguntas, 1 frase cada, slider 1-5, sem ranking visível). Pode pular.
- Detecção automática: hook `useSensorialAuto` que observa:
  - quanto tempo o adolescente leva pra responder no chat (velocidade cognitiva),
  - quantas vezes clicou "Estou sobrecarregado" no mês (sensibilidade),
  - se ativou "modo silencioso" do Theo (preferência),
  - se está em horários de pico de humor difícil.
- A cada sessão, ajusta automaticamente: cores (luminância reduzida se sens_visual alta), animações (off se nivel_estimulo_ideal baixo), quantidade de texto (resposta curta default), tamanho de fonte, espaçamento.
- Tudo sempre revertível em `/conta`. Sem "diagnosticar" — vocabulário neutro tipo "preferência de visual mais calmo".

### Passo 6 — Modo Anti-Sobrecarga
- FAB global `<BotaoSobrecarga>` em **toda página interna** (canto inferior direito, 56×56, glass + glow âmbar, label sempre visível "Estou sobrecarregado").
- Click → confirmação curta ("ativar modo calmo agora?") com botões `Sim`/`Não, cancelar`. Sem perguntar duas vezes.
- Quando ativo (`<html data-modo-calmo="true">`):
  - Brilho reduzido (filtro `brightness(.92)`).
  - Animações off (`* { animation: none !important; transition: none !important; }`).
  - Sons off.
  - Fonte +1 nível.
  - Espaçamento +20%.
  - Theo passa pra modo "minimalista" (frase única).
  - Modal de respiração 4-7-8 oferecido (não imposto).
  - Esconde notificações/chips por 30min.
- Banner persistente discreto "Modo calmo ativo · sair" no topo enquanto durar.

### Passo 7 — Calendário emocionalmente inteligente
**Já em construção (Fase 1).** Especificação completa:
- `/calendario` com mini-calendário + agenda do dia (look do `calendario.html` legado, mas em Next).
- Form de evento com: título, data/hora, categoria (`escola`|`familia`|`social`|`saude`|`lazer`|`outro`), descrição livre, **contexto pra roleplay** (campo de texto livre — vira persona da IA), personagens (lista `{nome, relacao, nota}`), lembrete pré (15/30/60/120min), check-in pré (toggle), check-in pós (toggle).
- Componente `<EventoCheckin>` (FAB chip canto inferior esquerdo): aparece em **qualquer página interna** quando `agora ∈ [evento − lembrete_pre, evento]` e `checkin_pre=true`.
  - Texto: "Tem [evento] em X min. Como você está?"
  - Botões: `Tô bem 👍` | `Quero conversar 💬` | `Praticar com o Theo 🎭`
  - X pra dispensar (registra `dispensou`).
  - Reaparece pós-evento se `checkin_pos=true` (uma única vez).
- Hook `useProximosEventos` (Supabase Realtime + polling 60s fallback).
- "Praticar" leva a `/roleplay/livre?evento=<id>`.
- Grava em `lembretes_evento` cada disparo + resposta.

### Passo 8 — Roleplay adaptativo total
- Já existe `/roleplay/[cenario]` com cenários fixos.
- Adicionar `/roleplay/livre` que aceita:
  - `?evento=<id>` → puxa do evento `contexto_roleplay` + `personagens` + `titulo`.
  - `?descricao=<texto>` → adolescente descreve em uma frase a situação que quer treinar.
- System prompt construído em runtime: "Você é Theo. Vai interpretar `<personagem>` no contexto: `<contexto>`. Falar curto, dar pausas pra resposta. Sair do papel se o adolescente pedir 'sai do papel'."
- Botões durante roleplay: "trocar personagem", "sair do papel (pedir dica do Theo)", "encerrar e refletir".
- Ao encerrar, Theo dá feedback gentil em 3-4 bullets (o que foi natural, o que pode treinar mais, frase de apoio). Salva em `sessoes_roleplay`.

### Passo 9 — Games terapêuticos
**Fase 1 já criou** `respira`, `cara-emocao`, `padrao-calmo`. Adicionar nas fases seguintes:
- `tom-de-voz`: ouvir clipe de 5-7s (TTS gerando frase ambígua tipo "que legal isso") em 3 entonações diferentes → escolher a emoção. Não pune.
- `escolha-social`: micro-história de 3 frases → 3 opções de resposta → Theo explica cada uma sem rotular como "certa/errada".
- `rotina-em-blocos`: arrastar blocos visuais pra montar a rotina do dia. Salva como rotina favorita e pode virar lembrete.
- `historia-interativa`: pequenas histórias bifurcadas calmantes (estilo livro-jogo). Cada escolha leva a uma cena ilustrada com Theo.
- `conforto`: tela sensorial — sons da natureza (escolher), partículas suaves, padrão a tocar. Não é "jogo competitivo".
- Regra: nenhum jogo tem score competitivo, nenhum tem timer regressivo visível, todos têm botão Pausar/Sair sem confirmação, todos salvam `sessoes_jogo`. Dificuldade adaptativa: olha últimas 5 sessões; se acerto < 50%, próxima sessão = nível mais fácil; se ≥ 85%, oferece (não força) nível seguinte.

### Passo 10 — Cuidador 2.0 (dashboard premium)
- `/cuidador` (após login de tipo `responsavel`):
  - Top bar: seletor de adolescente vinculado · botão "Gerar relatório agora".
  - Cards (glass): humor médio 7d/30d (mini-gráfico Chart.js ou Recharts), eventos próximos, sessões de jogo, alertas abertos.
  - Sessão "Padrões observados pela IA" (parágrafos curtos, escritos pela Theo Cuidador).
  - Sessão "Dicas para esta semana" (4-6 cartões de dica prática).
  - Tudo em layout 2 colunas (sidebar nav · main).
- `/cuidador/relatorios`: lista. Cada item: período, status, "Visualizar", "Baixar PDF".
- `/cuidador/calendario`: vê calendário do adolescente; cuidador pode adicionar evento (origem=`responsavel`) que o adolescente recebe com chip.
- `/cuidador/vinculos`: código de vínculo de 6 dígitos, status, "Reenviar". (QR opcional.)
- `/cuidador/observacoes`: notas privadas do cuidador (`observacoes_cuidador`).
- API:
  - `POST /api/cuidador/relatorio` → agrega `conversas`/`humores`/`diario_entradas`/`eventos_calendario`/`sessoes_jogo` no período; chama Groq com prompt "Theo Cuidador" pra sintetizar; salva em `relatorios_cuidador`.
  - `GET /api/cuidador/relatorio/[id]/pdf` → `@react-pdf/renderer` com header LumiTEA + foto Theo + seções + rodapé "Em caso de crise, ligue 188 (CVV)".
- **Firewall:** nada literal das conversas. Só padrões e síntese. Se o adolescente desliga `compartilhar_relatorio` em `/conta`, cuidador vê tela "o adolescente desativou o compartilhamento — converse com ele".

### Passo 11 — IA Explicadora Social
- Em `/conversa` adicionar quick action "Me explica o que aconteceu".
- Abre input expandido onde o adolescente descreve em 1-3 frases a situação social.
- Theo retorna estrutura previsível em 4 partes:
  1. **O que provavelmente aconteceu** (sem julgar).
  2. **O que a outra pessoa pode ter sentido**.
  3. **O que você sentiu** (devolve em palavras).
  4. **Algumas formas de responder** (3 opções, sem rotular "certa").
- Salva em `conversas` com metadata `tipo=explicador_social` pra entrar no relatório.

### Passo 12 — Arquitetura Next.js completa
A migração já está em curso (`web/`). Garantir:
- App Router com Server Components por padrão.
- TypeScript estrito (`noUncheckedIndexedAccess` ligado).
- Tailwind como utility-first; tokens centralizados; design system em `web/components/ui/` (Button, Card, Field, Modal, Toast, Sheet).
- Acessibilidade centralizada via componente `<A11yProvider>` que aplica `data-fonte`, `data-tema`, `data-modo-calmo`, `data-reduz-anim`.
- Estrutura final esperada:
  ```
  web/
    app/
      (publico)/(landing,login,cadastro,privacidade,termos,acessibilidade)
      (teen)/(home,conversa,conversa/voz,roleplay,roleplay/livre,games,games/[id],calendario,diario,conta)
      (cuidador)/cuidador/(page,relatorios,calendario,vinculos,observacoes)
      api/(lumi,voz/stt,voz/tts,games/sessao,cuidador/relatorio,cuidador/relatorio/[id]/pdf,calendario/lembrete)
    components/(ui/, TheoMascote, VozOrb, BotaoSobrecarga, EventoCheckin, ...)
    lib/(games/, reports/, sensorial/, lumi/, supabase/, types.ts)
    styles/(tokens.css, glass.css, motion.css)
  ```

### Passo 13 — Performance + Acessibilidade extrema
- Comprimir todas as imagens dos ursos pra WebP, qualidade 80, máx 1200px. Renomear com nomes semânticos.
- `loading="lazy"` em tudo abaixo da dobra. `priority` só no hero.
- `next/font` (Baloo 2, Nunito, Inter) — eliminar CDN do Google Fonts.
- Code-splitting por rota já é nativo.
- Mobile-first em todo CSS novo.
- WCAG 2.2: contraste ≥ 4.5:1 texto / 3:1 UI; foco visível 3px; alvos 44×44; `aria-live="polite"` em respostas da IA; skip link em todo layout; `:focus-visible` em todo interativo; teclado completo (tab/shift+tab/enter/esc); leitor de tela testado com NVDA + VoiceOver.
- Lighthouse: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- INP < 200ms, LCP < 2s em 4G simulado.

### Passo 14 — Vínculo emocional profundo
- Theo se lembra do nome, do que o adolescente gosta, do que aconteceu na semana, dos eventos próximos.
- Saudações contextuais: "oi, [primeiro nome]. Vi que você tem [evento] em [N dias]. Quer conversar sobre isso?".
- Marcos suaves: ao completar 30 dias acumulados de uso, Theo manda mensagem dedicada (sem fogos de artifício — frase calma, urso de joia).
- "Tô com você": botão fixo em `/home` que abre conversa com Theo em modo "só estar junto" (modo silencioso — Theo responde 3-5 palavras, sem perguntas).
- Aniversários e datas: se adolescente já mencionou data importante (extraída pra memória), Theo lembra no dia.

---

## 3. Sequência de execução (fases concretas)

### Fase A — Fundação (em andamento nesta sessão)
- [x] Migração SQL: `sessoes_jogo`, colunas novas em `eventos_calendario`, `lembretes_evento`, `relatorios_cuidador`, `perfil_sensorial` (a adicionar), `preferencias.compartilhar_relatorio`.
- [x] `types.ts` atualizado.
- [x] Nav com link `Games`.
- [x] `/games` index + 3 jogos (Respira, Cara da Emoção, Padrão Calmo) + endpoint `sessao`.
- [ ] `/calendario` com formulário rico + agenda + chip global.
- [ ] `/cuidador` scaffold (home + relatorios + vinculos + calendario + observacoes) com placeholders.
- [ ] `<BotaoSobrecarga>` global montado no layout interno.
- [ ] Tokens visuais base (`tokens.css`, `glass.css`).

### Fase B — Inteligência (próxima sessão)
- Perfil sensorial + adaptação automática (Passo 5).
- Memória categorizada + extrator (Passo 4).
- IA explicadora social (Passo 11).
- Vínculo profundo (Passo 14).

### Fase C — Voz
- Orb Voz + STT/TTS (Passos 2 e 3).
- Theo vivo (microanimações respiratórias, glow reativo).

### Fase D — Cuidador completo
- Relatórios automáticos via Groq + PDF (Passo 10).
- Toggle de compartilhamento do adolescente.
- Dashboard com gráficos reais.

### Fase E — Polish final
- Compressão WebP + renomeações.
- `next/font`.
- Auditoria axe + Lighthouse + leitor de tela.
- Microanimações finais (Framer Motion).

---

## 4. Convenções

- TypeScript estrito. Sem `any` (exceto borda).
- Server Components default. `"use client"` só quando precisa estado/efeito/evento.
- Supabase: `createSupabaseServer()` ou `createSupabaseBrowser()`. RLS sempre.
- IA: SEMPRE via route handler. Chave SOMENTE em env.
- Texto UI em pt-BR, tom calmo, sem "vamos lá!", sem emoji em excesso.
- Acessibilidade: `aria-live="polite"`, `<label>` em todo input, skip link, foco visível.
- Commits pequenos, conventional commits.

---

## 5. Filtro obrigatório antes de cada PR

1. Reduz sobrecarga sensorial?
2. Aumenta previsibilidade?
3. Explicável em 1 frase?
4. Funciona em 3G?
5. Funciona com leitor de tela?

3 "não" → não mergeia.

---

## 6. O que NUNCA fazer

- Mudar mascote, paleta ou tipografia base.
- Adicionar streak / "você perdeu sua sequência".
- Notificar cuidador automaticamente em crise (só opt-in).
- Vazar conteúdo literal de conversa no relatório do cuidador.
- Chamar a IA de "Lumi" em copy de UI.
- Pedir API key ao usuário.
- Animação que não respeite `prefers-reduced-motion`.
- Sons agressivos. Som default = off.
- Score competitivo em jogos.

---

*Versão 2.0 — 2026-05-20. Atualizar sempre que Charter ou metas de produto mudarem.*
