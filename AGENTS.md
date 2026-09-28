<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verification gates

Run the chain, not the parts: `npm run gate:all`.

```
types -> test -> typography -> nav -> brand -> brand:states -> build
```

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

A control that depends on someone remembering to apply it is the failure mode
that produced this entire series — so this rule is subject to the same standard
it describes. It is documented here first and **enforced separately**, by a
check that fails a gate script violating 1, 2, 3 or 5. Until that check exists,
this section is a claim and not a control, and should be read as one.

## Obsidian vault

The user's Obsidian vault is linked into this project at `obsidian/` (junction to `C:\Users\RITZ\Documents\MoneyMap`).

- Check `obsidian/` at the start of tasks involving plans, decisions, ideas, or project context.
- Write durable notes, decisions, and project knowledge to `obsidian/` when the user asks or when it adds long-term value.
- Use `[[wikilinks]]` when creating new notes so the graph stays connected.
- Obsidian is a separate app — edits via `obsidian/` appear in the user's vault instantly.
