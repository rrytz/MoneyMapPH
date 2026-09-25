# Task 1 — Slice 1: Radius sharp rail + Type anchors (pure tokens)

Brief = verbatim text of "Task 1" section, `docs/superpowers/plans/2026-09-22-emerald-ledger-redesign.md` lines 145–199.

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