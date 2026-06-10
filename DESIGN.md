# Design — LumiTEA

Sistema visual canônico. Fonte da verdade: `css/tokens.css` (v2). Os arquivos
`lumitea.css` (global + landing) e `app.css` (páginas internas) consomem os tokens;
nenhuma página deve redefinir cor/raio/sombra em `<style>` inline.

## Ordem de carregamento (todas as páginas)

```html
<link rel="stylesheet" href="lumitea.css">
<link rel="stylesheet" href="app.css">      <!-- páginas internas -->
<link rel="stylesheet" href="css/tokens.css">
<script src="js/core/icons.js" defer></script>
```

## Cor (hex, validado WCAG AA)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#eef7ff` | Fundo geral |
| `--bg-2` | `#f4f8fd` | Painéis, faixas, inputs |
| `--surface` | `#ffffff` | Cards |
| `--brand` | `#4a7eb5` | Azul identidade (logo, acentos calmos) |
| `--brand-dark` | `#2e5fa3` | Gradientes de marca, hero do cuidador |
| `--primary` | `#2196f3` | Ícones, bordas ativas, links |
| `--primary-action` | `#1976d2` | Botões preenchidos (4.6:1 c/ branco) |
| `--primary-dark` | `#1565c0` | Hover de botão |
| `--text-main` | `#1a2e4a` | Títulos |
| `--text-soft` | `#3d6080` | Corpo |
| `--text-muted` | `#4e6f95` | Labels, metadados (5.2:1 — nunca mais claro) |
| `--border` | `#b3d9f8` / `rgba(74,126,181,.16)` | Bordas |
| Estados | success `#2e7d32`, warning `#7a4f1a`, danger `#c62828`, info `#1565c0` | sempre com os fundos `--*-bg` pareados |

Estratégia: **Restrained** — neutros azulados + um acento. A área do cuidador usa
`--brand`/`--brand-dark`; delight teen pode usar `--violeta #7c5cbf` e `--ambar #e08e30`.

## Tipografia

- Display: **Baloo 2** (títulos, h1–h3, números grandes). Corpo/UI: **Nunito**.
- Escala fixa rem (produto): 11 → 12 → 13.5 → 15 → 17 → 19 → 22 → 27px (~1.2).
- `text-wrap: balance` em h1–h3. Sem clamp fluido nas telas de produto.
- Nada de Baloo 2 em labels de formulário, botões pequenos ou dados.

## Espaçamento e forma

- Escala 4px: `--sp-1: 4px` … `--sp-10: 48px`. Sem valores fora da escala.
- Raio: `--r-sm 8 / --r-md 12 / --r-lg 16 / --r-xl 20px`. Pill apenas em badges.
  Cards nunca acima de 20px.
- Sombras: `--shadow-1/2/3` (suaves, azuladas). Nunca borda 1px + sombra larga juntas.
- Nunca `border-left` colorido como acento — usar fundo tintado + ícone.

## Ícones

Sistema próprio em `js/core/icons.js`: SVG inline 24×24, traço 1.75px,
`stroke: currentColor`, `fill: none`. Uso estático: `<i data-lt-icon="bell"></i>`;
uso em strings JS: `LUMI.icon('bell')`. Sempre `aria-hidden="true"` com rótulo
textual adjacente. **Emojis são proibidos como ícone funcional**; permitidos
somente como conteúdo emocional do adolescente (ex.: escala de humor).

## Motion

- Tokens: `--dur-fast 150ms / --dur-base 220ms / --dur-slow 400ms`,
  `--ease-out (quart)`, `--ease-out-expo`.
- Produto: transição de **estado** apenas (hover, foco, conteúdo carregado:
  fade 200ms). Sem stagger de página, sem bounce/elastic, sem loop sem pausa.
- Brand (index/login/cadastro): reveal de scroll via IntersectionObserver
  (`.reveal-section`), com fallback de crossfade.
- `prefers-reduced-motion` e `html[data-modo-calmo="true"]` desligam tudo
  (global em tokens.css).

## Z-index semântico

`--z-nav 200 / --z-fab 300 / --z-banner 400 / --z-drawer 500 / --z-modal 600 /
--z-toast 700`. Proibido 999/9999 literais.

## Componentes (vocabulário único)

- Botões: `.btn-primary` (preenchido `--primary-action`), `.btn-secondary`
  (tonal), `.btn-danger-ghost`. Estados: default/hover/focus-visible/active/
  disabled/loading em todos.
- Cards: `.c-card` — borda `rgba(74,126,181,.14)` 1px OU `--shadow-1`, raio `--r-lg`.
- Formulários: `.f-group/.f-label/.f-input/.f-select` (conta.html é a referência).
- Estados vazios: ícone + frase que ensina a próxima ação (nunca só "nada aqui").
- Skeleton para loading de dados; spinner apenas em ações de botão.
