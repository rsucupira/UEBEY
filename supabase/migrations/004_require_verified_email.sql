-- UEBEY migration 004: require a confirmed email before creating a page
-- This hardens the rule in the database so it cannot be bypassed from the browser.

begin;

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
  v_email_confirmed_at timestamptz;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select email_confirmed_at
    into v_email_confirmed_at
  from auth.users
  where id = v_uid;

  if v_email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  select * into v_account
  from public.accounts
  where user_id = v_uid
  for update;

  if not found then
    insert into public.accounts (user_id)
    values (v_uid)
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

revoke execute on function public.create_page(text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.create_page(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

commit;
