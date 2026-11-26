-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- One row per recipe / cook / family member. Everything is private to the signed-in owner.
create table if not exists public.records (
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, collection, id)
);

create index if not exists records_owner_updated on public.records (owner_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "owner reads and writes own records" on public.records;
create policy "owner reads and writes own records" on public.records
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- The server decides when a row changed, so devices with wrong clocks can't confuse the sync.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_updated_at();

-- Private bucket for photos; each owner can only touch files under their own folder.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "owner reads own photos" on storage.objects;
create policy "owner reads own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner adds own photos" on storage.objects;
create policy "owner adds own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner updates own photos" on storage.objects;
create policy "owner updates own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner deletes own photos" on storage.objects;
create policy "owner deletes own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
