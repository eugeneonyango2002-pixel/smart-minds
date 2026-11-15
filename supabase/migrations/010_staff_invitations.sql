-- Smart Minds Phase 5B: One-time staff account invitations
-- Staff members create their own Supabase Auth account, then redeem a one-time code.
-- No passwords are stored in Smart Minds tables.

create table if not exists public.staff_login_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null,
  email text not null,
  role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_invitation_staff_same_school_fk
    foreign key (school_id, staff_id)
    references public.staff(school_id, id) on delete cascade,
  constraint staff_invitation_role_check
    check (role in ('school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary','support_staff'))
);
create index if not exists staff_invitation_school_idx
  on public.staff_login_invitations(school_id, created_at desc);
alter table public.staff_login_invitations enable row level security;

drop policy if exists "Staff invitations manage" on public.staff_login_invitations;
create policy "Staff invitations manage" on public.staff_login_invitations
for all to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin']::text[])
)
with check (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin']::text[])
);
grant select, insert, update, delete on public.staff_login_invitations to authenticated;

create or replace function public.create_staff_invitation(
  p_staff_id uuid,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_token text;
begin
  if p_role not in ('school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary','support_staff') then
    raise exception 'Invalid staff account role';
  end if;

  select * into v_staff
  from public.staff
  where id = p_staff_id;

  if not found then
    raise exception 'Staff record not found';
  end if;

  if not (public.is_platform_admin() or public.has_school_role(v_staff.school_id, array['school_admin']::text[])) then
    raise exception 'You are not permitted to invite staff for this school';
  end if;

  if v_staff.status <> 'active' then
    raise exception 'Only active staff members can receive login invitations';
  end if;

  if v_staff.email is null or btrim(v_staff.email) = '' then
    raise exception 'Add an email address to this staff record first';
  end if;

  if exists (
    select 1 from public.staff_login_accounts
    where school_id = v_staff.school_id and staff_id = v_staff.id
  ) then
    raise exception 'This staff member already has a login account';
  end if;

  delete from public.staff_login_invitations
  where school_id = v_staff.school_id and staff_id = v_staff.id
    and accepted_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.staff_login_invitations
    (school_id, staff_id, email, role, token_hash, expires_at, created_by)
  values
    (v_staff.school_id, v_staff.id, lower(btrim(v_staff.email)), p_role,
     md5(v_token), now() + interval '1 hour', auth.uid());

  return v_token;
end;
$$;

create or replace function public.claim_staff_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.staff_login_invitations%rowtype;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before redeeming a staff invitation';
  end if;

  select lower(email) into v_auth_email
  from auth.users where id = auth.uid();

  select * into v_invitation
  from public.staff_login_invitations
  where token_hash = md5(p_token)
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation code is invalid, expired or already used';
  end if;

  if lower(v_invitation.email) <> coalesce(v_auth_email, '') then
    raise exception 'Sign in using the email address registered by your school';
  end if;

  insert into public.staff_login_accounts
    (school_id, staff_id, auth_user_id, role, status, created_by)
  values
    (v_invitation.school_id, v_invitation.staff_id, auth.uid(),
     v_invitation.role, 'active', v_invitation.created_by);

  update public.staff_login_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'school_id', v_invitation.school_id,
    'staff_id', v_invitation.staff_id,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.create_staff_invitation(uuid, text) from public;
revoke all on function public.claim_staff_invitation(text) from public;
grant execute on function public.create_staff_invitation(uuid, text) to authenticated;
grant execute on function public.claim_staff_invitation(text) to authenticated;
