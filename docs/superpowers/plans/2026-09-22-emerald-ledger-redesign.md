# Emerald Ledger Redesign — Six-Direction De-template Pass

Date: 2026-09-22 · Status: Approved direction, awaiting plan review → slice execution

## Goal

Kill the "generic AI slop" read on all four surfaces (Dashboard, Expenses, Accounts,
Settings) on desktop and installed-PWA mobile, without losing the documented
Emerald Ledger voice. All six approved directions are one coherent system change,
executed as four slices with a hard ship gate per slice: **desktop + installed-PWA
mobile before/after screenshots, side by side, per surface.**

The baseline diagnosis (already verified, don't re-litigate): five accents on one
dashboard (emerald/rose/amber/indigo/cyan), one `FintechCard` rendering every card
(identical `rounded-2xl border shadow-sm hover:shadow-md p-5`), a radius ladder
with nothing below 9.6px, everything-bold type (`tracking-tight font-bold` at every
level), free-text emoji + raw hex in category data, and a light theme that exists
in code but is undocumented and bypassed by hard slate values.

## Approved directions (user-selected, all six, with sequencing)

1. **Card variants** (structural core): `Surface` / `Featured` / `Inset` instead of
   one card clone. Savings Rate metric collision deduped.
2. **Radius sharp rail** (token layer): small 6–8px rail for chips/inputs/buttons;
   containers 16–20px; hero/sheets keep the large corner. Pure tokens.
3. **Accent enforcement** (discipline): emerald = only interactive accent; rose =
   expense data semantics only (never buttons); amber/indigo = chart-series data
   colors only (no background chips); cyan removed from UI. Plus a conformance
   detector so it can't regress.
4. **Type hierarchy** (three anchors): Ledger Figure / Section Head / Caption;
   labels lose bold; uniform figure sizes per role.
5. **Emoji migration** (data + UI, needs its own pre-approval): Lucide icon system,
   emoji→icon mapping, governed icon picker + constrained palette in Settings.
6. **Light-world governance** (theme completeness): document the light token set +
   policy in DESIGN.md; fix hard-slate token bypasses so light is first-class.

User's slice contract: **each slice verified + committed separately**, screenshots
gate per slice, and slice 4 (emoji) requires explicit approval of the icon set and
palette constraints *before* the migration runs.

## Global constraints

- Stay inside the documented system: emerald → one accent; rose for money-out;
  slate does the talking. The Green-Red polarity is invariant, light and dark.
- Tabular numerals on every money/percent figure — invariant, never touched.
- Flat-by-default with hairline rings; overlay-only shadows. Allowed change:
  the Radius Ladder and card-dialect sections in DESIGN.md (user flagged these as
  fair game). The "one elevated Featured card" concept extends flat-by-default
  policy but keeps `shadow-sm→md` as the only resting elevation.
- Do NOT touch: bottom nav + safe-area (`mobile-nav.tsx:35`,
  `env(safe-area-inset-*)` in topbar/shell), auth flow logic, data model semantics,
  the Financial Health *calculation* (score breakdown must stay numerically
  identical — only labels/rendering change).
- The Financial Health hero remains the one large-radius, elevated signature element.
- Secrets/session: never printed, logged, or committed. Screenshots are
  user-facing + ship-gate artifacts only.
- Rings/controls stay dense: 32px control height, 14px body, 3px focus rings.
- **Theme policy (locked 2026-09-22, user): system-following.** Both light and
  dark are shipping surfaces (`theme-provider.tsx` defaults `"system"`; Settings
  offers light/dark/system). Consequence for gates: every slice verifies **dark
  AND light** — 4 surfaces × {desktop, mobile} × {dark, light} = **16 shots**.
- Verify per slice: `impeccable.cmd detect --json <targets>` + DOM probe asserts +
  desktop/PWA-mobile screenshots (dark + light). Update DESIGN.md +
  `.impeccable/design.json` wherever a rule changes (flag each).

## File structure map

| File | Responsibility | Change |
|---|---|---|
| `src/app/globals.css` | Normative tokens: radius ladder, font tokens | Radius factors rewritten; new token utilities if needed |
| `src/components/ui/fintech-card.tsx` | The single card component | Split into `Surface`/`Featured`/`Inset` variants (prop-driven) |
| `src/components/dashboard/health-hero-card.tsx` | Financial Health hero | → Featured; 4 sub-boxes → Inset; sub-metric labels deduped |
| `src/components/dashboard/kpi-card.tsx` | KPI cards | Neutral/emerald-only icon tiles; unified figure size; area-variant sweep |
| `src/lib/utils/financial-health.ts` (or new `health-breakdown.ts`) | Shared derivation | One source of truth for hero sub-metrics + savings-rate figure |
| `src/app/(dashboard)/accounts/**` | Accounts surface | Cyan→emerald; hard `slate-900` bypasses → tokens (light-world) |
| `src/app/(dashboard)/expenses/**` | Expenses surface | Rose primary button → emerald; rose kept as data semantics only |
| `src/app/(dashboard)/settings/settings-client.tsx` | Category editor | Free-text emoji + hex → governed icon picker + palette (slice 4) |
| `src/lib/categories/icon-map.ts` (new) | Emoji→Lucide mapping + fallback | Pure logic, unit-tested |
| `src/components/categories/category-icon.tsx` (new) | Render layer | Lucide stroke-2 monochrome, tinted by category color |
| `src/tests/design-conformance.test.ts` (new) | Accent/bypass detector | Vitest scan of `src/**/*.tsx` — regression guard |
| `DESIGN.md` | The documented system | Radius Ladder, card dialects, Typography anchors, light-world section |
| `.impeccable/design.json` | Render-ready snippets | Refresh to match live code per slice |

## Seed data facts (needed by slice 4)

Default categories come from `supabase/migrations/001_initial_schema.sql:319-330`
and `008_bills_schema.sql:157-168` (identical), one row per new user:

Transportation 🚗 / Groceries 🛒 / Supplements 💊 / Eating Out 🍽️ / Utilities 💡 /
Rent 🏠 / Internet 📡 / Savings 💰 / Emergency Fund 🛡️ / Motorcycle Fund 🏍️ /
Miscellaneous 📦 — with raw hex colors from `#6366f1` (indigo) down to `#64748b`.

Observed user-row emoji (live DB, from diagnosis): 🚌 🛒 🧪 💡 🏦 📦 🍽️ 💰.

⚠️ Seed colors include **cyan** (`#06b6d4` Emergency Fund, `#0ea5e9` Motorcycle
Fund). **DECIDED (2026-09-22, user): absolute cyan ban, no grandfathering — both
remapped to documented tints at render.** Proposed tints (land in the S4 palette
gate for sign-off): Emergency Fund → **indigo** `#4f46e5` (receipt-indigo —
savings-adjacent, matches DESIGN.md's indigo = savings role); Motorcycle Fund →
**amber** `#f59e0b` (late-fee) as data-identity only (legend dot / chart series,
never interactive).

---

# Tasks

## Task 0 — Capture infrastructure (session + probe + shot workflow)

**Why first:** every slice's gate is a screenshot pair. The harness browser is
proven (probe + screenshot work) but **no authenticated session exists yet**.
Desktop captures land dark (harness reports `prefers-color-scheme: dark`); the
light world must be probed by toggling `document.documentElement.classList`.

Steps:
1. User signs in on the harness tab (their credentials, their hands) → verify
   `/dashboard` returns 200 with authenticated shell (probe for the cookie
   `sb-jaaeeyeyidvekzdssqfv-auth-token` present, or just body text assert).

   **Cookie bridge (self-served capture-auth — sanctioned, not tribal
   knowledge).** The Playwright capture scripts read `document.cookie` from
   `%TEMP%\mm-capture-cookie.txt`, which a tiny local bridge fills on the
   harness page's behalf:

   1. User signs in at `http://localhost:3000/login` on the harness browser
      (their credentials, their hands — never automated, never echoed).
   2. Start the bridge in the background:
      `node verification/screenshot-prep/cookie-bridge.mjs` (serves
      `http://127.0.0.1:8787/cookie`).
   3. The capture script's first step runs inside the authenticated tab and
      POSTs `document.cookie` to the bridge URL; the bridge appends it to the
      temp file, and the script deletes the file after capture. Cookie values
      and secrets never enter the conversation or the repo — shapes only.

   Knowns (locked, don't re-litigate): a dev-server restart invalidates
   Supabase sessions, so re-auth on the harness browser is the sanctioned fix
   (never hack auth, never force the gate). `document.cookie` is readable in a
   fresh post-re-auth session — the earlier "HttpOnly denied" finding was a
   stale pre-re-auth session state, not a permanent restriction.
2. Confirm viewport choreography: widen for desktop pass; user resizes the
   browser window to ~390px for the mobile pass (in-harness resize params are
   silently ignored — the physical window is the only control).
3. Extend `verification/screenshot-prep/probe-dom.js` with **assert helpers** for
   the four probes every slice runs:
   - radius survey (max radius on controls ≤ 8px; cards 16–20px; hero sole large)
   - accent survey (no cyan anywhere; emerald = all interactive primaries;
     rose/amber/indigo only as data/text, never button fills)
   - type anchors (figure size uniform per role; labels not bold;
     card/dialog titles use `font-heading`)
   - emoji scan (zero raw emoji rendered inside category surfaces after slice 4)
4. Capture the **baseline 16 shots** (4 pages × desktop/mobile × dark/light;
   light via `document.documentElement.classList` toggle) into
   `verification/screenshot-prep/shots/baseline/` for the before column.
   - **Evidence labeling (locked 2026-09-22):** light-mode captures verify that
     **tokens render correctly in light** (class-toggle proof). They do **not**
     verify system-detection (`matchMedia` → `prefers-color-scheme`) — that path
     is code-read only (`theme-provider.tsx:32-33`). Every shot set is labeled
     `dark` / `light(toggle)`; no light claim in evidence or DESIGN.md implies
     system-detection was exercised.
5. Commit: infra + baselines under `verification/` **stay untracked** (standing
   carve-out — do not commit session artifacts).

**Gate:** user confirms the harness is signed in and both viewports capture clean.

---

## Task 1 — Slice 1: Radius sharp rail + Type anchors (pure tokens)

No component rewrites — token ladder + the three type anchors, applied where the
old four-six levels were.

### 1a. Radius ladder (globals.css + DESIGN.md + design.json)

Replace the factor set in `globals.css` `@theme inline` (keep the `--radius`
base = 1rem so the "real token math" property survives):

```
sm: calc(var(--radius) * 0.375)   → 6px    (rail: chips, tags, tiny controls)
md: calc(var(--radius) * 0.5)     → 8px    (controls: inputs, buttons)
lg: calc(var(--radius) * 0.75)    → 12px   (large controls, list rows, insets)
xl: calc(var(--radius) * 1)       → 16px   (structural cards — Surface)
2xl: calc(var(--radius) * 1.25)   → 20px   (Featured cards)
3xl: calc(var(--radius) * 1.75)   → 28px   (sheets, hero, auth panel)
```

**DESIGN.md rule change (flag):** the `rounded:` frontmatter block + **The Radius
Ladder Rule** rewrite — small rail for controls, structural 16, summary 20, hero
28. Search-field pill (9999px) and badge pills stay exempt.

Sweep: chip/badge/input/button classes currently `rounded-xl`+ become `md`-rail;
card surfaces that shouldn't be 2xl settle at `xl`/`2xl` per new roles. Use
`impeccable detect` + probe radius survey to find stragglers.

### 1b. Type anchors (globals.css utilities + surface sweep)

Declare three anchored utilities (or class maps in DESIGN.md/design.json):

- **Ledger Figure** — `text-[2rem] sm:text-[2.5rem] font-semibold tabular-nums
  tracking-tight` (the one biggest number per screen; KPI values unify to one
  size, currently mixed 24/30/36px).
- **Section Head** — `text-lg font-medium` (`font-heading` Sora for card/dialog
  titles per Sora-Lanes; generic page headers stay Inter per DESIGN.md).
- **Caption** — `text-xs uppercase tracking-wide text-muted-foreground font-normal`
  (labels/chips lose bold; muted captions).

**DESIGN.md rule change (flag):** Typography `Hierarchy` section re-rolled to the
three anchors; Label/Body keep their sizes but the "500 semibold" label voice
drops to normal-weight uppercase captions. DESIGN.md "Character" and Sora-Lanes
rules unchanged apart from the anchor names.

Sweep targets (from diagnosis, exhaustive via detector + probe): KPI labels &
values, expense-row labels, settings section labels, account-summary labels.

**Tests:** probe-assert: (a) every `button`/`input`/`select` radius ≤ 8px,
(b) cards 16–20px, (c) KPI figures share one computed size on a given surface,
(d) no bold on label classes.

**Commit** `S1 tokens: radius sharp rail + type anchors` — with `.impeccable/design.json` refresh.

**Gate:** 16 shots (4 surfaces × desktop/mobile × dark/light) vs baseline +
detector + probes pass. DESIGN.md flagged diff.

**GREEN (2026-09-22):** probes (a)–(d) PASS on all 16 configs
(`probes/probes-2026-09-22T05-22-27-346Z.json`; (b) hero rad 28 pad 20 with
literal `rounded-3xl` sole large card; (c) uniform figure sizes [40] desktop /
[32] mobile); `impeccable detect` exit 0 on all 23 swept files (advisory type-ramp
notes only); after-column 16 shots in `verification/screenshot-prep/shots/after/`
vs `shots/baseline/`. Committed `838eb18`. Reviewed by committer — PASS.

---

## Task 2 — Slice 2: Card variants + metric dedupe (structural core)

### 2a. `FintechCard` → three variants (prop-driven, same file)

Change `fintech-card.tsx` so existing callers keep working (default = `Surface`):

- **Surface** (default): `rounded-xl border border-border bg-card` — flat, no
  shadow. The workhorse: KPI cards, account cards, settings tiles, list panels.
- **Featured**: the Financial Health hero only — `rounded-2xl` + the previous
  `shadow-sm hover:shadow-md` treatment. Sole resting elevation in the product.
- **Inset**: `rounded-lg bg-muted/30 border-transparent p-4` — boxed content
  **inside** a card; no border/shadow of its own, flat tonal layer only.

Direct targets:
- `health-hero-card.tsx:15-16` → `Featured`; the four sub-boxes
  (`health-hero-card.tsx:64-97`, currently `rounded-xl border bg-slate-50
  dark:bg-slate-900`) → `Inset` — kills the card-in-card-in-card nesting tell.
- All other `FintechCard` callers → default `Surface` (flat, hairline only).

### 2b. Savings Rate collision dedupe

Current: KpiCard "Savings Rate" (raw rate %) at `dashboard/page.tsx:141-149` vs
hero sub-card "Savings Rate" (`health-hero-card.tsx:71-73`, the
`score/30` numerator) — same label, two different numbers.

Fix: extract one shared derivation helper (`health-breakdown.ts`) used by both;
rename the hero sub-metric to **"Savings Score"** (+ "Budget Score", "Paycheck
Score", "Emergency Score" for its siblings) so labels can't collide. Raw %
stays the KPI card. Health *calculation* unchanged — labels/rendering only.

**Tests:** unit test for the helper asserting the score-component labels render
the same numbers as before (pure function, deterministic).

**Commit** `S2 cards: Surface/Featured/Inset + metric dedupe`.

**Gate:** 16 shots (card-in-card tell gone; hero visibly the one featured
element; verified in both themes) + `impeccable detect` + probes. DESIGN.md: card dialect section rewritten
(two dialects → three variants), elevation section gains the "Featured = the one
raised card" line.

**GREEN (2026-09-24):** 16 DOM probes ALL-PASS on all 16 configs
(`probes/probes-2026-09-24T01-57-31-346Z.json`, probes (a)–(d); hero the sole
>20.5px card with `rounded-3xl`), `impeccable detect` exit 0 (4 advisory
type-ramp notes only), vitest 3/3, after-column 16 shots re-captured signed-in
09:57 vs baseline. Committed `53f453d`. Reviewed by committer — PASS.

**Carryover flags → Slice 3 targets (not claimed fixed in S2):**
- Legacy `shadow-sm` on `account-card.tsx:42` and `pay-strip.tsx:45` — Slice 3
  flatten (Featured = the only resting elevation; these are Surface-grade).
- Accounts family hard slate + cyan — whole family (`accounts-client`,
  `account-card`, `account-modal`, `transfer-modal`, `transfer-list`,
  `account-select`) is Slice 3 (3a cyan→emerald, 3b slate→tokens).

---

## Task 3 — Slice 3: Accent enforcement + light-world governance (with detector)

### 3a. Accent sweep (code, per approved directions)

- **Accounts** (`accounts-client.tsx` + related): cyan (`bg-cyan-600`,
  `text-cyan-400`, chips, icon tiles) → emerald tokens. Every cyan class used for
  interactive/summary elements is gone.
- **Expenses** (`expenses-page-client.tsx`): "Add Expense" primary button
  `bg-rose-600` → emerald primary (rose never fills a button — data semantics
  only: amounts, negative deltas, error text stay rose).
- **Dashboard KPI chips** (`kpi-card.tsx` amber/indigo tiles): non-emerald
  background tiles → neutral muted tile (`bg-muted`) with the semantic color in
  the icon/text only where the value is rose (expense) — or fully neutral.
- **Default category color** in Settings: `#6366f1` (indigo) default → a
  documented palette default (see slice 4 palette).

### 3b. Light-world governance

- **Fix bypasses:** Accounts `bg-slate-900/80 text-slate-100` hard values
  (`accounts-client.tsx:112/119/128/144`) → token classes
  (`bg-card text-card-foreground` + dark variants) so light mode renders as
  designed. Same audit for any other raw slate hex in `src/**`.
- **DESIGN.md new section:** document the light token set (already real in
  `globals.css:51-118`) — `:root` = Paper White / Ledger Slate 50 field,
  emerald-600 primary; `.dark` = Ledger Slate 950 field, emerald-500 primary.
  **Policy line (locked, user-approved 2026-09-22): system-following.** The
  shipped default is `theme: "system"` (`theme-provider.tsx:23`, override in
  Settings via the `moneymap-theme` key), **not dark-canonical** — forcing dark
  would contradict the shipped mechanism and the Settings UI that already exposes
  light/dark/system. Both worlds are first-class and documented; no forced dark.
  Screening consequence: later slice gates show both themes.
- **DESIGN.md rule change (flag):** add **The Light-World Rule** — a surface's
  resting colors come from tokens, never raw slate; every interactive accent is
  emerald in both themes.

### 3c. Conformance detector (regression guard)

New `src/tests/design-conformance.test.ts` (Vitest, reads `src/**/*.tsx`):
- Rule A: no `cyan-*` class in any file (absolute ban).
- Rule B: no `rose-600`/`bg-rose-*` on `button`/`Button` fills; rose allowed in
  text/delta/data contexts only (`text-rose-*`).
- Rule C: `bg-amber-*`/`bg-indigo-*` background classes banned on KPI/chip tiles
  (amber/indigo allowed as chart-series + text-only info labels).
- Rule D: raw `slate-900`/`slate-950` hex classes banned on content surfaces
  (tokens only) — kills the light-theme bypass class of bug.
- Rule E (additive with slice 4): `expense_categories` editor no longer emits a
  free-text emoji input.

Sweeper: keep the rule set the *definition* of the sweep — detector violations
enumerate every straggler.

**Tests:** the conformance test itself + a light-mode DOM probe (toggle
`document.documentElement.classList` off `.dark` in harness, assert Accounts
cards computed bg = paper/token, not dark slate).

**Commit** `S3 accent enforcement + light-world + conformance detector`.

**Gate:** 16 shots (dark AND light via the class toggle — every surface must
pass the accent survey in both themes), detector green, DESIGN.md diff. Detector
file stays a real repo test (regression guard), unlike the untracked capture
tooling.

---

## Task 4 — Slice 4: Emoji → Lucide icon system (pre-approval gate)

**Stops for approval before any code:** (a) the icon set = Lucide stroke-2
(already a dependency; nav uses it) with the mapping table below; (b) the
governed palette = six documented tints; (c) the Emergency Fund / Motorcycle Fund
cyan remap (see decision in "Seed data facts").

### 4a. Mapping table (`src/lib/categories/icon-map.ts` + unit tests)

| Emoji | Lucide icon | Seed? |
|---|---|---|
| 🚗 / 🚌 | `Car` / `Bus` | seed + user |
| 🛒 | `ShoppingCart` | both |
| 💊 | `Pill` | seed |
| 🍽️ | `Utensils` | both |
| 💡 | `Lightbulb` | both |
| 🏠 | `House` | seed |
| 📡 | `Antenna` | seed |
| 💰 | `HandCoins` | both |
| 🛡️ | `ShieldCheck` | seed |
| 🏍️ | `Bike` | seed |
| 📦 | `Package` | both + **fallback** |
| 🧪 | `FlaskConical` | user |
| 🏦 | `Landmark` | user |
| *unknown/unmapped emoji* | `Package` (defined, never blank) | — |

**Fallback contract (defined, user-confirmed 2026-09-22):** every render path
resolves the raw `icon` string through `icon-map.ts`; any emoji absent from the
table (or an empty/null icon) renders **`Package`** — the render layer never
emits an empty slot, a crash, or a raw emoji text node. `CategoryIcon` defaults
to `Package` at the component boundary as the last line of defense, independent
of the lookup table.

**Migration strategy (read-time, non-destructive):** existing rows keep their
legacy `icon` text; every render resolves through `icon-map.ts` with `Package`
fallback. No destructive DB write on existing rows. The **governed picker**
writes the canonical Lucide key going forward (Settings writes `icon` =
lucide name — the storage shape is single-text-column, so the key replaces the
emoji text on save without a schema migration; unpickable legacy values just
resolve to `Package`).

**Confirmed (user 2026-09-22): read-time only.** No destructive or schema write
on existing rows; the stored emoji string is untouched until a user explicitly
saves a new picker choice in Settings. Reverting = restore the previous mapping/
resolution (or previous `icon` string) — old rendering is fully recoverable with
zero data operations.

### 4b. Governed palette

Six tints derived from documented colors: emerald, rose, amber, indigo (kept as
chart-series/data identity), ledger slate, paper/muted. Settings color editor
becomes a 6-swatch picker; saving writes the canonical token-derived hex. The
cyan seed hexes are remapped at render via a seed-override entry in `icon-map.ts`
(or a small color-map companion) — same read-time, non-destructive approach.

### 4c. Render layer + Settings UI

- `category-icon.tsx`: Lucide stroke-2, 16–20px, monochrome stroke in category
  color (data identity) — replaces every `<span>{category.icon}</span>` surface:
  settings list, category donut legend, summary rows, budgets, expense form,
  transactions list.
- `settings-client.tsx`: replace free-text emoji input + raw hex color input with
  the icon picker grid (all mapped Lucide icons, single-select, current selection
  highlighted with emerald ring) + 6-swatch palette.

**Tests:** icon-map unit tests (every seed emoji maps correctly; unknown/empty →
`Package`); category-icon renders a Lucide SVG, not an emoji text node.
Conformance Rule E extended: free-text emoji input gone.

**Commit** `S4 icons: Lucide category system + governed picker` (+ DESIGN.md:
Components/Charts gain the "category icons are monochrome Lucide, tinted by data
color" line; the cyan ban note).

**Gate:** 16 shots with zero emoji visible (both themes) + Settings picker/left +
the cyan remap visible; detector green; user's installed-PWA check.

---

## Final — ship gate (applies to the last commit)

- All four surfaces × desktop + installed-PWA mobile, dark + light, before/after
  pairs present in `verification/screenshot-prep/shots/`.
- `impeccable detect` + DOM probes green; conformance test green.
- DESIGN.md + `.impeccable/design.json` reflect the post-pass system (radius
  ladder, card variants, type anchors, light world, icon system).
- No session artifacts committed; `verification/` remains untracked.

## Review focus (what I'll self-audit against)

1. Light/dark contrast of emerald + rose after the sweep (rose-500 on white is
   3.3:1 — non-text OK; any rose *text* must step to rose-700/deep in light).
2. The Financial Health score must render the exact same numbers after dedupe —
   only labels change.
3. Detector false positives: amber/indigo legitimately live in charts and
   info-badges — rules scope to interactive/chip contexts, not data.
4. Unknown user emoji anywhere (settings, donut, budgets, transactions) →
   `Package` fallback, never a blank.
5. Bottom nav + safe-area untouched across all sweeps.