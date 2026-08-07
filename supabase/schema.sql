-- UEBEY canonical database schema
-- Fresh-install model: auth.users -> accounts -> pages

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  page_limit integer not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_plan_check check (plan in ('free','pro','business','admin')),
  constraint accounts_page_limit_check check (page_limit >= 0),
  constraint accounts_status_check check (status in ('active','suspended','closed'))
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  constraint pages_username_length check (char_length(username) between 3 and 30),
  constraint pages_username_format check (username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint pages_username_reserved check (
    username not in (
      'admin','api','app','assets','auth','blog','dashboard','edit','help',
      'login','logout','pricing','privacy','reset-password','signup','support','terms','uebey'
    )
  ),
  constraint pages_theme_check check (theme in ('minimal','dark','warm')),
  constraint pages_bio_length check (char_length(bio) <= 280)
);

create index if not exists pages_owner_id_idx on public.pages(owner_id);
create index if not exists pages_published_username_idx on public.pages(username) where published = true;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_account on auth.users;
create trigger on_auth_user_created_create_account
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.accounts (user_id)
select id from auth.users
on conflict (user_id) do nothing;

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

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.pages enable row level security;

drop policy if exists "users can read own account" on public.accounts;
create policy "users can read own account"
on public.accounts for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "public can read published pages" on public.pages;
create policy "public can read published pages"
on public.pages for select to anon, authenticated
using (published = true or (select auth.uid()) = owner_id);

drop policy if exists "owners can update own pages" on public.pages;
create policy "owners can update own pages"
on public.pages for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can delete own pages" on public.pages;
create policy "owners can delete own pages"
on public.pages for delete to authenticated
using ((select auth.uid()) = owner_id);

create or replace function public.create_page(
  p_username text,
  p_display_name text default '',
  p_headline text default '',
  p_bio text default '',
  p_instagram text default '',
  p_whatsapp text default '',
  p_linkedin text default '',
  p_website text default '',
  p_theme text default 'minimal',
  p_published boolean default true
)
returns public.pages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.accounts;
  v_count integer;
  v_page public.pages;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_account
  from public.accounts
  where user_id = v_uid
  for update;

  if not found then
    insert into public.accounts (user_id) values (v_uid)
    returning * into v_account;
  end if;

  if v_account.status <> 'active' then
    raise exception 'account_not_active' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.pages
  where owner_id = v_uid;

  if v_count >= v_account.page_limit then
    raise exception 'page_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.pages (
    owner_id, username, display_name, headline, bio,
    instagram, whatsapp, linkedin, website, theme, published
  ) values (
    v_uid, p_username, coalesce(p_display_name,''), coalesce(p_headline,''), coalesce(p_bio,''),
    coalesce(p_instagram,''), coalesce(p_whatsapp,''), coalesce(p_linkedin,''), coalesce(p_website,''),
    coalesce(p_theme,'minimal'), coalesce(p_published,true)
  )
  returning * into v_page;

  return v_page;
end;
$$;

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
    and not exists (select 1 from public.pages p where p.username = candidate);
$$;

grant select on table public.accounts to authenticated;
grant select on table public.pages to anon, authenticated;
grant update, delete on table public.pages to authenticated;
revoke insert on table public.pages from anon, authenticated;

revoke execute on function public.create_page(text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.create_page(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;