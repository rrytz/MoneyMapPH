# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

MoneyMap PH is a hosted service intended for other people to sign up to with
their own accounts. The primary user is an individual using the product to
manage their own personal money. Specifics of the target persona (segment,
acquisition, paid vs free) are not yet confirmed.

## Product Purpose

One place for all personal money: tracking expenses, budgets, income, and
savings goals, plus bills, debts, wallets, forecasting, and pay-period
planning — all in a single private app. Success means the user can see and
steer their full financial picture from one surface without exporting,
spreadsheets, or multiple tools.

## Positioning

The complete personal ledger — budgets, bills, debts, savings, accounts — in
one private, no-ads app. The claim another money app could not truthfully copy
is the combination: full coverage of personal money in a single place,
private by design, built for a Philippines-first (Peso) context.

## Operating Context

- Hosted web app (Next.js + Supabase) deployed to Vercel; signed-in sessions
  via Supabase Auth (Google OAuth and email/password).
- Used on phones via iOS Web Clip / PWA install, including the offline surface
  (serwist `~offline` route). Desktop usage is the other primary scene.
- The live deployment holds real production data in hosted Supabase; the
  current account set is the developer plus QA accounts.

## Capabilities and Constraints

- Currency is PHP (₱), `en-PH` locale, `DEFAULT_CURRENCY = "PHP"`.
- Shipped capability areas (evidence: app routes and services): dashboard,
  accounts & wallets, budgets, income & paychecks (pay-period engine,
  safe-to-spend, lean detection), expenses, savings goals, transactions (with
  printable statements), bills calendar, debt tracking, forecasting,
  simulator, and settings incl. full backup & restore and passphrase-based
  account recovery.
- Auth: Google OAuth + email/password; anonymous `/recover` route with a
  server-side passphrase and 5-attempt/15-minute lockout.
- Constraint: the hosted project contains real financial data — future work
  must not be destructive; backup/restore is the sanctioned safety net.
- Open decisions (recorded, not invented): target-persona specifics; pricing /
  business model; ship status of multi-account wallets (a design exists,
  dated 2026-09-21); language coverage beyond English UI.

## Brand Commitments

- Name: **MoneyMap PH** (also styled *MoneyMapPH* in code and metadata).
- Voice: private and personal. Terms state: "Your data is yours; we don't
  use it for advertising and we don't share it with third parties outside the
  providers that operate the service." Privacy policy: financial data is
  "never sold or shared."
- No fabricated testimonials, case studies, or claims about real users or
  metrics.

## Evidence on Hand

- Product copy: Terms of Service and Privacy Policy pages
  (`src/app/terms/page.tsx`, `src/app/privacy/page.tsx`).
- Live feature surface: the routes and services listed under Capabilities.
- Real production data in hosted Supabase (multi-user; developer + QA
  accounts at the time of writing).
- Absent: no testimonials, press, or case-study assets exist — future work
  must not fabricate them.

## Product Principles

1. **One surface, whole picture** — every part of an individual's money
   (budget, bills, debts, savings, accounts) lives together in a single
   coherent app; no feature is an island.
2. **Private by design** — user data belongs to the user: no ads, no sharing,
   no fabricated proof, minimal collection.
3. **Reality-first money math** — the engine models how money actually flows
   (pay periods, safe-to-spend, lean months, cutoff dates) rather than
   aspirational envelope fiction.
4. **There when the phone is** — installable and usable offline; the mobile
   surface is a first-class scene, not an afterthought.