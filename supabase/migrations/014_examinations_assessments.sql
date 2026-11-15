-- Smart Minds Phase 7A: Examinations and learner assessment results.
-- Run this migration in the Supabase SQL Editor.
-- Every record is school-scoped and cross-school references are blocked by composite foreign keys.

create table if not exists public.examinations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  term_id uuid,
  class_id uuid not null,
  name text not null,
  exam_date date,
  max_score numeric(7,2) not null default 100,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint examination_max_score_check check (max_score > 0),
  constraint examination_status_check check (status in ('draft','published')),
  constraint examination_school_id_unique unique (school_id, id),
  constraint examination_year_same_school_fk foreign key (school_id, academic_year_id)
    references public.academic_years(school_id, id) on delete cascade,
  constraint examination_term_same_school_fk foreign key (school_id, term_id)
    references public.terms(school_id, id) on delete set null,
  constraint examination_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete cascade
);

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  examination_id uuid not null,
  student_id uuid not null,
  subject_id uuid not null,
  score numeric(7,2) not null,
  remarks text,
  entered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_result_score_check check (score >= 0),
  constraint exam_result_exam_student_subject_unique unique (examination_id, student_id, subject_id),
  constraint exam_result_school_id_unique unique (school_id, id),
  constraint exam_result_exam_same_school_fk foreign key (school_id, examination_id)
    references public.examinations(school_id, id) on delete cascade,
  constraint exam_result_student_same_school_fk foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint exam_result_subject_same_school_fk foreign key (school_id, subject_id)
    references public.subjects(school_id, id) on delete cascade
);

create index if not exists examinations_school_class_idx
  on public.examinations(school_id, class_id, academic_year_id);
create index if not exists exam_results_school_exam_idx
  on public.exam_results(school_id, examination_id);
create index if not exists exam_results_school_student_idx
  on public.exam_results(school_id, student_id);

alter table public.examinations enable row level security;
alter table public.exam_results enable row level security;

drop policy if exists "Examinations role read" on public.examinations;
create policy "Examinations role read" on public.examinations
for select to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]));

drop policy if exists "Examinations leadership manage" on public.examinations;
create policy "Examinations leadership manage" on public.examinations
for all to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]))
with check (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]));

drop policy if exists "Exam results role read" on public.exam_results;
create policy "Exam results role read" on public.exam_results
for select to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]));

drop policy if exists "Exam results teaching staff manage" on public.exam_results;
create policy "Exam results teaching staff manage" on public.exam_results
for all to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]))
with check (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]));

grant select, insert, update, delete on public.examinations, public.exam_results to authenticated;
