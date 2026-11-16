-- Smart Minds Phase 8B: CBC/CBE timetable planning foundations.
-- Supports automatic timetable generation for PP1, PP2 and Grades 1-9.
-- Existing manual timetable entries and existing class/subject links are preserved.

alter table public.class_subjects
  add column if not exists lessons_per_week smallint,
  add column if not exists teacher_id uuid,
  add column if not exists allow_double_lesson boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'class_subject_teacher_same_school_fk'
      and conrelid = 'public.class_subjects'::regclass
  ) then
    alter table public.class_subjects
      add constraint class_subject_teacher_same_school_fk
      foreign key (school_id, teacher_id)
      references public.staff(school_id, id)
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'class_subject_lessons_per_week_check'
      and conrelid = 'public.class_subjects'::regclass
  ) then
    alter table public.class_subjects
      add constraint class_subject_lessons_per_week_check
      check (lessons_per_week is null or lessons_per_week between 1 and 15);
  end if;
end $$;

create index if not exists class_subjects_teacher_idx
  on public.class_subjects(school_id, teacher_id);

-- Seed standard weekly lesson allocations for the current Kenyan CBC/CBE
-- learning-area catalogue. PPI is scheduled separately by the generator.
update public.class_subjects cs
set lessons_per_week = case
  when c.name in ('PP1','PP2') and s.name = 'Language Activities' then 5
  when c.name in ('PP1','PP2') and s.name = 'Mathematical Activities' then 5
  when c.name in ('PP1','PP2') and s.name = 'Environmental Activities' then 5
  when c.name in ('PP1','PP2') and s.name = 'Psychomotor and Creative Activities' then 6
  when c.name in ('PP1','PP2') and s.name = 'Religious Education Activities' then 3

  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Indigenous Languages' then 2
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Kiswahili / Kenya Sign Language' then 4
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'English' then 5
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Mathematics' then 5
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Environmental Activities' then 4
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Creative Activities' then 7
  when c.name in ('Grade 1','Grade 2','Grade 3') and s.name = 'Religious Education' then 3

  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'English' then 5
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Kiswahili / Kenya Sign Language' then 4
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Mathematics' then 5
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Science and Technology' then 4
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Social Studies' then 3
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Agriculture and Nutrition' then 4
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Creative Arts' then 6
  when c.name in ('Grade 4','Grade 5','Grade 6') and s.name = 'Religious Education' then 3

  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'English' then 5
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Kiswahili / Kenya Sign Language' then 4
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Mathematics' then 5
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Integrated Science' then 5
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Social Studies' then 4
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Pre-Technical Studies' then 4
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Agriculture' then 4
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Creative Arts and Sports' then 5
  when c.name in ('Grade 7','Grade 8','Grade 9') and s.name = 'Religious Education' then 4
  else cs.lessons_per_week
end,
allow_double_lesson = (
  c.name in ('Grade 7','Grade 8','Grade 9')
  and s.name in ('Integrated Science','Pre-Technical Studies','Agriculture','Creative Arts and Sports')
)
from public.classes c
join public.subjects s on s.id = cs.subject_id and s.school_id = cs.school_id
where c.id = cs.class_id
  and c.school_id = cs.school_id;

create table if not exists public.cbc_timetable_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level_code text not null,
  reporting_time time not null,
  lesson_start_time time not null,
  school_end_time time not null,
  lesson_duration_minutes smallint not null,
  lessons_per_day smallint not null,
  weekly_total_lessons smallint not null,
  first_break_after_period smallint not null,
  first_break_minutes smallint not null,
  second_break_after_period smallint not null,
  second_break_minutes smallint not null,
  lunch_after_period smallint,
  lunch_minutes smallint not null default 0,
  allow_practical_double_lessons boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cbc_profile_level_check
    check (level_code in ('pre_primary','lower_primary','upper_primary','junior_school')),
  constraint cbc_profile_durations_check
    check (
      lesson_duration_minutes > 0
      and lessons_per_day > 0
      and weekly_total_lessons >= lessons_per_day
      and first_break_minutes >= 0
      and second_break_minutes >= 0
      and (lunch_after_period is null or lunch_after_period > 0)
      and lunch_minutes >= 0
    ),
  constraint cbc_profile_school_level_unique unique (school_id, level_code),
  constraint cbc_profile_school_id_unique unique (school_id, id)
);

alter table public.cbc_timetable_profiles enable row level security;

drop policy if exists "CBC timetable profiles read" on public.cbc_timetable_profiles;
create policy "CBC timetable profiles read" on public.cbc_timetable_profiles
for select to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher','teacher'
]::text[]));

drop policy if exists "CBC timetable profiles leadership manage" on public.cbc_timetable_profiles;
create policy "CBC timetable profiles leadership manage" on public.cbc_timetable_profiles
for all to authenticated
using (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]))
with check (public.has_school_role(school_id, array[
  'school_admin','head_teacher','deputy_head_teacher'
]::text[]));

grant select, insert, update, delete on public.cbc_timetable_profiles to authenticated;

-- Defaults from the Ministry of Education Guidelines for Timetabling and
-- Curriculum Based Establishment in Competency Based Education.
-- Schools may adjust these profiles to fit approved local arrangements.
insert into public.cbc_timetable_profiles (
  school_id, level_code, reporting_time, lesson_start_time, school_end_time,
  lesson_duration_minutes, lessons_per_day, weekly_total_lessons,
  first_break_after_period, first_break_minutes,
  second_break_after_period, second_break_minutes, lunch_after_period, lunch_minutes,
  allow_practical_double_lessons
)
select
  sc.id, p.level_code, p.reporting_time, p.lesson_start_time, p.school_end_time,
  p.lesson_duration_minutes, p.lessons_per_day, p.weekly_total_lessons,
  p.first_break_after_period, p.first_break_minutes,
  p.second_break_after_period, p.second_break_minutes, p.lunch_after_period, p.lunch_minutes,
  p.allow_practical_double_lessons
from public.schools sc
cross join (values
  ('pre_primary',   time '08:30', time '09:00', time '12:00', 30, 5, 25, 2, 10, 4, 20, null, 0, false),
  ('lower_primary', time '08:00', time '08:20', time '12:30', 30, 6, 31, 2, 10, 4, 30, null, 0, false),
  ('upper_primary', time '08:00', time '08:20', time '14:35', 35, 7, 35, 2, 20, 4, 30, 6, 80, false),
  ('junior_school', time '08:00', time '08:20', time '15:20', 40, 8, 41, 2, 10, 4, 30, 6, 60, true)
) as p(
  level_code, reporting_time, lesson_start_time, school_end_time,
  lesson_duration_minutes, lessons_per_day, weekly_total_lessons,
  first_break_after_period, first_break_minutes,
  second_break_after_period, second_break_minutes, lunch_after_period, lunch_minutes,
  allow_practical_double_lessons
)
on conflict (school_id, level_code) do nothing;

create index if not exists cbc_timetable_profiles_school_idx
  on public.cbc_timetable_profiles(school_id, level_code);
