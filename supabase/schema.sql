-- UEBEY V1 database schema
-- Run this file once in Supabase > SQL Editor.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  headline text not null default '',
  bio text not null default '',
  instagram text not null default '',
  whatsapp text not null default '',
  linkedin text not null default '',
  website text not null default '',
  theme text not null default 'minimal',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_length check (char_length(username) between 3 and 30),
  constraint profiles_username_format check (username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint profiles_username_reserved check (
    username not in (
      'admin','api','app','assets','auth','blog','dashboard','edit','help',
      'login','logout','pricing','privacy','signup','support','terms','uebey'
    )
  ),
  constraint profiles_theme check (theme in ('minimal','dark','warm')),
  constraint profiles_bio_length check (char_length(bio) <= 280)
);

alter table public.profiles enable row level security;

-- Public visitors can read published pages. Owners can also read their own draft.
drop policy if exists "public can read published profiles" on public.profiles;
create policy "public can read published profiles"
on public.profiles
for select
to anon, authenticated
using (published = true or (select auth.uid()) = user_id);

-- One authenticated account can only write its own row.
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own profile" on public.profiles;
create policy "users can delete own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.profiles to anon, authenticated;
grant insert, update, delete on table public.profiles to authenticated;

-- Lets the public UI check a username without exposing unpublished profile rows.
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate is not null
    and char_length(candidate) between 3 and 30
    and candidate = lower(candidate)
    and candidate ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    and candidate not in (
      'admin','api','app','assets','auth','blog','dashboard','edit','help',
      'login','logout','pricing','privacy','signup','support','terms','uebey'
    )
    and not exists (
      select 1
      from public.profiles p
      where p.username = candidate
    );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
