-- Smart Minds Phase 3B: Staff records
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
  phone text,
  email text,
  staff_role text not null default 'teacher',
  employment_type text not null default 'permanent',
  date_joined date not null default current_date,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  constraint staff_gender_check check (gender is null or gender in ('female','male','other')),
  constraint staff_role_check check (staff_role in ('teacher','head_teacher','deputy_head_teacher','bursar','secretary','support_staff','other')),
  constraint staff_employment_type_check check (employment_type in ('permanent','contract','part_time','intern','volunteer')),
  constraint staff_status_check check (status in ('active','on_leave','inactive')),
  constraint staff_employee_number_unique unique (school_id, employee_number),
  constraint staff_school_id_unique unique (school_id, id)
);
create index if not exists staff_school_name_idx on public.staff(school_id, last_name, first_name);
create index if not exists staff_school_role_idx on public.staff(school_id, staff_role);
alter table public.staff enable row level security;
drop policy if exists "Staff school access" on public.staff;
create policy "Staff school access" on public.staff
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.staff to authenticated;
