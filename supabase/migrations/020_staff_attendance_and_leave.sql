-- Smart Minds: staff attendance and leave management
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present','absent','late','on_leave')),
  notes text,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_same_school_fk foreign key (school_id, staff_id)
    references public.staff(school_id, id) on delete cascade,
  constraint staff_attendance_one_record_per_day unique (school_id, staff_id, attendance_date)
);
create index if not exists staff_attendance_school_date_idx on public.staff_attendance(school_id, attendance_date);
alter table public.staff_attendance enable row level security;
drop policy if exists "Staff attendance school access" on public.staff_attendance;
create policy "Staff attendance school access" on public.staff_attendance
for all to authenticated using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.staff_attendance to authenticated;

create table if not exists public.staff_leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null,
  leave_type text not null check (leave_type in ('annual','sick','maternity','paternity','compassionate','unpaid','other')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_notes text,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_leave_dates_check check (end_date >= start_date),
  constraint staff_leave_same_school_fk foreign key (school_id, staff_id)
    references public.staff(school_id, id) on delete cascade
);
create index if not exists staff_leave_school_status_idx on public.staff_leave_requests(school_id, status, start_date);
alter table public.staff_leave_requests enable row level security;
drop policy if exists "Staff leave school access" on public.staff_leave_requests;
create policy "Staff leave school access" on public.staff_leave_requests
for all to authenticated using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.staff_leave_requests to authenticated;
