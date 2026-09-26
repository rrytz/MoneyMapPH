---
name: MoneyMap PH
description: Personal finance management for Filipinos — one private ledger for all your money.
colors:
  # Tide neutrals — wet stone, green-cast, deliberately NOT cream
  tide-paper: "#f1f4f0"
  tide-surface: "#fafbf9"
  tide-inset: "#e8ede7"
  tide-hairline: "#dce3db"
  tide-ink: "#1b211c"
  tide-ink-muted: "#667063"
  tide-ink-faint: "#98a396"
  # Water — chroma encodes the tide. Sulpot is the only saturated phase color.
  sulpot: "#0b8f45"
  sulpot-bright: "#12a85a"
  sulpot-deep: "#076a34"
  sulpot-tint: "#ddf1e3"
  agosto: "#a8ac9e"
  agosto-deep: "#858a7d"
  agosto-tint: "#eaeee9"
  # Semantic — data only, never interactive
  rose: "#e0455b"
  amber: "#c97a0a"
  indigo: "#4b4bc4"
  # Governed category palette (6 tints, no 7th)
  category-water: "#1e5f8c"
  category-channel: "#14496b"
typography:
  identity:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    usage: page H1s, home hero, wordmark, identity moments
  function:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    usage: body, controls, navigation, ordinary UI copy
  section-label:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    usage: uppercase tracked card and section labels
  measurement:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "0.625rem"
    usage: gauge, chart axes, percentages, ratios, counts
  ledger-figure:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: "'tnum'"
    usage: currency and financial answers
  character:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    usage: Filipino character voice only
---

## Typography hierarchy

Type is assigned by meaning before size:

- **Identity** — Bricolage for page H1s, the home hero, and the wordmark
- **Function** — Instrument Sans for body, controls, and navigation
- **Section label** — tracked uppercase Instrument Sans for card/section labels
- **Ledger figure** — tabular Instrument Sans for currency and financial answers
- **Measurement** — Martian Mono for gauge, axes, percentages, ratios, and counts
- **Character** — Bricolage normal case for Filipino character voice only

Currency is never mono merely because it is numeric. Controls and English
functional copy never receive the character voice. The committed typography
conformance test is the enforcement point for these roles.

### The figure boundary

Every currency figure declares its role on the element itself. The rule:

> A figure that competes for attention gets the ledger role; a figure that's
> part of a row or a sentence doesn't.

- `type-ledger` — the answer to the question the surface asks
- `type-measurement` — a dominant %, ratio, or count
- `figure-inline` — an amount inside a row, cell, pill, or sentence

**Currency is never Bricolage.** The identity face is reserved for H1s, the
wordmark, and the character voice. This includes the home hero: it is the
largest *ledger* figure, not an identity moment. A Bricolage peso beside
Instrument peso rows is individually correct per role and still reads as two
different apps on one screen, so the constraint is page-level coherence, not
per-component correctness — money speaks one voice everywhere.

The marker is required rather than inherited. `CurrencyDisplay` sets no
`font-family`, so an un-marked instance silently inherits whatever face its
ancestor happens to set — the same component could render in Instrument Sans in
one row and Bricolage in another. Declaring the role on the element removes the
guesswork. The source detector proves the declaration exists; the runtime probe
proves it resolves to the intended face.

## Navigation and identity mark

- `≥1280px`: full grouped desktop navigation
- `1024–1279px`: compact single row, group labels hidden, horizontal overflow with a visible edge affordance when needed
- `<1024px`: existing bottom navigation

The logo is an unboxed TideMark plus Bricolage wordmark. The old gradient/glow
mark and `Plan • Track • Grow` tagline are retired everywhere: shell, auth,
legal, offline, and print.

# MoneyMap PH — Tide

A personal finance app for Filipinos whose income arrives in **pulses**: a
payday cycle, a 13th-month windfall, an honest mid-month cutoff, and lean
months that are weather rather than failure. No other app models that cycle.
The identity comes from there.

**Tide** is a presence — not a person, not a thing. It reports where the water
is; it does not advise. **It has no face.** Its mark is a tide gauge.

## The governing tests

These are tests, not guidelines. Work that fails them is not done.

1. **The character must be capable of silence.** No idle chatter, no ambient
   motion. The character speaks only on a phase change, a threshold crossing,
   or an invitation (an empty state). One orchestrated motion: payday lands,
   the waterline rises once and settles. `prefers-reduced-motion` gets an
   instant state change.
2. **Agosto must never read as failure.** Lean renders in desaturated stone.
   Rose and amber are *never* in the phase vocabulary. Overspend may render
   rose — but overspend is a **data fact**, not a **phase**. The vocabularies
   are structurally separate.
3. **No surface may imply knowledge it lacks.** A full waterline derived from
   zero transactions would present the absence of data as excellent news. The
   gauge withholds its mark until the water is actually known.

## Light World

MoneyMap PH is **light-first**. Dark is the class-toggle world, reached by
adding `.dark` to `<html>`. A surface is correct only when it renders in both.

Tokens do all the theming — `--paper`, `--surface`, `--inset`, `--hairline`,
`--ink`, `--sulpot`, `--agosto`. Two-world pairs and muted neutrals remain
legal; **unconditional hard-coded neutrals do not.** The detector
(`src/tests/design-conformance.test.ts`, Rule D) treats a raw Tide neutral hex
on a content surface as a violation, because a raw neutral cannot respond to
the world it is rendered in.

## The Tide Gauge

The safe-to-spend cutoff **is** the tide's edge, so the app's most distinctive
computation becomes the identity's instrument.

A graduated horizontal rule: minor graduations, a **waterline** at the
proportional position, and the **cutoff** as an index mark breaking out of the
track on both sides. Phase label in mono: `AGOSTO` / `RISING` / `SULPOT`.

| State | Condition | Waterline | Voice |
|---|---|---|---|
| **UNMEASURED** | No payday configured | none | may invite — the only state where silence reads as broken |
| **AWAITING** | Payday set, zero entries | **none** | **silent** |
| **MEASURED** | Payday set + ≥1 entry | proportional | on phase change only |

The cutoff mark stays quiet in AWAITING on purpose. That state exists to not
lie; boldening it would turn an index into a handle.

## Category Identity

A category is a **monochrome Lucide glyph tinted by its data color** — stroke-2,
16–20px, never a raw emoji. Emoji are legacy *storage* only; every render path
resolves through the read-time map (`src/lib/categories/icon-map.ts`), and an
unmapped or empty value resolves to `Package`. Lookups normalize (strip U+FE0F /
ZWJ / skin-tone modifiers) first, so `🍽️` and `🍽` resolve identically.

Category colors come from a **governed six-tint palette** — sulpot `#0b8f45`,
water `#1e5f8c`, amber `#c97a0a`, rose `#e0455b`, indigo `#4b4bc4`, channel
`#14496b`. Every tint clears **3:1 contrast against `--paper`**, asserted by
test. The neutral slots are water-adjacent rather than stone, because
stone-on-paper fails the contrast floor. Six tints across many categories means
the donut repeats a tint by design; its top-5 legend carries a dot plus the
glyph plus the label, so identity survives.

## Voice

| Layer | Language |
|---|---|
| Character | **Filipino, untranslated** — `Agosto hanggang ika-15.` · `Sulpot na.` |
| Function | **English** — "Add Expense", "Save changes", "Cutoff passed" |

The character never labels a control. The UI never speaks Tagalog. They never
share a string.

## Named Rules

**The Chroma Rule.** Saturation encodes water level. Sulpot is the only
saturated color in the phase vocabulary; as the tide drains, saturation drains
with it. This is why agosto cannot read as failure — it is structural, not
editorial.

**The Light-World Rule.** Every surface and text color resolves through a token
or a two-world pair. Light is the default; dark is the toggle; both must render.

**The Accent Rule.** Sulpot is the only accent on interactive elements. Cyan,
sky, and teal are banned outright. Rose, amber, and indigo are data semantics:
never on buttons, never tinting a tile or chip background.

**The Instrument Rule.** A component may not state what it does not know. The
gauge shows the water only when there is water.

## Do's and Don'ts

- **Do** let saturation carry the tide, and let type carry the register —
  Bricolage for identity, Instrument Sans for function, Martian Mono only where
  a real measurement is shown.
- **Do** keep the character silent when nothing is wrong.
- **Do** render category identity as a monochrome Lucide glyph in a governed
  tint; let the legend's glyph and label disambiguate repeated tints.
- **Do** keep resting surfaces flat with a 1px hairline; raise a card only for
  the Featured hero.
- **Don't** put rose or amber on a phase, ever.
- **Don't** render a raw emoji as category identity, and don't reintroduce a
  free-text emoji or free-color field.
- **Don't** hard-code a neutral hex on a content surface — it cannot theme.
- **Don't** make a full meter out of missing data.

## Radius ladder

`sm 6 / md 8 / lg 12 / xl 16 / 2xl 24 / 3xl 32`. Controls sit at `lg` (12),
cards at `2xl` (24), and the single Featured hero at `3xl` (32).

*Snapshot note: `.impeccable/design.json` is descriptive, not authoritative — if
live code and a snippet disagree, live code wins and the snippet is refreshed
alongside the change.*
