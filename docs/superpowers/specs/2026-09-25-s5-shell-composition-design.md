# S5 — Shell & Page Composition (Structure Only)

Date: 2026-09-25 · Status: **structure approved, visual direction deferred**
Plan: structural spec for the Emerald Ledger redesign, S5

## Scope

Restructures the application shell and the composition hierarchy of every
screen. This document specifies **structure, behavior, and information
hierarchy only**.

**Deliberately excluded:** colors, typography treatment, surface styling,
iconography style, character/mascot design, and voice copy. Those follow once
the visual direction is confirmed (see *Deferred* below). Nothing here
constrains the warm, light-first, character-driven direction under
consideration — the structure is direction-agnostic by design.

## Why this supersedes the balance-rail proposal

A persistent left rail carrying the balance was proposed and structurally
approved, then withdrawn on review. Two reasons:

1. A mascot or character placed in a permanent side panel is chrome. It becomes
   wallpaper — present and ignored — and the character needs to be the
   *subject* of a surface, not decoration on one.
2. Warm, character-driven, conversational identity is structurally opposed to
   the rail's thesis ("everything, always, densely"). A rail is an analyst's
   instrument; the target identity is a guide.

**What survives is the information model, not the form:** the balance is the
always-present answer, and accounts remain permanently reachable.

## 1. Global shell

| Zone | Content | Behavior |
|---|---|---|
| **Top bar** (slim, persistent) | Brand wordmark · **compact balance + safe-to-spend meter** · account switcher · search, theme, avatar | One row. No breadcrumb, no logo tile, no tagline. The balance readout is the *glanceable* answer and is present on **every** page |
| **Page header** (per page, inside content) | Page title · one primary action | Replaces the old topbar's job. Every page owns its own title and action |
| **Content** | Page-specific | No persistent side panel anywhere |

### Removed

- Left sidebar in its entirety (including collapsed icon-only state — a
  balance-first rail could never collapse without hiding the balance, and the
  rail itself is gone)
- The 64px topbar band
- Hardcoded `Workspace › Overview` breadcrumb (was static text, wrong on every page)
- Pinned global "Add Transaction" CTA — each page keeps its own specific action
- Hardcoded `"BPO Senior Associate"` profile subtitle (`sidebar.tsx:64`)

### Glance vs settle

The balance appears twice, deliberately, at different scales:

- **Glance** — compact readout in the top bar, every page
- **Settle** — the large expressive figure on home

This is not redundancy; it is two registers of the same answer.

## 2. Home is the expressive surface

Home is **not** "a row of stat cards, then a list." It is a stack of
differently-shaped blocks with exactly one dominant element.

| Rank | Block | Role |
|---|---|---|
| 1 | **Balance block** | Dominant, full-width. Total + safe-to-spend. Hosts the character voice / first-run slot |
| 2 | This month's position | Income vs expenses, net. Supporting weight |
| 3 | Attention items | Upcoming bills, goals needing action — rendered **only** when something is actually due |
| 4 | Recent activity | Compact, lowest weight, capped list |

**Hierarchy rules**

- Rank 1 is the only large figure on the surface. Everything below is
  strictly subordinate.
- Blocks take **different shapes**. Never a uniform grid of equal-weight cards.
- The surface is not templated: each page composes its own blocks. There is no
  shared "stat row" component, because the current row is hand-copied across
  seven pages — that duplication is the root cause of the uniform rhythm.

## 3. Sub-pages

Each is single-purpose, with its own dominant element and its own composition.
Because the top bar already carries the balance, **sub-pages do not repeat a
large figure** — that is home's alone.

Sub-pages: Expenses · Income · Budgets · Savings · Accounts · Transactions ·
Forecasting · Simulator · Settings.

## 4. Navigation

Grouped by intent, not a flat list of nine:

- **Dashboard**
- **Money in** — Income
- **Money out** — Expenses, Budgets
- **Plan** — Savings, Forecasting, Simulator
- **Records** — Accounts, Transactions

Settings sits outside the groups, deliberately quiet.

**Accounts are reachable two ways:** an account switcher in the top bar, and
the existing Accounts page. Both.

**Desktop:** a single top row; nine destinations fit at ≥1024px.
**Mobile:** compact top strip (balance + meter) + bottom tabs.

**Open constraint:** nine destinations do not fit in mobile tabs. The primary
4–5 plus a More surface is required, and the character takes a slot there.

**Standing constraint preserved:** the bottom nav and its safe-area handling
are untouched by this work.

## 5. Responsive behavior

| Breakpoint | Treatment |
|---|---|
| ≥1024px | Full top bar (brand, balance readout, account switcher, controls, nav row) |
| <1024px | Compressed top strip (brand, balance + meter, essential controls); navigation moves to bottom tabs + More |

## 6. Empty and first-run state

- The balance block becomes the **first-run voice** — the place that asks the
  user to create a first account.
- Lower-ranked blocks render as **empty slots**, not zeros. Never a grid of
  empty boxes.
- Attention items never render as empty; they appear only when something is
  actually due.

## 7. Character slots (structural requirement)

The forthcoming character needs reserved positions. These are layout
requirements, independent of visual design:

1. **Home hero slot** — inside the balance block, the character's primary position
2. **First-run / empty-state slot** — all empty states, including sub-pages
3. **Milestone slot** — first entry logged, first payday passed, goal reached
4. **More-menu slot** (mobile) — a character presence in overflow navigation

The character must be **capable of silence** — quiet when nothing is wrong,
present when something matters. A character that animates during a lean month
would undermine the product.

## Deferred to the visual spec

Colors · typography and type treatment · surface styling and elevation ·
iconography · character identity and design · voice and microcopy · empty-state
illustration treatment.

## Acceptance (structural)

- No persistent left rail on any viewport
- Balance readout present on every page
- Home has exactly one dominant figure; no uniform stat-card row
- No shared stat-row template reintroduced
- Breadcrumb and hardcoded profile subtitle gone
- Nine destinations navigable on desktop and mobile
- Character slots present and direction-agnostic
