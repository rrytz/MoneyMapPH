# S5c — Typography Hierarchy & Identity Mark

Date: 2026-09-25 · Status: **draft for human approval**
Scope: system-level typography enforcement, navigation treatment, measurement voice, and the S5 identity mark.

## Decision summary

S5c is not a page-by-page typography patch. The three voices already exist in
fonts and tokens, but composition does not consistently assign them by meaning.
The fix is a semantic role layer with a red-first detector and a complete sweep
of the application surfaces.

The key rule is:

> **Semantic separation, not merely different font sizes.**

A label does not receive a voice because it is small or bold. It receives a voice
because it is navigation, a section label, a ledger figure, a measurement, an
identity moment, or a character utterance.

## Typography contract

### Six roles

| Role | Face / treatment | Permitted use |
|---|---|---|
| **Identity** | Bricolage Grotesque, semibold, tight tracking | Page H1s, the home hero figure, wordmark, and identity moments |
| **Function** | Instrument Sans, regular/medium | Body copy, controls, navigation links, ordinary UI copy |
| **Section label** | Instrument Sans, uppercase, tracked, semibold | Card and section labels; stronger than navigation |
| **Ledger figure** | Instrument Sans, tabular numerals, semibold | Currency and ordinary financial figures; never mono merely because it is numeric |
| **Measurement** | Martian Mono, tabular | Gauge, chart axes/ticks, percentages, ratios, counts, and other actual measurements |
| **Character** | Bricolage Grotesque, normal case, semibold | Filipino character voice only; never controls or English functional copy |

The implementation will expose named role classes rather than relying on
page-local Tailwind utilities:

```text
.type-page-title
.type-nav
.type-nav-group
.type-section-label
.type-ledger
.type-measurement
.type-character
```

Sizes follow the role. They do not define the role.

### Required scale relationships

- `.type-page-title` is the page-level identity voice and is the only H1 role.
- The home hero figure is the only identity-sized financial figure.
- Page-dominant financial figures use the ledger family at a deliberate larger
  step; supporting ledger figures use the canonical ledger step.
- Counts, percentages, chart ticks, and ratios use the measurement role even
  when they are visually small.
- Currency remains Instrument Sans with tabular numerals. It is never switched
  to mono solely because it is numeric.
- Character voice is normal-case Bricolage and is structurally separate from
  the English functional UI.

## Navigation layout decision

The typography change does not leave the existing nav fragility unnamed.

| Viewport | Treatment |
|---|---|
| `≥1280px` | Full grouped navigation: group labels plus all nine destinations in one row |
| `1024–1279px` | Compact navigation: all nine destinations remain available, group labels are hidden, and the row may scroll horizontally as a safety fallback; it never wraps. A visible right-edge fade/scroll affordance makes the overflow discoverable, and a 1100px probe must reach all nine destinations. |
| `<1024px` | Existing bottom navigation remains the sole primary navigation; desktop nav is hidden |

This slice does not introduce a new More surface at the narrow desktop width.
The existing bottom-nav / More behavior below `lg` is preserved.

## Component enforcement points

- `PageHeader` owns the page-title role and applies Bricolage to every page H1.
- The hand-written Accounts H1 is migrated to the same page-title contract.
- `DesktopNav` uses the quiet function/nav roles; it must not use the tracked
  uppercase section-label treatment.
- `KpiCard`, the balance block, accounts, transactions, and recomposed sub-pages
  use the canonical ledger role for financial figures.
- TideGauge, chart axes/ticks, percentage readouts, ratios, and count readouts
  use the measurement role.
- Filipino character lines use `.type-character`.
- Existing raw `caption` usage is migrated to `.type-section-label`; the old
  shared class must not remain as an escape hatch.

## Detector contract

The detector is written first against the current tree and must fail before
migration. It then becomes the regression contract for all future pages.

The S5c detector asserts:

1. Every application `<h1>` carries the identity/page-title role.
2. `PageHeader` retains that contract and cannot regress to generic bold sans.
3. Desktop navigation does not use uppercase/tracked section-label styling.
4. Raw `caption` usage is rejected after the role migration.
5. Known financial figure/card surfaces use the ledger role rather than
   arbitrary page-local figure classes.
6. Known measurement surfaces use the measurement role.
7. The logo contract has no old gradient/glow SVG and no tagline prop/callers.

The detector is intentionally semantic: it checks named roles and the shared
component contracts rather than trying to infer every visual relationship from
fragile font-size regexes.

A runtime DOM probe may additionally verify that the page H1 computes to the
Bricolage family and that navigation labels do not compute to uppercase. The
source detector remains the primary enforcement mechanism because it catches
composition drift before the page is rendered.

## Identity mark decision

The old `logo.tsx` SVG is pre-S5 identity: gradient ribbon, glow, embedded bar
chart, and optional `Plan • Track • Grow` tagline. It is replaced by:

- the unboxed TideMark;
- a Bricolage wordmark;
- no tagline;
- no `showTagline` prop or callers;
- existing size/tone flexibility where useful.

Auth, legal, offline, and print surfaces are updated because the old mark is
not limited to the dashboard shell. The tagline dies **everywhere** — topbar,
auth, legal, offline, and print — because it is pre-Tide branding and would
create inconsistent branding if it survived outside the shell.

## Migration scope

The sweep covers:

- all ten dashboard routes/surfaces;
- shared page headers, nav, cards, charts, tables, and measurement labels;
- auth, recovery, legal, offline, and print H1/logo surfaces where the shared
  contract applies;
- `globals.css`, `DESIGN.md`, and the design sidecar documentation;
- the committed conformance detector and focused typography tests.

The migration is semantic and mechanical after the red detector exists. No new
business behavior is introduced.

## Acceptance criteria

- S5c detector is observed failing on the pre-migration tree for the expected
  typography/logo violations.
- All application H1s render in Bricolage.
- Nav is visibly quieter than section labels and does not wrap at desktop
  widths.
- Currency, percentages, counts, chart axes, and character copy each use the
  correct semantic voice.
- The old logo/tagline contract is absent.
- `npm test`, `npx tsc --noEmit`, detector, runtime probe, and the combined
  screenshot matrix are green.
- Real-device review confirms mobile hierarchy and the nav behavior at the
  named widths.
- Commit only after the full gate passes.

## Non-goals

- No new bottom-nav destinations or More architecture.
- No change to business calculations or financial semantics.
- No change to the approved Tide color, radius, spacing, or surface-elevation
  contracts.
- No mascot face or character illustration.
