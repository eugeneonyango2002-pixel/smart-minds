-- Smart Minds Phase 5A: Staff login identity and school roles
-- This migration links existing staff records to Supabase Auth users.
-- It does not store passwords. User accounts are created through Supabase Auth.

create table if not exists public.staff_login_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_login_staff_same_school_fk
    foreign key (school_id, staff_id)
    references public.staff(school_id, id) on delete cascade,
  constraint staff_login_role_check
    check (role in ('school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary','support_staff')),
  constraint staff_login_status_check
    check (status in ('active','suspended')),
  constraint staff_login_one_account_per_staff unique (school_id, staff_id),
  constraint staff_login_one_school_role_per_user unique (school_id, auth_user_id)
);

create index if not exists staff_login_user_idx
  on public.staff_login_accounts(auth_user_id, status);
create index if not exists staff_login_school_role_idx
  on public.staff_login_accounts(school_id, role, status);

alter table public.staff_login_accounts enable row level security;

-- Security-definer helper avoids recursive RLS checks on the role table.
create or replace function public.has_school_role(
  p_school_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.staff_login_accounts a
      where a.school_id = p_school_id
        and a.auth_user_id = auth.uid()
        and a.status = 'active'
        and a.role = any(p_allowed_roles)
    );
$$;

revoke all on function public.has_school_role(uuid, text[]) from public;
grant execute on function public.has_school_role(uuid, text[]) to authenticated;

drop policy if exists "Staff login accounts access" on public.staff_login_accounts;
create policy "Staff login accounts access" on public.staff_login_accounts
for select to authenticated
using (
  auth_user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin']::text[])
);

drop policy if exists "Staff login accounts manage" on public.staff_login_accounts;
create policy "Staff login accounts manage" on public.staff_login_accounts
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin']::text[])
)
with check (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin']::text[])
);

grant select, insert, update, delete on public.staff_login_accounts to authenticated;
