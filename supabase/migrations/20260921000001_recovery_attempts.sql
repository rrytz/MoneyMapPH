-- Quota-independent account-recovery attempt tracking.
--
-- This table backs the /recover rate limiter. It is service-role only: RLS is
-- enabled with no policies, so neither the anon key nor signed-in users can
-- read or write it. Only the server's admin client (SUPABASE_SERVICE_ROLE_KEY)
-- touches it.
create table if not exists public.auth_recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_recovery_attempts_identifier_created_at_idx
  on public.auth_recovery_attempts (identifier, created_at desc);

alter table public.auth_recovery_attempts enable row level security;