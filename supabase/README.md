# Supabase Production Migration & Deployment Guide

## Project Setup

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase

# Verify
supabase --version
```

### 2. Link to Production Project

Each Supabase project is separate. You should have a **dev** project and a
**production** project. The project referenced in `.env.local` is the current
active project.

```bash
# Link to production project (get the ref from Project Settings → General)
supabase login
supabase link --project-ref <PROD_PROJECT_REF>
```

### 3. Migration Strategy

This project uses 4 migration files in `supabase/migrations/`:

| File | Description |
|---|---|
| `001_initial_schema.sql` | Core tables (profiles, income, expenses, budgets, snapshots) + RLS + triggers |
| `002_savings_goals.sql` | Savings goals table + contribution sync trigger |
| `003_purchase_simulator.sql` | Simulated purchases table |
| `004_reminders_schema.sql` | Reminders table |

**Apply to production:**

```bash
# Option A: Push migrations (recommended — applies only new migrations)
supabase db push

# Option B: Generate migration for review first
supabase db push --dry-run
# Review the SQL, then apply
supabase db push
```

**Never use `supabase db reset` on production** — this drops all data.

### 4. Production-Safe Migration Workflow

1. Run `supabase db push --dry-run` on staging to review the diff
2. Apply to production during a low-traffic window
3. Verify with: `supabase db ls --schema public` (confirm tables exist)
4. Test a sample query in the Supabase SQL editor

### 5. Auth Configuration (Production)

Once the production domain is known (e.g., `https://moneymap.ph`):

1. **Supabase Dashboard → Authentication → URL Configuration:**
   - Site URL: `https://moneymap.ph`
   - Redirect URLs: `https://moneymap.ph/auth/callback`

2. **Supabase Dashboard → Authentication → Providers → Google:**
   - Authorized redirect URIs: `https://moneymap.ph/auth/callback`

3. **OAuth provider** is configured via `signInWithOAuth({ provider: "google" })`
   in `src/app/(auth)/login/page.tsx:45` — no code change needed, only
   dashboard configuration.

### 6. Environment Variables (Vercel)

Only two env vars are needed. Both are `NEXT_PUBLIC_` prefixed (safe for
client-side). **No `SUPABASE_SERVICE_ROLE_KEY` is used** — the app relies on
RLS policies for data isolation.

| Variable | Production Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<prod-anon-key>` | Production, Preview, Development |

Set these in **Vercel Project Settings → Environment Variables** for all three
environments.
