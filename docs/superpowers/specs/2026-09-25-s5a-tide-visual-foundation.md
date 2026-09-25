# S5a — Tide Visual Foundation

Date: 2026-09-25 · Status: **design approved, awaiting spec review**
Builds on: `2026-09-25-s5-shell-composition-design.md` (S5 structure)
Follows: `2026-09-22-emerald-ledger-redesign.md` (master plan)

## Scope

The visual foundation only: **tokens, light-first default, type, surfaces,
elevation, the tide-gauge signature, and the voice split.** S5a is verifiable on
its own through token diffs — it does not restructure the shell or recompose any
page. Shell and composition are **S5b**, which consumes this foundation.

**Identity (inherited, not re-litigated):** Tide. A presence — not a person, not
a thing — with **no face**. The character reports where the water is; it does
not advise. Identity speaks Filipino, untranslated. Function speaks English.

## Governing constraints (these are tests, not guidelines)

**1. The character must be capable of silence.**
No idle chatter. No ambient motion. The character speaks only on a phase
change, a threshold crossing, or an invitation (empty state). One orchestrated
motion exists — payday lands, the waterline rises once and settles.
`prefers-reduced-motion` receives an instant state change with no tween.

**2. Agosto must never read as failure.**
Lean renders in a desaturated stone. Rose and amber are *never* in the phase
vocabulary. Overspend may still render rose — but overspend is a **data fact**,
not a **phase**. The two vocabularies are kept structurally separate so "lean"
can never render in the danger palette.

**3. The system encodes honesty about what it knows.**
No surface may imply knowledge it lacks. A full waterline derived from zero
transactions is a lie, and is therefore not rendered.

## Tokens

### Neutrals — "wet stone" (light world)

Green-cast stone. Deliberately **not cream**: R and B sit within 1 of each
other, where cream is strongly yellow-leaning (R−B ≈ 10). Warmth comes from the
cast and the water greens, not from a tan field.

| Token | Light | Role |
|---|---|---|
| `--paper` | `#F1F4F0` | app background |
| `--surface` | `#FAFBF9` | cards |
| `--surface-raised` | `#FFFFFF` | overlays, popovers |
| `--inset` | `#E8EDE7` | tonal in-card layer |
| `--hairline` | `#DCE3DB` | 1px borders |
| `--ink` | `#1B211C` | primary text (green-black, not blue-black) |
| `--ink-muted` | `#667063` | secondary text |
| `--ink-faint` | `#98A396` | captions |

### Water — the tide

The only saturated colors in the system. `#0B8F45` has G ≫ B, placing it far
from the teal family that Rule A bans.

| Token | Light | Role |
|---|---|---|
| `--sulpot` | `#0B8F45` | high water, funded, money in |
| `--sulpot-bright` | `#12A85A` | the mark's highlight |
| `--sulpot-deep` | `#076A34` | hover / pressed |
| `--sulpot-tint` | `#DDF1E3` | 10% washes |
| `--agosto` | `#A8AC9E` | **low water — desaturated stone, never rose/amber** |
| `--agosto-deep` | `#858A7D` | |
| `--agosto-tint` | `#EAEEE9` | |

**Chroma encodes water level.** Sulpot is the only saturated color in the phase
vocabulary; as the tide drains, saturation drains with it. This is the single
idea the palette hangs on, and it is what makes constraint 2 structural rather
than editorial.

### Semantics (data only — unchanged role, warmed)

| Token | Hex | Role |
|---|---|---|
| `--rose` | `#E0455B` | money out, danger, destructive |
| `--amber` | `#C97A0A` | warning, near-limit |
| `--indigo` | `#4B4BC4` | information |

Never interactive. Never on buttons or tile backgrounds (Rules B, C).

### Dark world

Deep water, not cold slate. The chroma rule holds inverted: sulpot is
brighter and more saturated, agosto stays dim and desaturated.

| Token | Dark |
|---|---|
| `--paper` | `#0E1410` |
| `--surface` | `#141B16` |
| `--inset` | `#1A221C` |
| `--hairline` | `#263029` |
| `--ink` | `#E8EDE7` |
| `--ink-muted` | `#98A396` |
| `--sulpot` | `#17B963` |
| `--agosto` | `#5A6357` |

## Type

| Role | Face | Use |
|---|---|---|
| **Identity / hero** | **Bricolage Grotesque** | hero figures, character voice. Wonky and characterful — chosen *against* the expected high-contrast serif |
| **Function / body** | **Instrument Sans** | all functional copy, 15px, UI labels |
| **Measurement** | **Martian Mono** | **only** gauge graduations, phase labels, the cutoff readout |

The type split mirrors the language split: characterful where identity speaks,
plain where function speaks, mono strictly where a real measurement is shown.
Columnar money figures use Instrument Sans with `font-variant-numeric:
tabular-nums` — mono is **not** sprayed across every peso. Hero figures may use
Bricolage only when solitary (never inside a column).

## Surfaces, elevation, space

- **Light-first.** `defaultTheme="light"`.
- Card: `--surface` on `--paper`, 1px `--hairline`, warm diffuse shadow tinted to
  the green-black: `0 1px 2px rgba(27,33,28,.04), 0 8px 24px -12px rgba(27,33,28,.10)`.
- Radii loosen: control `lg` 12 (was 8), card `2xl` 24 (was 20), hero `3xl` 32
  (was 28), chips pill.
- Space opens up: body 15px (was 14), card padding 24px (was 20), section gap
  32px. **This reverses S1's deliberate density decision** and is called out as
  a known trade: warmth and density pull against each other, and warmth wins.

## Signature — the tide gauge

A graduated horizontal rule carrying the waterline and the cutoff.

```
        ┌─────────── cutoff (notch, deeper tick) ───────────┐
   │    │                                                  │
   │~~~~~~~~~~~~ waterline (sulpot fill) ~~~~~~~~~~~~~~~~~~│
   │    │                                                  │
   └────┴──────────────────────────────────────────────────┘
        AGOSTO                                    SULPOT
```

- Baseline rule with minor graduations (Martian Mono ticks)
- **Waterline** at the proportional position, filled with sulpot
- **Cutoff** as a distinct deeper notch carrying the safe-to-spend figure
- Phase label in Martian Mono: `AGOSTO` / `RISING` / `SULPOT`
- No face anywhere. At 16–24px it reduces to a clean wave-and-line glyph for
  the persistent top-bar readout

The safe-to-spend cutoff *is* the tide's edge, so the app's most distinctive
computation becomes the identity's instrument.

### Gauge states (including empty / first-run)

The gauge is never blank and never lies about what it knows.

| State | Condition | Rendering | Voice |
|---|---|---|---|
| **UNMEASURED** | No payday configured | Rule + graduations in resting treatment (faint). **No notch. No waterline.** | May carry the first-run invitation (Filipino). Only legitimate speaking moment when idle. |
| **AWAITING** | Payday set, zero transactions this cycle | Rule + graduations active. **Cutoff notch present.** **No waterline.** | **Silent.** The instrument exists and the edge is marked; the water simply isn't measured yet. |
| **MEASURED** | Payday set + ≥1 transaction | Full gauge: waterline at proportional position, notch, phase label | Phase label only on a phase change |

**Why AWAITING has no waterline:** with a payday set and zero spending, the
naive computation yields a full safe-to-spend figure. Rendering that as a
maximum waterline would present the absence of data as excellent news. The
gauge withholds the mark until the water is actually known — this is
constraint 3 made visible.

**Why UNMEASURED may speak:** a first-run invitation is a legitimate character
moment (an empty screen is an invitation to act). UNMEASURED is the only state
where silence would read as broken rather than calm.

## Voice split

| Layer | Language | Examples |
|---|---|---|
| Character | **Filipino, untranslated** | `Agosto hanggang ika-15.` · `Sulpot na.` · `May cutoff ka sa Martes.` |
| Function | **English** | "Add Expense", "Save changes", "Cutoff passed" |

The character never labels a control. The UI never speaks Tagalog. The two
never mix in a single string.

---

## Conventions this work inverts or invalidates (tracked as work, not notes)

**1. The gate's evidence convention inverts on the light-flip.**
Currently: `dark` = OS-default (`colorScheme: 'dark'`), `light` = class-toggle
(remove `.dark`). After S5a: **light = OS-default (`colorScheme: 'light'`), dark =
class-toggle (add `.dark`).** Evidence labels become `light` / `dark(toggle)`.
`probe-run.mjs`, `capture-desktop.mjs`, and `capture-mobile.mjs` all encode the
old convention and must be updated **before** S5a's gate runs, not during it.
This must be documented before S5a begins.

**2. Radius change invalidates probe (b) and S1's ladder — together.**
Probe (b) asserts the sole >20.5px card carries `rounded-3xl`, and S1 locked the
radius ladder. The new ladder (12/24/32) must land in `globals.css` **and** the
probe thresholds **in the same change**. A stale probe is worse than no probe:
it will fail the gate for the right reason and be misread as a regression.

**3. DESIGN.md and `.impeccable/design.json` describe the system being replaced —
rewrite, do not patch.**
Both currently describe a cold slate-and-emerald, dark-default, quietly-premium
system. They get rewritten against S5a tokens, not edited. The sidecar's
`colorMeta` tonal ramps are all keyed to the old palette.

## Resolved decisions (approved 2026-09-25)

**R1 — The 6-tint category palette is re-derived inside S5a, not deferred.**
The stone slot fails contrast on paper, so it is **replaced with water-adjacent
hues** that read against the actual `--paper` / `--surface` values. No 7th tint
is added. A quiet category (Miscellaneous) gets the *faintest real hue*, never a
stone.

| Slot | Was | Becomes | Rationale |
|---|---|---|---|
| money in | emerald `#059669` | **`#0B8F45` sulpot** | aligns with the tide vocabulary |
| information | indigo `#4f46e5` | `#4B4BC4` | data semantics, warmed |
| warning | amber `#f59e0b` | `#C97A0A` | data semantics, warmed |
| money out / danger | rose `#f43f5e` | `#E0455B` | data semantics, warmed |
| neutral (mid) | slate `#64748b` | **`#1E5F8C` deep water** | reads on paper; water-adjacent |
| neutral (quiet) | slate-deep `#334155` | **`#14496B` channel** | faintest real hue, for Miscellaneous |

Both new neutrals are deep desaturated blues — **not** teal or sky, and outside
Rule A's banned family. Contrast against `--paper` (`#F1F4F0`) and `--surface`
(`#FAFBF9`) is verified as part of implementation, not assumed.

**R2 — Rule D revision is verified against a real bypass before it ships.**
A guard that passes on both correct code and a violation is worse than no guard,
because it reports OK while protecting nothing. Implementation must: re-ground
Rule D on the wet-stone family, **temporarily hard-code a wet-stone dark value
(`#1B211C`) in a source file, confirm the detector goes RED, then remove it.**
Red-before-green is required; a rule that has never been seen to fail has not
been tested.

**R3 — Density loosening applies to S5a, with two surfaces re-checked later.**
S1's density was a fintech-aesthetic choice, not a use requirement, so the
loosening stands. **The transaction list and the expense log are flagged for a
real-device scanability re-check after S5b.** If loosened density measurably
hurts scanning there, those two surfaces stay tighter — density is not required
to be uniform.

## Detector review (Rules A–E)

| Rule | Status |
|---|---|
| A — cyan/sky/teal ban | **Unchanged.** The new palette is explicitly teal-free by construction |
| B — rose never fills a button | **Unchanged** |
| C — amber/indigo never tint a tile | **Unchanged** |
| D — no unconditional dark hard codes | **REVISION REQUIRED.** The rule is tied to the *slate* family, which is legacy. A bypass written in the new wet-stone neutrals (`#1B211C`, `#263029`, …) would pass undetected. The rule must be re-grounded on the new neutral family — otherwise the light-world governance added in S3 silently stops covering |
| E — Lucide identity, no emoji, no free inputs | **Unchanged** |

## Open item for S5a decision

The **6-tint governed category palette** (S4) is token-derived and its tokens
are changing. It currently resolves to emerald / indigo / amber / rose / slate /
slate-deep. Under Tide, `emerald → sulpot` and `slate`/`slate-deep` must become
stone neutrals — but a category's *data* color must stay distinguishable, and
stone on paper is very low contrast. **This needs an explicit decision before
S5a lands**, not a silent re-derivation.

→ **RESOLVED — see R1 above.** The stone slots are replaced with water-adjacent
hues (`#1E5F8C`, `#14496B`), no 7th tint added.

## Acceptance (token-verifiable, no shell changes)

- `--paper` light value is `#F1F4F0` and is **not** cream (R−B within 1)
- `--agosto` is desaturated and is not within any rose/amber hue
- `--sulpot` is green, not teal (G−B > 60)
- All three gauge states render, including UNMEASURED and AWAITING with no waterline
- No gauge state renders a waterline without a payday **and** ≥1 transaction
- Reduced-motion produces an instant state change
- Filipino strings and English strings never share one string
- Probe (b) and the radius ladder change in the same commit
- Detector Rule D re-grounded on the new neutral family
