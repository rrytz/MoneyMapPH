# Gate audit — inventory

**Status: REPORT ONLY.** No fixes applied in this commit. Steps 3–5 of the
sequence follow.

Companion to the rule in `AGENTS.md` → *an assertion must prove it had something
to assert on*. That rule was extracted from four defects found across four
commits. This audit asks a prior question: **how far does the class extend beyond
those four?**

Method: `audit-inventory.mjs` scans all 21 first-party scripts under
`verification/` for the five patterns, then every hit was triaged by hand. The
scanner over-reports — it cannot tell "measure a colour" from "select by a
colour" — so the counts below are **post-triage**, and each finding cites the
line it was confirmed on.

---

## Inventory: 21 scripts, by role

| role | scripts | in `gate:all`? |
|---|---|---|
| Nav gate | `nav-check.mjs` | **yes** |
| Brand gates | `account-brand-check.mjs`, `account-brand-states-check.mjs` | **yes** |
| DOM probe | `probe-run.mjs` (`gate:dom`) | no |
| Capture | `capture-desktop/mobile/wide.mjs` | no (`gate:captures`) |
| Diagnostic | `diag-balance.mjs`, `diag-dashboard.mjs`, `anchor-sweep.mjs`, `probe-dom.js` | no |
| Auth tooling | `mint.mjs`, `otp-probe.mjs`, `probe-magiclink.mjs`, `probe-accounts-bypass.mjs`, `cookie-bridge.mjs` | no |
| Evidence | `roundtrip.mjs`, `schema-check.mjs`, `confirm-foreign.mjs`, `revert-notes.mjs` | no |

Only three scripts gate anything, and they are the three this series has been
about. The class does **not** appear to extend past them into the capture and
diagnostic scripts — those wait on time, but they *produce screenshots*, and
settling before a capture is not an assertion. They are correctly out of scope
for rules 3–5 and only need rule 4 if they are ever promoted to a gate.

---

## Rule 1 — identification by visual property

**12 raw hits, 3 confirmed after triage.** The other 9 are *measurement*
(`getComputedStyle(x).color` feeding a contrast number), which is the whole
purpose of these scripts. Selecting is the defect, not reading.

### Confirmed

| site | what it does | consequence |
|---|---|---|
| `nav-check.mjs:74` | bottom nav found by `nav.fixed.bottom-0` — a **styling class** used as identity | rename the utility and the gate finds no nav |
| `nav-check.mjs:232` | same finder also requires `getBoundingClientRect().height > 0` | a visually-correct nav at height 0 is not found |
| `nav-check.mjs:298` | active state inferred by regex over `className + innerHTML` for `bg-sulpot\|text-sulpot` | **identifies state by theme class name**; a theme rename silently disables the check |
| `nav-check.mjs:242,291` | the More button found by `/more/i.test(b.innerText)` | text-based; breaks on an icon-only or translated label |
| `anchor-sweep.mjs:41` | `div[style*="width"]` — substring match on a style attribute | matches any div with an inline width |
| `probe-dom.js:290` | elements skipped by `getBoundingClientRect().width < 120` | small-but-legitimate elements dropped from the sweep |

`nav-check.mjs:298` is the serious one. It is the same defect the archived card
was: **inferring a state from how it is painted rather than from what it is.**
The same file already has the correct signal one line earlier —
`span[data-active="true"]` at `:297` — and falls back to class-name regex
anyway. The fallback is what would rot.

### Already correct

- `nav-check.mjs:276,292` — `a[aria-current="page"]`, semantic.
- `nav-check.mjs:222-231` — `checkVisibility` with a `display:none` ancestor
  walk, and the comment explains why a `display` keyword is insufficient.
- `account-brand-check.mjs:182` — `[data-account-card]`, structural.

---

## Rule 2 — assertions that can pass on null-vs-null or an empty set

**The most important finding in this audit is in the newest code.**

### Confirmed, and it is mine

| site | what it does | consequence |
|---|---|---|
| `account-brand-check.mjs:522` | compositing guard: `if (all.length === 0) → print PASS` | **if the card collector returns nothing, the guard reports "no hazards found"** — a vacuous pass, printed in the same green as a real one |
| `account-brand-states-check.mjs:542` | same shape, both schemes | same |

Both scan via `COLLECT`. If `COLLECT` returns zero cards — a selector rename, a
route change, a failed load — the absence-assertion reports the model is safe.
**Asserting absence is exactly where an empty set is most dangerous**, because
"found nothing" and "nothing exists" are indistinguishable, and the first is a
bug while the second is the desired result.

This is the archived false-pass shape, in code written two commits ago to fix
the archived false-pass. I checked the analogous guard in the same file at
`:476` (`if (light.length === 0) fail(...)`) — that one is correct. The hazard
guards were not given the same treatment.

### Confirmed elsewhere

| site | what it does | consequence |
|---|---|---|
| `roundtrip.mjs:178` | `users.users[0].email ?? "(no email)"` | a missing user prints a placeholder instead of failing — in a *backup verifier* |
| `nav-check.mjs:258` | `bar.links.map(...)` where `bar` may be `{err}` | crashes rather than reporting; a loud failure, but an unnamed one |

### Already correct — and worth preserving

- `nav-check.mjs:348` — `if (lastContentBottom === null || navTop === null) return false`
  **fails closed** when it cannot measure. This is the pattern the brand guards
  are missing.
- `nav-check.mjs:412` — relies on the same fail-closed helper.
- `account-brand-check.mjs:476`, `account-brand-states-check.mjs:475` — presence
  asserted before the comparison.
- `nav-check.mjs:172` — `r.topShown !== r.bottomShown` is a XOR, so *both* false
  (nothing rendered) correctly fails.

---

## Rule 3 — fixed sleeps

**12 sleeps across 8 scripts; 6 of them in one gate.**

| script | count | lines |
|---|---|---|
| `nav-check.mjs` | **6** | 46, 61, 273, 287, 401, 446 |
| `anchor-sweep.mjs` | 2 | 61, 64 |
| `capture-desktop/mobile/wide.mjs` | 1 each | 75 / 75 / 67 |
| `diag-balance.mjs`, `diag-dashboard.mjs`, `probe-run.mjs` | 1 each | 22 / 18 / 61 |

`account-brand-check.mjs` and `account-brand-states-check.mjs`: **zero**. They
wait on `document.fonts.ready`, an explicit selector, and a count transition.

`nav-check.mjs:46` is the worst instance and is worth calling out: it waits on
`!document.querySelector(".animate-pulse")` — a real condition — and then
*immediately* waits 800ms more. The condition already implies the content is
ready. The sleep is pure superstition, and it is on the hot path: `openAt` runs
per viewport, and the 273/287 sleeps run once per destination per viewport.
`nav` is the slowest stage in the chain at ~102–107s, and most of that is these.

---

## Rule 4 — motion suppression

| script | status |
|---|---|
| `account-brand-check.mjs` | **correct** — `addStyleTag` at L83, `goto` at L82 |
| `nav-check.mjs` | **never attempts it** |
| 9 other browser scripts | never attempts it |

Only one script has ever suppressed motion, and after the ordering fix it is the
only one that does so correctly. `nav-check.mjs` is in the default chain,
measures geometry, and has never had transitions disabled.

---

## Rule 5 — state fixtures

| script | status |
|---|---|
| `account-brand-states-check.mjs` | **correct** — creates its own archived account through the real UI, restores in `finally`, confirms the restore |
| `nav-check.mjs` | **correct, and the best example in the repo** — Phase D carries a *synthetic negative* that forces the assertion to reject an unsafe state, because the real dashboard has nothing to catch |
| everything else | no fixtures |

`nav-check.mjs` is worth crediting here: its Phase D comment states the reason
outright — *"A check that has never been observed to fail is not evidence of
anything."* That is rule 5 arrived at independently, and it is the standard the
brand gates are catching up to.

---

## Owed: design-conformance assumes exclusive CPU in a parallel pool

`src/tests/design-conformance.test.ts` fails `gate:all` under load, and it is
**not a borderline test that needs a bigger budget.** It is structurally wrong:
it scans 123 `.tsx` files from inside a vitest worker, and it only fits inside
the default 5s when it is not competing with 51 other workers for the disk.

| | outcome |
|---|---|
| scan alone | ~1.4s |
| under 52-worker contention | >6s, times out |
| same file earlier in the session | 844ms, passed |
| same file later in the session | 2.2s, times out |
| suite at HEAD, changes stashed | **2** timeouts |
| suite with the rule commit applied | **1** timeout |

So it is pre-existing and load-dependent — stashing the commit reproduces it,
and does so worse. 51 of 52 files pass, the file passes in isolation, and every
browser gate passes.

**The fix is to run it serially or outside the worker pool, not to raise the
timeout.** Raising `testTimeout` is a proxy: it hides the real defect — a test
that assumes it owns the machine — and would be rejected the moment the gate
pass resumes. This is recorded as **owed**, not tuned: do not spend a change
making it green by enlarging the number.

## What the audit concludes

The class is **real but bounded**, and the bound is instructive:

- **The brand gates are the only place rule 2 is violated** — and the two
  violations are in the *newest* code, in the absence-assertions. Fixing a class
  of bug and immediately introducing a fresh instance of it is the most useful
  finding here, because it shows the audit had to be run on the fix too.
- **`nav-check.mjs` is the only gate violating rules 3 and 4**, and it violates
  them completely. It is also the only gate that got rule 5 right on its own.
- **The capture and diagnostic scripts are correctly out of scope.** They wait on
  time to produce a picture, not to decide a pass.

Priority for repair: the two vacuous hazard guards (a live false pass, in the
chain) → `nav-check.mjs` (six sleeps, no suppression, class-name state
detection) → the remaining rule-1 sites.

`audit-inventory.mjs` is committed with this report as the instrument. It
over-reports by design: a scanner that missed a visual-property selector would be
worse than one that flags twenty measurement sites, and the triage is the cheap
part.
