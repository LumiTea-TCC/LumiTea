# Product

## Register

product

> Exceção: `index.html`, `login.html` e `cadastro.html` operam no registro **brand**
> (landing/aquisição). Todo o resto é superfície de produto autenticada.

## Users

Dois públicos distintos, duas áreas distintas:

1. **Adolescentes autistas (TEA)** — usam a área "autista" (home-autista, conversa,
   diário, roleplay, games, calendário, conta). Contexto: uso diário, emocionalmente
   sensível, possível sobrecarga sensorial. Precisam de calma, previsibilidade e
   clareza. Gamificação (XP/níveis/conquistas) é motivadora, mas nunca ansiogênica.
2. **Pais/cuidadores** — usam o painel do cuidador (home-cuidador, calendário-cuidador,
   conta-cuidador). Contexto: adultos ocupados verificando o bem-estar do filho,
   muitas vezes em momentos de preocupação. Precisam de seriedade, confiança e
   informação rápida (alertas → humor → relatórios).

## Product Purpose

Plataforma de apoio socioemocional para adolescentes TEA com acompanhamento
parental: IA de conversa (Lumi/Theo), registro de humor, diário, roleplay social,
relatórios de IA para o cuidador e sistema de alertas de crise. Sucesso =
adolescente usa sem atrito sensorial; cuidador confia no que vê.

## Brand Personality

**Acolhedor, confiável, calmo.** O mascote urso e os azuis suaves carregam o
acolhimento; a área do cuidador troca o lúdico por sobriedade clínica sem perder
o calor da marca. Voz em português brasileiro, direta e sem infantilizar o
adolescente nem alarmar o cuidador.

## Anti-references

- Dashboards SaaS genéricos (hero-metric com gradiente, card grids idênticos).
- Apps infantis exagerados (confete, bounce, mascotes gritando) — o público é
  **adolescente**, não criança.
- Interfaces de "monitoramento/vigilância" frias — o cuidador acompanha, não espiona.
- Emojis como sistema de ícones (substituídos por SVG de traço consistente).

## Design Principles

1. **Calma é função, não estética** — menos estímulo simultâneo, motion contido,
   modo calmo (`data-modo-calmo`) sempre soberano sobre qualquer animação.
2. **Dois registros, uma identidade** — área teen pode ter delight pontual;
   área do cuidador é sóbria; ambas usam os mesmos tokens e o mesmo urso.
3. **Estado, não decoração** — motion comunica mudança de estado (150–250ms,
   ease-out); nada de coreografia de entrada em telas de tarefa.
4. **Alerta de crise acima de tudo** — na hierarquia visual do cuidador, um alerta
   de crise vence qualquer outro elemento da tela.
5. **Backend intocável** — Supabase/Groq/RLS não mudam por causa de design.

## Accessibility & Inclusion

- WCAG 2.1 AA mínimo: texto ≥ 4.5:1 (tokens já validados), foco visível,
  alvos de toque ≥ 44px.
- `prefers-reduced-motion: reduce` obrigatório em toda animação, em todas as páginas.
- Modo calmo próprio do produto (atributo `data-modo-calmo`) desliga TODO motion.
- Sem gatilhos vestibulares: nada de parallax, zoom ou spin de tela cheia.
- Preferências do usuário: tamanho de fonte, tema, redução de animação
  (tabela `preferencias_usuario`).
