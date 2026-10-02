-- Account receive-QR storage (applied 2026-10-02; kept here so db-push
-- environments converge to the same state).
--
-- One nullable storage key per account. The app reads it through signed URLs
-- minted per open (getAccountQrUrl) and writes it through uploadAccountQr /
-- removeAccountQr, which enforce auth + ownership + magic-byte MIME + size cap
-- server-side. Archive keeps the row (and its QR); there is no account-delete
-- path, so no deletion cleanup exists - a future delete action must remove
-- {user_id}/{account_id}.jpg alongside the row.

alter table public.accounts
  add column if not exists qr_image_path text;

-- NOTE: storage.buckets on this project uses a `public` boolean, not
-- `private`. An earlier draft of this file said `private` and would fail on
-- push. The policy below is the applied shape (owner-scoped FOR ALL on the
-- user-id first path folder).
insert into storage.buckets (id, name, public)
values ('account-qrs', 'account-qrs', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own account QRs" on storage.objects;
create policy "Users manage own account QRs"
on storage.objects for all
using (
  bucket_id = 'account-qrs'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'account-qrs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
