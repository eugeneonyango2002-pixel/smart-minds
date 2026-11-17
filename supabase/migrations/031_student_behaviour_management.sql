-- Smart Minds: student discipline and positive behaviour records.
-- Run this migration in the Supabase SQL Editor for the Smart Minds project.

create table if not exists public.student_behaviour_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  incident_date date not null default current_date,
  record_type text not null check (record_type in ('positive','misconduct','support_needed')),
  category text not null,
  severity text not null default 'low' check (severity in ('low','medium','high')),
  description text not null,
  action_taken text,
  follow_up_date date,
  status text not null default 'open' check (status in ('open','follow_up','resolved')),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint behaviour_record_student_same_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint behaviour_follow_up_not_before_incident
    check (follow_up_date is null or follow_up_date >= incident_date)
);

create index if not exists student_behaviour_school_date_idx
  on public.student_behaviour_records(school_id, incident_date desc);
create index if not exists student_behaviour_student_date_idx
  on public.student_behaviour_records(school_id, student_id, incident_date desc);
create index if not exists student_behaviour_open_followups_idx
  on public.student_behaviour_records(school_id, follow_up_date)
  where status <> 'resolved';

alter table public.student_behaviour_records enable row level security;

drop policy if exists "Behaviour records school staff read" on public.student_behaviour_records;
create policy "Behaviour records school staff read"
on public.student_behaviour_records
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher']::text[])
);

drop policy if exists "Behaviour records staff create" on public.student_behaviour_records;
create policy "Behaviour records staff create"
on public.student_behaviour_records
for insert to authenticated
with check (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher']::text[])
);

drop policy if exists "Behaviour records leadership update" on public.student_behaviour_records;
create policy "Behaviour records leadership update"
on public.student_behaviour_records
for update to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[])
)
with check (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[])
);

drop policy if exists "Behaviour records leadership delete" on public.student_behaviour_records;
create policy "Behaviour records leadership delete"
on public.student_behaviour_records
for delete to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher']::text[])
);

grant select, insert, update, delete on public.student_behaviour_records to authenticated;
