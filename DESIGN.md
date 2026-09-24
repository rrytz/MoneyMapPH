---
name: MoneyMap PH
description: Personal finance management for Filipinos — one private ledger for all your money.
colors:
  # Primary family — Peso Emerald (sole brand accent)
  peso-emerald: "#059669"
  peso-emerald-vivid: "#10b981"
  peso-emerald-deep: "#047857"
  peso-emerald-pale: "#34d399"
  peso-emerald-soft: "#ecfdf5"
  # Semantic signal colors
  overdraft-rose: "#f43f5e"
  overdraft-rose-deep: "#be123c"
  overdraft-rose-soft: "#fff1f2"
  late-fee-amber: "#f59e0b"
  late-fee-amber-deep: "#b45309"
  late-fee-amber-soft: "#fffbeb"
  receipt-indigo: "#4f46e5"
  receipt-indigo-deep: "#4338ca"
  receipt-indigo-soft: "#eef2ff"
  # Neutral family — Ledger Slate + paper
  ledger-slate-950: "#020617"
  ledger-slate-900: "#0f172a"
  ledger-slate-800: "#1e293b"
  ledger-slate-100: "#f1f5f9"
  ledger-slate-500: "#64748b"
  ledger-slate-400: "#94a3b8"
  ledger-slate-200: "#e2e8f0"
  ledger-slate-50: "#f8fafc"
  paper-white: "#ffffff"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  ledger-figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: "'tnum'"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
  section-head:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.25rem"
  3xl: "1.75rem"
spacing:
  control-h: "2rem"
  card-pad: "1rem"
  card-pad-sm: "0.75rem"
  grid-gap: "1.25rem"
  page-gap: "2rem"
  nav-h: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.peso-emerald}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    height: "{spacing.control-h}"
    padding: "0 0.625rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ledger-slate-900}"
    rounded: "{rounded.md}"
    height: "{spacing.control-h}"
    padding: "0 0.625rem"
  card-default:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ledger-slate-900}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-pad}"
  fintech-card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ledger-slate-900}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  nav-item-active:
    backgroundColor: "{colors.peso-emerald-soft}"
    textColor: "{colors.peso-emerald-deep}"
    rounded: "{rounded.lg}"
    height: "2.5rem"
    padding: "0 0.875rem"
  badge-income:
    backgroundColor: "{colors.peso-emerald-soft}"
    textColor: "{colors.peso-emerald-deep}"
    rounded: "9999px"
    height: "1.25rem"
    padding: "0 0.5rem"
  badge-expense:
    backgroundColor: "{colors.overdraft-rose-soft}"
    textColor: "{colors.overdraft-rose-deep}"
    rounded: "9999px"
    height: "1.25rem"
    padding: "0 0.5rem"
---

# Design System: MoneyMap PH

## Overview

**Creative North Star: "The Emerald Ledger"**

MoneyMap PH is a personal finance companion for Filipino earners, built around
one idea: your entire financial life is a single ledger, and the ledger is an
emerald ribbon of money moving in the right direction. The interface is calm,
confident, and quietly premium — Stripe-dashboard discipline translated for
paycheck-to-paycheck reality. Slate does the talking; emerald is the one
accented voice, heard only when money behaves or an action is worth taking.

The system is dense by design, not decorative: 32px controls, 14px body text,
tabular numerals on every figure, and hairlines instead of shadows. Surfaces
sit flat on the page; elevation is a response — menus and popovers float on
soft shadows, cards rise one step on hover, never at rest. This is a tool a
person reaches into several times a day with real money in it; it should feel
precise, trustworthy, and quiet, with the numbers always the loudest thing on
screen.

**Key Characteristics:**
- Single accent: Peso Emerald. Rose, amber, and indigo appear only as semantic signals (expense/danger, warnings, info/savings).
- Flat-by-default surfaces: hairline rings (1px, foreground/10) and tonal muted layers; shadows only for floating overlays.
- Dense fintech controls: 32px (h-8) default actions and inputs, 14px text, decisive 3px focus rings.
- Tabular numerals on every money figure; numerals lead, copy follows.
- Three card variants: Surface (flat hairline workhorse), Featured (the one raised card — Financial Health hero), and Inset (flat tonal layer boxed inside a card). Card-in-card shadow stacking is gone; hierarchy inside a card is tonal.
- Signature motif: the ascending money-bar (logo + pay-strip) — growth read as bars, not pie charts.
- Rejected: purple-blue SaaS gradients, shadow-stacked card-in-card, decorative gradient blobs on content, dark-on-dark gray text, decorative copy that isn't financial truth.

## Colors

The palette is a monochrome ledger in slate, with a single committed accent —
Peso Emerald — borrowed by income/positive states, and three semantic signal
colors that never compete with the accent. Dark mode keeps the same roles with
inverted slate steps and softened tints.

### Primary
- **Peso Emerald** (#059669, light primary / emerald-600): the accent. Primary buttons, focus rings, links, active navigation states, sidebar CTA, income strokes. Hover falls to 80% opacity on token-driven buttons; dedicated emerald-600→700 steps on hard-coded CTAs.
- **Peso Emerald Vivid** (#10b981, emerald-500): the dark-mode primary, and the income line/area stroke on charts. Reads brighter on slate-950 for equal punch.
- **Peso Emerald Deep** (#047857, emerald-700): hover steps on the sidebar CTA, and the label text of income/positive soft pills (light mode).
- **Peso Emerald Pale** (#34d399, emerald-400): the light end of the logo ribbon gradient and the glow; bright beam in the auth story panel.
- **Peso Emerald Soft** (#ecfdf5, emerald-50): *live* — soft pills, active nav, income badges, KPI icon tiles; dark mode tints it to emerald-950/40–50 with emerald-400 labels.

### Semantic Signals (Role Colors)
- **Overdraft Rose** (#f43f5e, rose-500): anything money leaving or dangerous — expense strokes, destructive buttons and text, debt figures, error validation. **Overdraft Rose Soft** (#fff1f2) / **Deep** (#be123c) complete the expense pill family.
- **Late-Fee Amber** (#f59e0b, amber-500): warnings that qualify, not panic — near-limit budgets, cautionary deltas, "est." markers. **Late-Fee Amber Soft** (#fffbeb) / **Deep** (#b45309).
- **Receipt Indigo** (#4f46e5, indigo-600): information and savings-only roles — savings-adjacent icons, info badges ("tips"), not actions. **Receipt Indigo Soft** (#eef2ff) / **Deep** (#4338ca).

### Neutral
- **Ledger Slate 950** (#020617): the dark-mode page background. Never a content surface on its own.
- **Ledger Slate 900** (#0f172a): primary text (light mode) and the dark-mode card/popover/sidebar surface.
- **Ledger Slate 800** (#1e293b): dark-mode secondary/muted/accent surfaces and borders.
- **Ledger Slate 100** (#f1f5f9): light-mode muted/secondary/accent surface — hover fills, footer tints.
- **Ledger Slate 200** (#e2e8f0): light-mode hairlines — borders, input strokes, dividers, chart grid.
- **Ledger Slate 400 / 500** (#94a3b8 / #64748b): muted text — secondary copy, placeholders, axis ticks (dark / light).
- **Ledger Slate 50** (#f8fafc): light-mode page background.
- **Paper White** (#ffffff): light-mode cards, popovers, sidebar, inputs at rest.

### Named Rules
**The One Accent Rule.** Peso Emerald is the only brand accent on a slate field; it is reserved for money moving in the right direction and for primary actions. Rose, amber, and indigo are semantic signals, never decoration. When in doubt, reach for slate.
**The Green-Red Ledger Rule.** Green always means money in (income, savings, positive delta); rose always means money out or dangerous (expenses, debt, errors). The pairing is never swapped for stylistic effect.

## Typography

**Display Font:** Sora (with ui-sans-serif, system-ui fallback) — the voice of headings, titles, and hero numbers.
**Body Font:** Inter (with ui-sans-serif, system-ui fallback) — all reading text, labels, and figures.
**Label/Mono Font:** none committed — figures use Inter `font-variant-numeric: tabular-nums`, not a mono face.

**Character:** A quiet serif-free pairing with a split personality: Sora gives headings a modern, slightly technical confidence (geometric, open), while Inter carries the work — dense, legible at small sizes, trustworthy with numbers in tabular alignment. The pair reads like a well-made financial dashboard, not a magazine.

### Hierarchy
- **Display** (Sora, 700, 2rem–2.35rem, line-height 1.15, tracking -0.025em): the auth hero headline and its stat values only. It is *not* the general page-title voice.
- **Headline** (Inter, 700, 1.5rem tracking -0.025em): page titles (e.g., page headers at `text-2xl`), big goal percentages up to `text-4xl`.
- **Section Head** (Sora, 500, 1.125rem): card and dialog titles — `section-head`. Replaces the old 1rem Sora title lane at the card level.
- **Body** (Inter, 400, 0.875rem): default surface text; card body, descriptions, table cells. Money values step up to the ledger figure voice.
- **Ledger Figure** (Inter, 600, 2rem→2.5rem@sm, tracking -0.025em, tabular) — `ledger-figure`: the one biggest number per screen — KPI values, safe-to-spend, totals. All figures on a surface render at ONE shared computed size (`ledger-figure`), so equal-value figures never compete at different sizes.
- **Caption** (Inter, 400, 0.75rem, uppercase, letter-spacing 0.05em, muted-foreground) — `caption`: labels and chips. The old "500 semibold" label voice drops to normal-weight uppercase captions.

### Named Rules
**The Tabular Ledger Rule.** Every money figure, percentage, and progress value is set with `tabular-nums` so columns of pesos align and never jitter. Exceptions: none.
**The Sora-Lanes Rule.** Sora appears in exactly two lanes: auth-screen headings (hero, form titles, stat values) and section heads/card titles via `font-heading` (`section-head`). It is never used for body copy, never for general page headers (those are Inter, `text-2xl` bold), and never for money figures (Inter, tabular `ledger-figure`). Two type families, never three, never mixed mid-sentence.

## Layout

The app is a workbench with three fixed chrome pieces and a content canvas.
Desktop: a white sidebar (250px; 72px collapsed) anchors navigation on `lg+`,
a translucent topbar (56–64px, backdrop-blur) carries breadcrumb, search,
notifications, theme, and avatar, and content sits to the right with a
`page-enter` fade/slide (200ms) on arrival. Mobile: navigation moves to a
fixed bottom tab bar (64px, `bg-card/95 backdrop-blur-md`) with four primary
destinations plus a "More" bottom sheet, and the topbar drops the search to a
`md+`-only affordance. Both chrome bars respect `env(safe-area-inset-*)` for
notched phones.

Density is the default rhythm: controls are 32px tall (h-8), control padding
is 10px horizontal, FintechCards pad 20px (Surface and Featured alike; Inset
sub-boxes pad 16px), card grids use
20px gaps (`gap-5`), and page sections breath at 32px (`mb-8` / `gap-8`).
KPI strips flow `1 → 2 → 4` columns across breakpoints; card grids use the
same column philosophy rather than pixel-fixed widths. The auth surface is a
centered `max-w-5xl` split card (story panel + form) — the only full-height
dramatic layout in the product.

## Elevation & Depth

Flat-by-default with overlay-only shadows — confirmed invariant. Content
surfaces at rest carry a 1px hairline (`ring-1 ring-foreground/10` plus
`border-border`) and no shadow; hierarchy on the page is conveyed tonally via
muted fills (`bg-muted/30` Inset boxes, `bg-muted` hover chips) rather than by
stacking dropped shadows. Within the FintechCard dialect the Featured variant —
and only it, the Financial Health hero — rests on `shadow-sm` and rises to
`shadow-md` on hover; Surface and Inset never raise. (Legacy `shadow-sm`
holders outside the dialect — `account-card`, `pay-strip` — are Slice-3
normalization targets.) Floating overlays carry soft shadows so they read as
*above* the ledger, and the auth hero card floats on a large emerald-tinted
`shadow-xl`. Nothing else casts a shadow at rest.

### Shadow Vocabulary
- **Overlay** (`shadow-md`): dropdown menus, selects, popovers — floating controls. Paired with a 1px `ring-foreground/10` hairline.
- **Overlay High** (`shadow-lg`): sheets, toasts, tooltips, the chart tooltip (dark, `0 10px 15px -3px rgba(0,0,0,0.3)`), error cards.
- **Raised Card Rest / Hover** (`shadow-sm` → `shadow-md` with a 200ms transition): the Featured FintechCard only — the Financial Health hero, the sole raised card in the FintechCard dialect.
- **Hero** (`shadow-xl shadow-emerald-950/[0.06]`, dark `shadow-black/40`): the auth shell card only.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, focus, floating), on the Featured card (the one raised headline unit), or on the auth hero; a shadow is never how a resting card asserts importance.

## Shapes

The form language is a sharp rail: controls sit on the small `md` step (8px),
which at the standard 32px height reads as a decisive, squared-off shape —
geometric, never bubbly. Small chips/tags ride the `sm` rail (6px); large
controls and list rows step up to `lg` (12px), and Inset sub-boxes ride the
same `lg` step. FintechCards use `xl` (16px) — Surface and Featured alike
(Featured has no radius claim of its own), the Financial Health hero lands at
`3xl` (28px), and the auth hero and bottom sheet also land at `3xl` (28px).
Badges are fully rounded pills (`9999px`). Borders are always the 1px hairline
(`ledger-slate-200` light / `ledger-slate-800` dark); there is no other stroke
weight in the system, no clipping, and no texture. Gradients are a signature
exception owned by two places only: the logo mark and the auth story panel.

### Named Rules
**The Radius Ladder Rule.** Radius steps belong to roles: `sm` 6px for chips/tags, `md` 8px for controls (buttons, inputs, selects), `lg` 12px for large controls, list rows, and Inset sub-boxes, `xl` 16px for FintechCards (Surface and Featured), `3xl` 28px for hero/sheets, pills fully round. Don't jump roles for decorative variety (a primary action button never exceeds `md`; a FintechCard never dips below `xl`).

## Components

*Snapshot note: the render-ready snippets in `.impeccable/design.json` describe this system as of 2026-09-21. They are descriptive, not authoritative — if live code and a snippet disagree, live code wins and the snippet should be refreshed alongside the change.*

### Buttons
- **Shape:** sharp rail (radius 8px `md`), 32px default height, 10px horizontal padding, 14px medium text.
- **Primary:** Peso Emerald fill, Paper White text; hover drops the fill to 80% (`bg-primary/80`).
- **Hover / Focus:** 150ms transitions; focus shows a 3px ring at `ring/50` plus a `border-ring` step; `:active` nudges the button down 1px. Disabled at 50% opacity, no pointer events.
- **Outline:** 1px `ledger-slate-200` stroke on background, hover fills muted. **Secondary:** muted slate fill with a 5% foreground color-mix hover. **Ghost:** no fill until hover. **Destructive:** rose tinted (10% fill, rose text) — never full-rose except the danger moment itself. **Link:** emerald text, underline on hover.
- **Sizes:** default h-8, sm h-7, xs h-6, lg h-9, icon sizes 24–36px. The system prefers smaller, not larger.

### Inputs / Fields
- **Style:** 32px tall, 1px `ledger-slate-200` stroke, transparent fill, 10px horizontal padding; 14px text after `md`, 16px on touch (iOS autozoom guard).
- **Focus:** the stroke shifts to Peso Emerald and a 3px `ring/50` appears — one decisive green ring, nothing else.
- **Error / Disabled:** invalid = rose stroke + rose 3px ring at 20%; disabled = muted tinted fill at 50% opacity. Search fields are pill-shaped (radius 9999px) in a muted fill.

### Badges / Chips
- **Style:** fully rounded pill, 20px tall, 12px text, 8px horizontal padding.
- **State:** semantic soft pills — Income (emerald soft + deep label), Expense (rose soft + deep), Warning (amber soft + deep), Info (indigo soft + deep — savings/tips only). Dark mode swaps to /50 tints with 400-family labels. There is no neutral "filter chip" state in the system.

### Cards / Containers
- **Corner Style:** FintechCards `xl` 16px (Surface and Featured); the Financial Health hero `3xl` 28px (sole large corner); Inset sub-boxes `lg` 12px.
- **Variant 1 — Surface (`FintechCard surface`):** Paper White, 1px border, `xl` 16px corner, 20px padding, entirely flat. The workhorse: KPI cards, account cards, savings goals, settings tiles, list panels.
- **Variant 2 — Featured (`FintechCard featured`):** the *one* resting raised card. Same `xl` 16px corner and 20px padding, rests on `shadow-sm` → `shadow-md` on hover (200ms). Used only for the Financial Health hero.
- **Variant 3 — Inset (`FintechCard inset`):** flat tonal layer boxed *inside* a card — `bg-muted/30`, no border (`border-transparent`), no shadow of its own, `lg` 12px corner, 16px padding. Sub-boxes (health breakdown tiles) that never read as cards-within-cards.
- **Border:** 1px hairline only. **Internal Padding:** 16–20px.

### Navigation
- **Sidebar (desktop):** Paper White rail, 250px (72px collapsed), hairline borders, logo header 64px. Active item = emerald soft pill (`emerald-50`, `shadow-xs`), emerald icon, semibold label; inactive = slate text over muted hover. Collapse toggle ghost at the foot. The pinned "+ Add Transaction" CTA is Peso Emerald (600→700 hover).
- **Topbar:** translucent card (`bg-card/90 backdrop-blur-md`), sticky, breadcrumb left; search pill, notifications, theme (light/dark/system), and avatar menu right. Avatar fallback is an emerald soft disk with initials.
- **Mobile:** fixed bottom tab bar, 4 primary links (Dashboard, Income, Expenses, Budgets) + "More" sheet; active = emerald-600/400 text with semibold; secondary items render as 2-up bordered tiles with emerald icons and an emerald soft active tile.

### Signature: The Ascending Bars (logo + pay-strip)
The identity motif is growth read as bars: three ascending pillars inside an "M" fold with an up-right arrow, in a Peso Emerald ribbon gradient (pale→vivid→deep) with a soft emerald glow. The wordmark sets "Money" in slate, "Map" in emerald, and "PH" as superscript tracking-wide; the tagline is letterspaced uppercase microcopy ("Plan • Track • Grow"). The same ascending-bar language carries into the auth story panel's **PayStrip** money-bar chart (paycheck vs. spending by period) and the auth "barbeat" animation — one motif, three surfaces.

### KPI Cards & Progress
KPI cards pair a tinted icon tile (soft fill per role: emerald / indigo / rose / amber) with a `ledger-figure` tabular stat (Inter 600, 2rem→2.5rem@sm, tracking-tight, tabular-nums) and a same-role delta. All KPI figures on a surface share one computed size, so equal-value figures never render at different sizes. Progress bars are 4px-high emerald tracks on a muted rail with a tabular percent label; no gradient, no glow.

### Charts
Recharts, drawn from the ledger's color rules: income is a solid emerald 3px stroke with a pale emerald area fade; expenses are a dashed (4-4) slate 2px stroke with a faint slate fade — never rose in charts. Grid only horizontal (`strokeDasharray="3 3"`, slate 200 at 0.6 opacity); axis ticks 11px slate 500; the tooltip is a dark pill (slate-900 on slate-800 hairline, rounded 12px).

## Do's and Don'ts

### Do:
- **Do** let Peso Emerald carry every primary action and every "money in" figure, and nothing else — the accent is rare and that rarity is its power.
- **Do** set every money, percent, and progress figure in tabular numerals; financial columns must align.
- **Do** keep resting surfaces flat with a 1px hairline; raise a card (`shadow-sm → md`) only for the Featured hero — it is the one card that may sit raised at rest.
- **Do** reserve rose for money out / danger, amber for warnings, indigo for information and savings — the semantic signals never cosplay as the accent.
- **Do** keep the 32px control rhythm for actions and inputs; the system is dense on purpose.
- **Do** use the ascending-bar motif (logo, pay-strip) when a financial trend needs a signature visual.

### Don't:
- **Don't** introduce purple-blue SaaS gradients, glassy blobs, or gradient fills on content cards, buttons, or charts — the gradient is the logo and auth panel's signature, and theirs alone.
- **Don't** stack card-in-card with shadows to create hierarchy; layer inside a Featured card with the flat tonal Inset variant instead.
- **Don't** use Sora for body copy or labels, or Inter tracking-tight where tabular figures belong — voices stay in their lane.
- **Don't** swap the green/red money polarity for style (income = emerald, expense = rose is an invariant, light and dark).
- **Don't** ship a UI change without the app's real viewports — desktop and the installed-PWA mobile size — checked side by side.