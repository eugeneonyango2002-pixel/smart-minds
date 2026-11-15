-- Smart Minds Phase 3C: Daily student attendance
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  attendance_date date not null default current_date,
  status text not null check (status in ('present','absent','late','excused')),
  notes text,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_student_same_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint attendance_one_record_per_day unique (school_id, student_id, attendance_date)
);
create index if not exists student_attendance_school_date_idx
  on public.student_attendance(school_id, attendance_date);
create index if not exists student_attendance_student_date_idx
  on public.student_attendance(student_id, attendance_date desc);
alter table public.student_attendance enable row level security;
drop policy if exists "Attendance school access" on public.student_attendance;
create policy "Attendance school access" on public.student_attendance
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.student_attendance to authenticated;
