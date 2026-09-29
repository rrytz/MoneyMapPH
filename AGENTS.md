<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verification gates

Run the chain, not the parts: `npm run gate:all`. **One invocation.** It starts
the dev server, waits for the port, runs every gate, stops the server, then runs
the build — because `next dev` and `next build` share `.next`, so the browser
gates need the server up and the build needs it down. That order used to be a
manual procedure, and a procedure that has to be remembered is the failure mode
this section exists to prevent.

Individual gates still run standalone: `npm run gate:nav` and friends. Those
need the dev server up, and they are for iterating — `gate:all` is the gate.

### Rule: an assertion must prove it had something to assert on

**A pass that could have passed by having nothing to compare is not a pass.**

This is a first-class principle, on the same footing as scheme-independence. A
gate honours it or violates it silently — there is no middle state, because the
violation looks exactly like a green run.

It exists because four separate defects across four commits shared this shape:

| defect | how it passed while asserting nothing |
|---|---|
| `SKIPPED` when no archived account existed | the skip condition was the *data*, so the assertion could never un-skip itself |
| divider compared as `lc.divider !== dc.divider` | null vs null is trivially equal, so a card with **no divider** passed |
| archived cards found by inline `backgroundColor` | an archived card paints no brand base, so the selector re-measured *active* cards and reported them as archived coverage |
| `addStyleTag` called before `goto` | `goto` replaces the document, so the injected style was discarded and **motion was never suppressed at all** |

The common thread is not carelessness. Each of these was a *reasonable-looking*
assertion that had no way to report its own emptiness.

### What it requires, concretely

1. **Identify elements semantically.** `data-*`, `role`, or tag — never a
   visual property. Not colour, opacity, size, position, border presence, or
   background. A selector built on a visual property cannot distinguish the
   state it is meant to be testing, and it fails by measuring the wrong thing
   and reporting it as coverage.
2. **Assert presence before equality.** `null !== null` is false. If a
   comparison can hold because both sides are missing, it is not a comparison.
3. **Suppress, then prove you suppressed.** Inject styles *after* navigation.
   A control that was never active is worse than no control, because it is
   indistinguishable from one that is.
4. **A fixture must exercise the state, not a proxy for it.** If the ledger has
   no archived account, create one — do not skip.
5. **Wait on an observed condition.** No `waitForTimeout` in a gate. A gate
   whose green depends on a constant being long enough is not deterministic; it
   is *currently* fast enough.
6. **Coverage before absence.** A script asserting "no element has X" must
   first assert the element set is non-empty and covers the scope it claims.
   `"found nothing"` and `"nothing exists"` are indistinguishable, and only one
   of them is the answer you want. Watch for `.every()` in particular:
   `[].every(p) === true`, so it passes on an empty subject.

## Read the output. The exit code is necessary, not sufficient.

After **any** gate change, run the gate and read what it printed. Not the exit
code — the output.

Scanning is a floor. Reading is the ceiling. Two of the four real defects in
the audit pass were found by reading a printed line, not by any tool:

- `1280px conditional ... PASS  (nav 0px at y=null, pinned bottom: false)` — the
  line announced that it had measured nothing, and passed.
- `fixture: archived a real account and restored it` — the only evidence the
  fixture was real and not a proxy.

A gate that prints `cards: 7` should make you ask *which seven*. Silence is not
evidence.

**Do not edit gate scripts with shell string substitution.** PowerShell against
a JavaScript file has now cost two sessions: a `$c2=$2` typo wrote
`run-gate-all.mjs` **empty**, after which `gate:all` exited 0 in 886ms having
asserted nothing; and earlier a `.Replace('\n')` in single quotes never matched,
producing a probe that silently did nothing. Use an editor. This is a
discipline, not a control — `gate:rules` cannot catch it, and the read-the-output
discipline above is what catches it today.

## The recursion you are about to walk into

Every verifier in this series reproduced the class it was written to catch:

| verifier | what it reproduced |
|---|---|
| palette unit test | passed; the component never consumed the palette |
| root-hover test | passed; a leaf's own `:hover` is unreachable from it |
| motion suppression | was never active; injected before the navigation that discarded it |
| compositing proof | passed on an empty scan set |
| **the human reading the output** | **twice reported a "false pass" that was a broken probe — a `.Replace()` whose `\n` was a literal, and a suppression that could not match CRLF** |
| **`gate:logo-source`** | **passed a logo that rendered as a solid white rectangle — a full-canvas background authored as `<polygon>`, which is not a `<rect>`, plus a `<mask>` and group transforms the converter dropped** |

The last row is the one that matters, and it is not a confession.

**The source gate verifies the SHAPE of the source, not the IDENTITY of the
mark.** A full-canvas `<polygon>` background with `fill="currentColor"`
satisfies every rule `gate:logo-source` enforces — right fill, no opacity, no
gradient, no `<rect>`, no `<image>`, explicit per path — and it rendered as a
solid white rectangle 77px wide, the widest thing on the card. The only layer
that caught it was a human reading the render.

A probe that does not do what it says is **indistinguishable from a rule
passing** — including to the person reading the output, who is supposed to be
the ceiling above the scanner. I found two of them by running the injection I
was proud of, watching it "pass", and refusing to accept a structural
explanation without checking. The same class then hid for an entire session as a
CRLF mismatch: `.` does not match `\r` and `$` without `m` anchors only at
end-of-string, so `/rules:ok\s+(.*)$/` could never match a CRLF file. The
suppression was dead, the checker flagged its own legitimate self-report, and it
looked exactly like a logic bug.

The general form, and the boundary condition of this whole framework: **any
mechanism that reports "fine" is the same shape whether it is correct, is
silently doing nothing, or was never switched on.** The exit code cannot tell
those apart. Only a deliberately broken input can — which is why every rule here
carries a proof that it fires, and why "it passed" is never the end of a
verification step.

## Scope boundary: named, not implicit

`gate:rules` checks the scripts reachable from `gate:all` by following `npm run`
transitively. **A script invoked directly — in CI, by a person, or by a future
contributor — runs unconstrained.** That is a real gap and it is the same shape
as the `SKIPPED` that could not un-skip itself.

It is stated here rather than closed, deliberately. Closing it means either a
hand-kept exclusion list, which fails open and is one more thing to forget, or
a checker rewrite that would police the capture and diagnostic scripts — which
wait on time to produce a screenshot, not to decide a pass. `gate:dom` and
`gate:captures` are outside the chain and are reported as uncovered on every
`gate:rules` run. If you promote a script into `gate:all`, it comes under the
rules automatically.

A control that depends on someone remembering to apply it is the failure mode
that produced this entire series — so this rule is subject to the same standard
it describes.

**Enforced by `npm run gate:rules`**, which runs first in `gate:all`. It fails
a gate script that selects by a visual property, sleeps on a fixed duration,
injects a style tag before navigating, or asserts absence without first asserting
coverage of what it is claiming is absent. Findings can be silenced with
`rules:ok <reason>` in the comment block above them - a reason is mandatory,
and every suppression in force is printed on each run so they cannot accumulate
unseen.

Its scope is **derived from the `gate:all` chain** by following `npm run`
references transitively, not read from a list. Nothing maintains that list, so
promoting a new gate into the chain brings it under the rules automatically. A
checker whose scope is hand-kept is one more thing to forget, and it fails open.
`gate:dom` and `gate:captures` are outside the chain, cannot turn it red, and
are reported as uncovered rather than failed.

## Obsidian vault

The user's Obsidian vault is linked into this project at `obsidian/` (junction to `C:\Users\RITZ\Documents\MoneyMap`).

- Check `obsidian/` at the start of tasks involving plans, decisions, ideas, or project context.
- Write durable notes, decisions, and project knowledge to `obsidian/` when the user asks or when it adds long-term value.
- Use `[[wikilinks]]` when creating new notes so the graph stays connected.
- Obsidian is a separate app — edits via `obsidian/` appear in the user's vault instantly.
