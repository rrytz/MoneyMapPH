# S5c Typography Hierarchy & Identity Mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the six-role Tide typography contract across every MoneyMap PH surface, replace the pre-S5 logo, and make typography/nav regressions fail through a red-first detector.

**Architecture:** Add named CSS role classes backed by the existing Instrument Sans, Bricolage Grotesque, and Martian Mono variables. Shared components (`PageHeader`, `DesktopNav`, cards, charts, tables, and `Logo`) own the role assignment; page files consume the shared roles instead of re-declaring visual intent. A committed source detector plus runtime DOM probes enforce the contract before the screenshot matrix.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, TypeScript, Vitest, Playwright, Impeccable detector.

**Spec:** `docs/superpowers/specs/2026-09-25-s5c-typography-hierarchy-design.md`

## Global Constraints

- Preserve the approved Tide color, radius, spacing, and surface-elevation contracts.
- Cyan, sky, and teal remain banned; sulpot remains the only interactive accent; rose/amber/indigo remain data semantics.
- Do not introduce a new More surface or alter the existing `<1024px` bottom navigation.
- At `1024–1279px`, keep all nine desktop destinations reachable, never wrap, and show a visible overflow affordance when the row scrolls.
- Currency remains Instrument Sans with tabular numerals; measurement surfaces use Martian Mono.
- Filipino character copy is the only `.type-character` surface and must never label controls.
- The old logo gradient/glow SVG and `Plan • Track • Grow` tagline are removed everywhere: shell, auth, legal, offline, and print.
- The detector must be written and observed failing before the migration is implemented.
- Verification remains untracked unless explicitly promoted; source, detector tests, and approved documentation are committed.
- Commit only after tests, TypeScript, detector, runtime probes, and the screenshot matrix are green.

## Review Focus

- **1100px navigation:** all nine destinations are reachable without wrapping, and overflow is visibly discoverable.
- **H1 loading:** every application H1 computes to Bricolage rather than falling back to the body sans.
- **Currency correctness:** the S5c type sweep does not break the signed negative-value fix.
- **Role separation:** currency does not become mono; percentages/counts/axes do not remain body sans.
- **Brand consistency:** no surface retains the old tagline or gradient/glow logo.

---

### Task 1: Add the red-first typography and logo detector

**Files:**
- Create: `src/tests/typography-conformance.test.ts`
- Modify: `src/tests/design-conformance.test.ts` only if shared scanner helpers need extraction; do not duplicate the existing color detector.

**Interfaces:**
- Consumes: all `src/**/*.tsx` source files and the named role contract from the spec.
- Produces: a committed detector test that fails on the current pre-S5c tree and passes only after the semantic migration.

- [ ] **Step 1: Write the failing detector**

Create `src/tests/typography-conformance.test.ts` with source readers and these assertions:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) acc = collectTsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const TSX_FILES = collectTsxFiles(join(process.cwd(), "src"));
const REQUIRED_ROLES = [
  "type-identity",
  "type-page-title",
  "type-nav",
  "type-nav-group",
  "type-section-label",
  "type-ledger",
  "type-measurement",
  "type-character",
];

it("defines every semantic role in the global stylesheet", () => {
  const source = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  for (const role of REQUIRED_ROLES) {
    expect(source, role).toContain(`.${role}`);
  }
});

it("requires every H1 to use the page-title role", () => {
  for (const file of TSX_FILES) {
    for (const tag of readFileSync(file, "utf8").matchAll(/<h1\b[^>]*>/g)) {
      expect(tag[0], `${file}: ${tag[0]}`).toContain("type-page-title");
    }
  }
});

it("keeps PageHeader on the identity/page-title role", () => {
  const source = readFileSync(join(process.cwd(), "src/components/shared/page-header.tsx"), "utf8");
  expect(source).toContain("type-page-title");
});

it("keeps desktop navigation quiet and separate from section labels", () => {
  const source = readFileSync(join(process.cwd(), "src/components/layout/desktop-nav.tsx"), "utf8");
  expect(source).toContain("type-nav");
  expect(source).toContain("type-nav-group");
  expect(source).not.toMatch(/type-nav-group[^>]*uppercase/);
  expect(source).not.toMatch(/type-nav-group[^>]*tracking-/);
});

it("rejects the old raw caption escape hatch", () => {
  for (const file of TSX_FILES) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/\bcaption\b/);
  }
});

it("requires the logo to use TideMark and contain no tagline contract", () => {
  const source = readFileSync(join(process.cwd(), "src/components/shared/logo.tsx"), "utf8");
  expect(source).toContain("TideMark");
  expect(source).not.toContain("showTagline");
  expect(source).not.toContain("Plan • Track • Grow");
  expect(source).not.toMatch(/linearGradient|feDropShadow|barGrad|arrowGrad/);
});
```

Add focused registry assertions for the shared contracts after the initial red run. The registry must name concrete files and required roles, not infer roles from arbitrary font sizes:

```ts
const ROLE_CONTRACTS = [
  ["components/dashboard/balance-block.tsx", ["type-identity", "type-ledger", "type-character"]],
  ["components/dashboard/kpi-card.tsx", ["type-section-label", "type-ledger"]],
  ["components/shared/page-header.tsx", ["type-page-title"]],
  ["components/layout/desktop-nav.tsx", ["type-nav", "type-nav-group"]],
  ["components/shared/tide-gauge.tsx", ["type-measurement"]],
  ["components/dashboard/category-donut-chart.tsx", ["type-measurement"]],
  ["components/dashboard/income-expense-chart.tsx", ["type-measurement"]],
] as const;
```

The test must report the file, line, and missing role for every violation so the red output identifies the migration work.

- [ ] **Step 2: Run the detector red**

Run:

```powershell
npx vitest run src/tests/typography-conformance.test.ts
```

Expected: FAIL on the current tree, with the current `PageHeader` missing `type-page-title`, raw `caption` usage, missing role classes, the old logo SVG/tagline, and measurement surfaces without `type-measurement`.

- [ ] **Step 3: Commit only the red detector**

```powershell
git add src/tests/typography-conformance.test.ts
git commit -m "test: add S5c typography hierarchy detector"
```

Do not migrate production files in this task.

---

### Task 2: Add typography role primitives and enforce the shared page/nav contract

**Files:**
- Modify: `src/app/globals.css:219-249`
- Modify: `src/components/shared/page-header.tsx:7-18`
- Modify: `src/components/layout/desktop-nav.tsx:1-72`
- Modify: `src/components/dashboard/balance-block.tsx:84-158`
- Test: `src/tests/typography-conformance.test.ts`

**Interfaces:**
- Consumes: existing `--font-sans`, `--font-display`, `--font-mono`, `--ink-muted`, and `--ink-faint` variables.
- Produces: `.type-identity`, `.type-page-title`, `.type-nav`, `.type-nav-group`, `.type-section-label`, `.type-ledger`, `.type-measurement`, and `.type-character` classes.

- [ ] **Step 1: Add role classes to `globals.css`**

Define the roles in `@layer components` with the following exact separation:

```css
.type-identity {
  font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.type-page-title {
  font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.type-nav {
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}
.type-nav-group {
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.6875rem;
  line-height: 1.2;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}
.type-section-label {
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  line-height: 1.1;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted-foreground);
}
.type-ledger {
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 2rem;
  line-height: 1.15;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}
.type-measurement {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.625rem;
  line-height: 1.15;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.type-character {
  font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  font-size: 1rem;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

At `sm`, `.type-page-title` becomes `2.5rem`; `.type-ledger` becomes `2.5rem`. Keep `.ledger-figure` only as a compatibility alias during migration, then remove its raw call sites and its standalone definition once `type-ledger` is green.

- [ ] **Step 2: Make `PageHeader` the H1 enforcement point**

Change the H1 to:

```tsx
<h1 className="type-page-title text-foreground">{title}</h1>
```

Keep the description in Instrument Sans. Do not add uppercase, tracking, or a second heading role.

- [ ] **Step 3: Give the desktop nav quiet roles and an overflow affordance**

In `desktop-nav.tsx`, use `type-nav` on links and `type-nav-group` on group labels. Remove `uppercase` and `tracking-wider` from group labels.

Add a `navScrollRef`, an `isOverflowing` state, and a `ResizeObserver`/scroll listener. Render the nav inside a relative wrapper. When `scrollWidth > clientWidth`, render:

```tsx
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
/>
```

Give the scroll container `tabIndex={0}` and `aria-label="Primary navigation"` so keyboard users can reach the scroll affordance. Keep all nine links in the DOM; do not create a More destination.

- [ ] **Step 4: Apply identity and character roles to the home balance block**

Use `.type-identity` on the dominant total figure and `.type-character` on the Filipino phase line. Use `.type-ledger` on safe-to-spend, spent-this-period, and calendar-month-net figures. Keep signed currency behavior unchanged.

- [ ] **Step 5: Run the focused detector and typecheck**

Run:

```powershell
npx vitest run src/tests/typography-conformance.test.ts
npx tsc --noEmit
```

Expected: detector still fails on unmigrated pages, but `PageHeader`, nav, and balance-block assertions pass; TypeScript remains clean.

- [ ] **Step 6: Commit the shared foundation**

```powershell
git add src/app/globals.css src/components/shared/page-header.tsx src/components/layout/desktop-nav.tsx src/components/dashboard/balance-block.tsx src/tests/typography-conformance.test.ts
git commit -m "feat: add S5c typography role primitives"
```

---

### Task 3: Replace the pre-S5 logo and remove the tagline everywhere

**Files:**
- Modify: `src/components/shared/logo.tsx:1-142`
- Modify: `src/components/shared/auth-shell.tsx:30-40`
- Modify: `src/app/privacy/page.tsx:30-45`
- Modify: `src/app/terms/page.tsx:35-50`
- Modify: `src/app/~offline/page.tsx:8-18`
- Modify: `src/app/(dashboard)/transactions/print/page.tsx:45-58`
- Test: `src/tests/typography-conformance.test.ts`

**Interfaces:**
- Consumes: `TideMark` from `@/components/shared/tide-gauge` and the existing `Logo` `size`, `iconOnly`, and `tone` props.
- Produces: an unboxed TideMark + Bricolage wordmark with no tagline prop or tagline callers.

- [ ] **Step 1: Add the failing logo test cases**

Extend the detector to read every known `Logo` caller and assert:

```ts
const LOGO_CALLER_FILES = [
  "src/components/shared/auth-shell.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/~offline/page.tsx",
  "src/app/(dashboard)/transactions/print/page.tsx",
].map((file) => join(process.cwd(), file));

for (const file of LOGO_CALLER_FILES) {
  const source = readFileSync(file, "utf8");
  expect(source, file).not.toContain("showTagline");
}
```

Run the focused test and confirm it fails on the current auth/legal/offline/print callers and old SVG.

- [ ] **Step 2: Replace the old SVG implementation**

Remove the gradient, glow, bar-chart, and arrow markup from `logo.tsx`. Import `TideMark` and render it at the existing icon size. Render the wordmark with `type-identity`, keeping the existing tone/size behavior. Remove `showTagline` from `LogoProps` and delete the tagline branch entirely.

- [ ] **Step 3: Remove all tagline callers**

Change each listed caller from `<Logo ... showTagline />` to `<Logo ... />`. Do not add a replacement tagline anywhere.

- [ ] **Step 4: Run the logo detector and typecheck**

```powershell
npx vitest run src/tests/typography-conformance.test.ts
npx tsc --noEmit
```

Expected: logo assertions pass; remaining typography assertions still fail on un-migrated page surfaces.

- [ ] **Step 5: Commit the identity mark migration**

```powershell
git add src/components/shared/logo.tsx src/components/shared/auth-shell.tsx src/app/privacy/page.tsx src/app/terms/page.tsx src/app/~offline/page.tsx src/app/(dashboard)/transactions/print/page.tsx src/tests/typography-conformance.test.ts
git commit -m "feat: replace pre-S5 logo with Tide wordmark"
```

---

### Task 4: Sweep all page and shared measurement surfaces

**Files:**
- Modify: `src/app/(dashboard)/accounts/accounts-client.tsx`
- Modify: `src/app/(dashboard)/expenses/expenses-page-client.tsx`
- Modify: `src/app/(dashboard)/income/income-page-client.tsx`
- Modify: `src/app/(dashboard)/income/month-calendar.tsx`
- Modify: `src/app/(dashboard)/income/paycheck-planner.tsx`
- Modify: `src/app/(dashboard)/budgets/budgets-page-client.tsx`
- Modify: `src/app/(dashboard)/savings/savings-page-client.tsx`
- Modify: `src/app/(dashboard)/forecasting/forecasting-client.tsx`
- Modify: `src/app/(dashboard)/simulator/simulator-client.tsx`
- Modify: `src/app/(dashboard)/transactions/transactions-client.tsx`
- Modify: `src/app/(dashboard)/transactions/summary-view.tsx`
- Modify: `src/app/(dashboard)/transactions/print/page.tsx`
- Modify: `src/components/dashboard/kpi-card.tsx`
- Modify: `src/components/dashboard/accounts-summary-card.tsx`
- Modify: `src/components/dashboard/total-debt-card.tsx`
- Modify: `src/components/dashboard/category-donut-chart.tsx`
- Modify: `src/components/dashboard/income-expense-chart.tsx`
- Modify: `src/components/dashboard/recent-transactions.tsx`
- Modify: `src/components/dashboard/health-hero-card.tsx`
- Modify: `src/components/shared/tide-gauge.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/components/shared/page-header.tsx`
- Modify: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/~offline/page.tsx`, and recovery/auth H1s where the detector finds a non-`PageHeader` application H1.
- Test: `src/tests/typography-conformance.test.ts`

**Interfaces:**
- Consumes: role classes from Task 2 and the detector registry from Task 1.
- Produces: every page route using semantic role classes; no raw `caption`, generic H1, or page-local financial figure scale.

- [ ] **Step 1: Run the detector and record the full red inventory**

```powershell
npx vitest run src/tests/typography-conformance.test.ts
```

Capture the complete list of missing roles. Do not fix violations by adding detector exemptions.

- [ ] **Step 2: Migrate section labels and navigation labels**

Replace every `caption` class in the listed TSX files with `type-section-label`. Replace raw uppercase/tracked nav labels in `DesktopNav` with `type-nav` and `type-nav-group`. Preserve existing semantic colors and layout classes.

- [ ] **Step 3: Migrate H1s and identity copy**

Every application H1 must use `type-page-title`. The home hero uses `type-identity`. The Filipino phase line in `BalanceBlock` uses `type-character`. Do not use `type-character` for English descriptions, empty-state instructions, or controls.

- [ ] **Step 4: Migrate currency and ordinary figures**

Replace `ledger-figure` and hand-rolled `text-3xl`/`text-4xl`/`text-5xl` financial figures with `type-ledger` plus a documented size modifier only where a page-dominant figure is intentionally larger. Preserve `CurrencyDisplay` sign/color behavior. Counts of transactions/entries may use `type-measurement` only when they are presented as counts, not when they are the page’s financial answer.

- [ ] **Step 5: Migrate measurement surfaces**

Apply `type-measurement` to:

- Tide gauge phase/cutoff labels and graduations;
- chart axis ticks and tooltips that display measured values;
- percentages, ratios, utilization values, and counts;
- calendar day numbers and cutoff markers where they function as measurements.

Do not apply it to currency amounts, long labels, or body copy.

- [ ] **Step 6: Run the detector until green**

```powershell
npx vitest run src/tests/typography-conformance.test.ts
npx tsc --noEmit
```

Expected: PASS with no raw `caption`, no generic H1, no old logo contract, and all required role registries satisfied.

- [ ] **Step 7: Commit the semantic sweep**

```powershell
git add src
git commit -m "feat: enforce S5c typography roles across surfaces"
```

---

### Task 5: Add runtime font/nav probes and update verification scripts

**Files:**
- Modify: `verification/screenshot-prep/probe-dom.js`
- Modify: `verification/screenshot-prep/probe-run.mjs`
- Modify: `verification/screenshot-prep/nav-check.mjs`
- Modify: `verification/screenshot-prep/capture-wide.mjs` only if the new nav affordance needs a capture diagnostic
- Test: `src/tests/typography-conformance.test.ts`

**Interfaces:**
- Consumes: the named role classes and the committed detector.
- Produces: runtime assertions for H1 font family, quiet nav, nav reachability, and overflow visibility at 1100px.

- [ ] **Step 1: Add a runtime H1 assertion**

In `probe-dom.js`, add an assert that every page’s first H1 has a computed `fontFamily` containing `Bricolage` and that its class list contains `type-page-title`. Report the page, family, and classes on failure.

- [ ] **Step 2: Add runtime nav role assertions**

For `nav[aria-label="Primary"]`, assert:

- link text is not uppercase through CSS `text-transform`;
- links carry `type-nav`;
- group labels carry `type-nav-group`;
- no group label uses the section-label class;
- the nav has no wrapped link rows at 1280px.

- [ ] **Step 3: Extend `nav-check.mjs` to prove all nine destinations at 1100px**

At widths 1440, 1280, 1100, 1024, and 900, collect all nine `href` values and assert:

- `1440`, `1280`, and `1100`: all nine links exist in the DOM;
- `1100`: `scrollWidth <= clientWidth` OR the overflow affordance is visible and the nav can be scrolled to the final link;
- `1024`: all nine links exist, no wrap, and overflow is either absent or visibly indicated;
- `900`: desktop nav hidden, bottom nav visible;
- every destination is reachable by scrolling to `scrollWidth` and checking its `href` is visible.

Log the nav overflow state and final scroll position. The 1100px run must print all nine reachable hrefs.

- [ ] **Step 4: Run the runtime checks**

```powershell
node probe-run.mjs
node nav-check.mjs
```

Expected: all 24 DOM configurations pass, 1100px reports all nine reachable destinations, and 900px reports bottom navigation.

- [ ] **Step 5: Preserve the verification policy**

`verification/` remains untracked. If the runtime work required a source-owned detector update, commit only `src/tests/typography-conformance.test.ts`; otherwise this task ends with the verification edits uncommitted and their output recorded in the gate report.

---

### Task 6: Update design documentation and run the final gate

**Files:**
- Modify: `DESIGN.md`
- Modify: `.impeccable/design.json`
- Modify: `src/tests/typography-conformance.test.ts` only if the final registry needs a documented exemption
- Verification: `verification/screenshot-prep/capture-desktop.mjs`, `capture-mobile.mjs`, `capture-wide.mjs`, `probe-run.mjs`, `nav-check.mjs`

**Interfaces:**
- Consumes: the approved role classes, detector, runtime probes, and S5c spec.
- Produces: documentation that names the same roles and a final all-PASS gate.

- [ ] **Step 1: Update design documentation**

Add the six-role table, the nav width behavior, the character-voice role, and the unboxed Tide wordmark rule to `DESIGN.md`. Refresh the descriptive sidecar without treating it as authoritative over live code.

- [ ] **Step 2: Run the full source verification**

```powershell
npm test
npx tsc --noEmit
npx vitest run src/tests/typography-conformance.test.ts
.opencode\skills\impeccable\scripts\impeccable.cmd detect --json src
```

Expected: all tests pass, TypeScript exits 0, the typography detector passes, and the Impeccable detector exits 0 with only known advisories.

- [ ] **Step 3: Run the full screenshot/runtime gate**

```powershell
node probe-run.mjs
node nav-check.mjs
node capture-desktop.mjs
node capture-mobile.mjs
node capture-wide.mjs
```

Expected: 24/24 DOM configs pass, 1100px reaches all nine nav destinations, the overflow affordance is verified when needed, and all three screenshot widths capture in light and dark worlds.

- [ ] **Step 4: Perform the device review**

On the deployed build, verify:

- all page H1s visibly use Bricolage;
- nav is quieter than section labels at 1100px and 1280px;
- all nine nav destinations are reachable;
- currency, percentages, counts, chart axes, and character copy are visibly distinct;
- the logo is unboxed and the tagline is absent on shell, auth, legal, offline, and print;
- mobile hierarchy remains clear and the bottom nav remains reachable.

- [ ] **Step 5: Commit only after all checks pass**

```powershell
git add DESIGN.md .impeccable/design.json
git commit -m "docs: document S5c typography hierarchy"
```

Push only after the human partner confirms the device review and the final gate output.

## Plan self-review

- **Spec coverage:** typography roles, nav breakpoints/affordance, character voice, H1 enforcement, measurement migration, logo scope, red-first detector, runtime checks, docs, and device acceptance each have an owning task.
- **Placeholder scan:** no TBD/TODO/unspecified implementation steps remain; every task names files, commands, expected outcomes, and commit boundaries.
- **Type consistency:** role names are identical across CSS, detector registry, runtime probe, and plan. The `type-identity` class is used for the hero and wordmark; `type-page-title` is used for H1s; `type-character` is reserved for Filipino voice.
- **Review focus:** 1100px reachability, Bricolage H1 loading, signed currency preservation, role separation, and global tagline removal are each pinned to a test or runtime check.
