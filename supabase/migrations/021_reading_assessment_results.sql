-- Store the two reading-assessment columns separately from the official Grade 1 learning areas.
-- This keeps the rationalised CBC subject list unchanged.
create table if not exists public.reading_assessment_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  examination_id uuid not null,
  student_id uuid not null,
  component text not null check (component in ('english_reading','kiswahili_reading')),
  score numeric(6,2) not null check (score >= 0 and score <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_assessment_exam_same_school_fk
    foreign key (school_id, examination_id)
    references public.examinations(school_id, id) on delete cascade,
  constraint reading_assessment_student_same_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint reading_assessment_component_unique
    unique (examination_id, student_id, component)
);
create index if not exists reading_assessment_school_exam_idx
  on public.reading_assessment_results(school_id, examination_id);
alter table public.reading_assessment_results enable row level security;
drop policy if exists "Reading assessment school access" on public.reading_assessment_results;
create policy "Reading assessment school access" on public.reading_assessment_results
  for all to authenticated
  using (public.is_platform_admin() or public.is_school_member(school_id))
  with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.reading_assessment_results to authenticated;
