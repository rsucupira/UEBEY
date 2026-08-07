# UEBEY — Account and page policy (MVP)

This document records product rules without locking the business model permanently.

## Stable structural rules

- Authentication identity lives in Supabase `auth.users`.
- One verified email corresponds to one UEBEY authentication account in the current email/password model.
- Account-level product data lives in `public.accounts`.
- Pages live independently in `public.pages`.
- One account may technically own many pages.
- `pages.username` is globally unique.
- A page may exist as draft (`published = false`) or public (`published = true`).
- Ownership and page limits are enforced by the database, not only by the UI.
- Creating a page requires an authenticated user with a confirmed email.

## Current commercial defaults

- New accounts start with `plan = free`.
- New accounts start with `page_limit = 1`.
- These are product defaults, not architectural constraints.

Future examples can therefore be implemented without redesigning ownership:

- Free: 1 page
- Pro: 5 pages
- Business: 25 pages

Changing those numbers only requires changing account entitlements/limits.

## Email/account UX

- Signup responses should not publicly confirm whether an email already has an account.
- Users can sign in, resend signup confirmation, or request password recovery.
- Pages must not be published from an unverified email account.

## Intentionally undecided

The MVP does not permanently decide:

- final plan names;
- prices;
- exact page limits;
- teams/workspaces;
- custom domains;
- ecommerce;
- marketplace features;
- social feed/followers;
- advanced analytics.

These can be added incrementally around the `accounts -> pages` ownership model.
