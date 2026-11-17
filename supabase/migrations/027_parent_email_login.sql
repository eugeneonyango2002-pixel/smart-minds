-- Parent email login: keep phone as contact information, use email for authentication.
alter table public.parent_accounts
  add column if not exists email text;

create unique index if not exists parent_accounts_school_email_unique
  on public.parent_accounts (school_id, lower(email))
  where email is not null;

grant all privileges on table public.parent_accounts, public.parent_students to service_role;
