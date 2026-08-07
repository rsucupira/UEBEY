-- UEBEY migration 003: reserve account-related frontend routes
-- Run once after 002_accounts_pages.sql.

begin;

alter table public.pages
  drop constraint if exists pages_username_reserved;

alter table public.pages
  add constraint pages_username_reserved check (
    username not in (
      'admin','api','app','assets','auth','blog','dashboard','edit','help',
      'login','logout','pricing','privacy','reset-password','signup','support','terms','uebey'
    )
  );

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
      'login','logout','pricing','privacy','reset-password','signup','support','terms','uebey'
    )
    and not exists (
      select 1 from public.pages p where p.username = candidate
    );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

commit;
