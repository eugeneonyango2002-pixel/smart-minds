-- Smart Minds Phase 8A: School timetable and lesson scheduling.
-- Run this migration in the Supabase SQL Editor.
-- All timetable references are constrained to records belonging to the same school.

create unique index if not exists classes_school_id_id_uidx on public.classes(school_id, id);
create unique index if not exists streams_school_id_id_uidx on public.streams(school_id, id);
create unique index if not exists subjects_school_id_id_uidx on public.subjects(school_id, id);
create unique index if not exists staff_school_id_id_uidx on public.staff(school_id, id);
create unique index if not exists academic_years_school_id_id_uidx on public.academic_years(school_id, id);
create unique index if not exists terms_school_id_id_uidx on public.terms(school_id, id);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  term_id uuid,
  class_id uuid not null,
  stream_id uuid,
  subject_id uuid not null,
  teacher_id uuid,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  room text,
  lesson_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_day_check check (day_of_week between 1 and 5),
  constraint timetable_time_check check (end_time > start_time),
  constraint timetable_school_id_unique unique (school_id, id),
  constraint timetable_year_same_school_fk foreign key (school_id, academic_year_id)
    references public.academic_years(school_id, id) on delete cascade,
  constraint timetable_term_same_school_fk foreign key (school_id, term_id)
    references public.terms(school_id, id) on delete set null,
  constraint timetable_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete cascade,
  constraint timetable_stream_same_school_fk foreign key (school_id, stream_id)
    references public.streams(school_id, id) on delete set null,
  constraint timetable_subject_same_school_fk foreign key (school_id, subject_id)
    references public.subjects(school_id, id) on delete cascade,
  constraint timetable_teacher_same_school_fk foreign key (school_id, teacher_id)
    references public.staff(school_id, id) on delete set null
);

create index if not exists timetable_school_class_idx
  on public.timetable_entries(school_id, class_id, academic_year_id, term_id, day_of_week, start_time);
create index if not exists timetable_school_teacher_idx
  on public.timetable_entries(school_id, teacher_id, academic_year_id, term_id, day_of_week, start_time);

alter table public.timetable_entries enable row level security;

drop policy if exists "Timetable teaching staff read" on public.timetable_entries;
create policy "Timetable teaching staff read" on public.timetable_entries
for select to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]));

drop policy if exists "Timetable leadership manage" on public.timetable_entries;
create policy "Timetable leadership manage" on public.timetable_entries
for all to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]))
with check (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]));

grant select, insert, update, delete on public.timetable_entries to authenticated;
