# SDD Ledger — 2026-09-22 Emerald Ledger Redesign (de-template pass)

Plan: `docs/superpowers/plans/2026-09-22-emerald-ledger-redesign.md`
Workspace: `.superpowers/sdd/2026-09-22-emerald-ledger-redesign/`
BASE: `4a3bdf6f7b0ca656a5689780844b96f6a65668a9` (HEAD at start; "docs: document MoneyMap PH design system")

Regime: no bash on PATH → task-start/task-done ledger replicated manually.
Inline implementation (no subagent tool in this harness); final review = ledgered self-review before commit.
Gate per slice: 16 shots (4 surfaces × desktop 816×418 / mobile 390×844 × dark / light(toggle))
+ 4 DOM probe asserts + `impeccable detect` + DESIGN.md flagged diff. Commit only on PASS.

## Slice 1 (Task 1) — Radius sharp rail + Type anchors (pure tokens)

- [x] Pre-flight: plan Task 1 contract read; globals.css token block; ui base
      controls (button/input/textarea/select/tabs radii); fintech-card base;
      probe-dom.js; capture infra (cookie-bridge, capture-mobile); all 4 surface
      type+radius target inventories (dashboard KPI/hero/STS/debt/bills/accounts/
      stat-strip, expenses KPI region, accounts summary block, settings).
- [x] Ledger workspace ready; brief written (`task-1-brief.md`).
- [x] TDD red: probe asserts (a)–(d) written, FAIL on live baseline.
- [x] Implement: radius factor ladder, type anchors, ui controls, chips, cards.
- [x] TDD green: probes PASS; `impeccable detect` clean on swept targets.
- [x] Docs: DESIGN.md Radius Ladder + Typography Hierarchy re-roll + design.json.
- [x] Gate: 16 shots vs `shots/baseline/` → **PASS** (probes all-PASS,
      `probes/probes-2026-09-22T05-22-27-346Z.json`; detector exit 0).
- [x] Commit `838eb18` `S1 tokens: radius sharp rail + type anchors` (on PASS).
- [x] STOP — user reviewed Slice 1 (approved).

## Slice 2 (Task 2) — Card variants + metric dedupe (structural core)

- [x] Pre-flight: Task 2 contract read; probe (b) re-read; FINISHED analysis;
      FintechCard callers inventoried; health denominators; vitest config.
- [x] TDD red: `health-breakdown.test.ts` written first (helper missing → fail).
- [x] Implement: fintech-card three variants; health-hero Featured + Inset;
      `health-breakdown.ts`; KPI raw % Savings Rate stays.
- [x] TDD green: vitest 3/3; probes (a)–(d) ALL-PASS 16 configs; detector exit 0.
- [x] Gate: 16 shots vs baseline, re-captured signed-in 09:57 → **PASS**.
- [x] Docs: DESIGN.md dialect/elevation refresh + design.json.
- [x] Commit `53f453d` `S2 cards: Surface/Featured/Inset + metric dedupe` (on PASS).
- [x] Review: user approved Slice 2 (2026-09-24) — "card variants read as distinct
      weights, Savings Rate duplicate gone"; approved Slice 3; asked for (a) the
      cookie-bridge procedure documented in the plan (done — Task 0 now has the
      self-served bridge block + knowns), (b) conformance detector as a real
      repo test.

## Slice 3 (Task 3) — Accent enforcement + light-world governance (with detector)

- [x] Pre-flight: Task 3 contract read; violation inventory greps (cyan, rose
      buttons, amber/indigo bg, slate bypasses, shadow-sm); settings `#6366f1`
      default located (settings-client.tsx:98/106); KPI tile structure read;
      ui component defaults confirmed (button default = `bg-primary` emerald;
      Input `bg-transparent`; DialogContent `bg-popover`); globals.css token
      block (L51-118) read for the DESIGN.md light table.
- [x] TDD red: `design-conformance.test.ts` (Rules A–D) written first, FAILS on
      live sweep (every straggler enumerated).
- [x] Implement 3a: Accounts cyan→emerald (accounts-client, account-card,
      account-modal, transfer-modal, account-select); Expenses + Savings rose
      button fills → default emerald primary; KPI/stat/info amber+indigo bg
      tiles → neutral `bg-muted`/`bg-muted/60` with semantic text (rose keeps
      icon identity); Settings new-category default `#6366f1` → ledger-slate
      `#64748b` (documented neutral); auth-shell teal wash → emerald.
- [x] Implement 3b: Accounts family hard slate (bg-slate-900/80, bg-slate-800,
      text-slate-100, border-slate-800 …) → tokens; shadow-sm flatten on
      account-card + pay-strip + account-select; DESIGN.md light-world section +
      Light-World Rule; `.impeccable/design.json` refresh.
- [x] TDD green: conformance test passes; vitest suite green (conformance +
      health); `impeccable detect` exit 0 on swept targets.
- [x] Light probe: DOM probe (e) light-world assert (accounts cards computed bg =
      token paper with `.dark` toggled off, not dark slate) added to probe-dom.js.
- [x] Gate: baseline rolled forward (shots/after → shots/baseline = Slice-2
      state); 16 fresh after shots (dark OS + light class-toggle); 16 probes
      ALL-PASS; detector green. **PASS** — `probes/probes-2026-09-24T23-37-46-366Z.json`:
      all 16 configs a/b/c/d/e/ALL PASS; 16 after shots all present with sane
      byte ranges; accounts dark/light bytes now differ (61,288 vs 60,663) where
      the hard-slate cards made them identical pre-sweep; `impeccable detect`
      exit 0 (advisories only; one pre-existing `border-l-4` warning untouched
      by this slice); `npx tsc --noEmit` clean; vitest 40 files / 310 tests PASS.
- [x] Commit `S3 accent enforcement + light-world + conformance detector` (on
      PASS; detector file IS a committed repo test; `verification/` untracked).

## Slice 4 (Task 4) — Emoji → Lucide icon system + governed 6-tint palette

- [x] Pre-flight: Task 4 contract read; live DB read (11 rows, all `is_default`);
      both backup dumps (same 11); user supplied their 8 (🚌 🛒 🧪 💡 🏦 📦 🍽️ 💰)
      → union = 14 distinct emoji; all 14 Lucide names verified present in
      `lucide-react@1.27.0`; every raw-emoji render site inventoried (8 sites +
      2 `|| "📦"` fallbacks); donut `FALLBACK_COLORS` read.
- [x] **Design approved by user (2026-09-25)** — mapping table, 6-tint palette,
      read-time `Package` fallback contract, and no-destructive-writes confirmed
      BEFORE any code. Decisions: tint 6 = slate-700 `#334155` (not paper);
      seed assignment as proposed (Emerald×4 / Indigo×3 / Slate×3 / Amber×1,
      repetition accepted — donut top-5 legend carries icon + label);
      cyan remap = **3 rows** (Savings + Emergency Fund + Motorcycle Fund),
      superseding the plan's 2. Migrations 001/008 left untouched.
- [x] TDD red: `category-icon-map.test.ts` + `category-color-map.test.ts` (14
      mappings, Lucide-key passthrough, VS16 normalization, unknown/empty →
      `Package`, 6-tint palette, 3-row cyan remap) + detector Rule E/E2; all
      FAIL first (modules missing; Rule E enumerated 18 violations).
- [x] Implement: `icon-map.ts` (pure strings) + `color-map.ts` + `category-icon.tsx`;
      swept 8 render sites + 2 `|| "📦"` fallbacks + the income-source 💰 glyph;
      Settings icon grid + 6-swatch picker; donut `FALLBACK_COLORS` → governed
      palette (it had carried banned `#3b82f6` + `#06b6d4`).
- [x] TDD green: 337/337 tests (42 files); detector 7/7 (A–E, E2); `tsc --noEmit`
      clean; `impeccable detect` exit 0.
- [x] Gate: 16 shots zero-emoji both themes (new probe assert **f**); 16 probes
      ALL-PASS (`probes/probes-2026-09-24T23-58-12-886Z.json`); detector green
      incl. Rule E.
- [x] PWA check (user, on device, 2026-09-25): **PASS** — zero emoji on all four
      surfaces, picker is the icon grid, edit modal pre-selects the resolved Lucide
      icon + tint (Transportation → Car + Indigo). Read-time map confirmed on device.
- [x] Commit `a6c63af S4 icons: Lucide category system + governed picker` (on PASS).

## Rulings (Slice 2)
- Ruling A: Featured = `rounded-3xl` (28px), NOT the plan's `rounded-2xl`. The plan text
  predates Slice-1's radius re-ladder (2xl was 28.8px pre-sweep; now 20px). Probe (b)
  requires the sole >20.5px card to carry literal `rounded-3xl` in first 64 chars of
  className; 20px would leave NO large card and the hero would lose its one-featured
  identity. Cost if wrong: hero corner is 28px not 20px — matches the approved S1 hero.
- Ruling B: Surface keeps `p-5` + `text-card-foreground` even though plan text omits them;
  callers like `accounts-summary-card` rely on base padding, and card detector needs
  padTop >= 16 for cards to be measured at all.
- Ruling C: Inset = `rounded-lg bg-muted/30 border-transparent p-4` — intentionally OUTSIDE
  probe (b)'s rounded-xl/2xl/3xl selector, so sub-boxes become tonal layers, not cards.

## Rulings (Slice 3)
- Ruling D: Rule C scoping — `bg-amber-*`/`bg-indigo-*` banned on tiles/chips;
  exemptions: (1) chart-fill child variants (`[&>div]:bg-amber-500`), (2) chart
  gradients (`bg-gradient-to-t from-amber-500/20 to-amber-400`), (3) full-strength
  bar/dot weights (`bg-amber-400/500`, `bg-indigo-500`), (4) the `badge.tsx`
  info-badge component (review-focus #3 names info-badges legit).
- Ruling E: KPI/stat icon tiles → `bg-muted text-muted-foreground` (fully neutral)
  except rose-relevant (debt/spending) keep `bg-muted text-rose-600 dark:text-rose-400`
  and emerald tiles unchanged; amber/indigo info tiles (label+value) → neutral bg +
  semantic text stepped to -700 in light (`text-amber-700`/`text-indigo-700`) per the
  S3 review-focus contrast rule (rose-500-on-white 3.3:1 is non-text-only).
- Ruling F: Rose/amber on buttons anywhere (incl. savings debt CTA, payment, modal
  submits) → default Button primary (emerald `bg-primary`). Rose stays only as
  data semantics: amounts, deltas, error text, chips/badges.
- Ruling G: New-category default color `#6366f1` → `#64748b` (ledger-slate-500,
  the donut's existing "no color" fallback + S4 palette neutral) — a new category
  claims no accent until the user picks. Documented in DESIGN.md.
- Ruling H: auth-shell `to-teal-50` counts as cyan-family (Rule A) → `to-emerald-50`.
- Ruling I: The light probe compares computed backgrounds against the `--card`/`--background`
  CSS tokens, not literals, so it stays robust across future token edits.

## Rulings (Slice 3 gate corrections)
- Ruling J: Probe (e) must settle before sampling. `probe-run.mjs` removes `.dark` and
  evaluates immediately, so cards carrying `transition-all` were read mid-tween and
  reported the DARK world's `--card` (slate-900) as a light-world violation. The probe
  is now async with a 250ms settle; empirically `--card` = `#fff` in light world
  (verified directly in the tab, not inferred from the probe).
- Ruling K: Probe (e) only counts painted borders. Checking `borderColor` on 0-width
  borders flagged every Button/Tab/SVG (default `border-color` is a dark slate value
  with `border-width: 0`) — nothing is rendered, so it is not a bypass.
- Ruling L: The chart tooltip is an intentionally dark floating overlay in both worlds
  (`#0f172a`/`#1e293b` hard-coded; DESIGN.md elevation calls it dark by design). It is
  exempt from (e): the Light-World Rule governs content surfaces, not overlays.
- Ruling M: Capture scripts screenshot the dark column the instant `load` fires;
  `/settings` was captured as a skeleton shell (19KB vs 44KB baseline). Both capture
  scripts now wait for `.animate-pulse` to clear before probing/screenshotting, so the
  dark column captures the same settled state as the light column. This was a capture
  timing artifact, not a code regression — confirmed by the light column (warm page)
  rendering full-size in the same run.

## Rulings (Slice 4)
- Ruling N: Tint 6 = slate-700 `#334155`, not paper. Paper `#ffffff` is invisible on the
  white card and makes the donut legend's `${color}18` chip (`ffffff18`) invisible. No
  category in the set is paper-like, so nothing is lost.
- Ruling O: The plan's "Emergency Fund / Motorcycle Fund cyan remap" undercounted — three
  seed rows are cyan-family (Savings `#14b8a6` teal, Emergency Fund `#06b6d4`,
  Motorcycle Fund `#0ea5e9`). All three remap, superseding the plan.
- Ruling P: `#f43f5e` is BOTH the palette rose tint and Rent's legacy seed hex, so a
  context-free hex resolver cannot distinguish "Rent seeded rose" from "user picked
  rose". Precedence is **palette-first**: a governed hex always passes through, so an
  explicit user pick is never overridden. Consequence: Rent renders rose (a legal tint)
  rather than the proposed indigo. The invariant "an explicit user pick always wins"
  is stronger than the aesthetic assignment, and the alternative silently discards
  user data. The other 10 seeds match the approved table exactly.
- Ruling Q: Rule E scopes the emoji ban to **pictographic** blocks (1F300–1FAFF +
  regional indicators) and excludes the 2600–27BF dingbat block, which holds legitimate
  status glyphs (the income calendar's "✓" paid marker). Comments are skipped, and the
  raw-icon-text-node check uses a `(?<!=)` lookbehind so JSX attribute values
  (`icon={cat.icon}` on `<CategoryIcon>`) aren't misread as text nodes.
- Ruling R: `icon-map.ts` stays pure (strings only, no React import) so it is unit-testable
  in plain node; the key → LucideIcon component lookup lives in `category-icon.tsx`.
- Ruling S: Probe assert (f) counts only *rendered* text. The RSC flight payload in
  `<script>` legitimately still carries the legacy emoji strings — a read-time migration
  requires that — so SCRIPT/STYLE/NOSCRIPT/TEMPLATE text nodes are skipped. Without this
  the "zero emoji" gate fails on data that is never painted.

## Key constraints (standing)
- Cyan ban absolute (including teal/sky family classes); S4 migration needs explicit
  user approval (read-time only until then).
- Never touch mobile-nav bottom nav / safe-area; no auth logic; no health-calc semantics;
  no Green-Red polarity changes; `tabular-nums` invariant. Secrets never committed.
- `verification/` and `.superpowers/` stay untracked. Commit only on PASS.
- Exempt from radius sweep: search-field pill (9999px), badge pills (`rounded-4xl`),
  avatar circles. Health hero = sole large-corner card (~28px, `rounded-3xl`).