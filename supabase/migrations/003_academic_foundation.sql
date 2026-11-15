-- Smart Minds Phase 3A: Academic foundation
-- Run this script in Supabase SQL Editor while connected to the smart-minds project.
-- Every academic record is tied to one school; composite foreign keys prevent cross-school links.

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_year_dates_check check (end_date >= start_date),
  constraint academic_year_name_unique unique (school_id, name),
  constraint academic_year_school_id_unique unique (school_id, id)
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint term_dates_check check (end_date >= start_date),
  constraint term_name_unique_per_year unique (academic_year_id, name),
  constraint term_year_same_school_fk foreign key (school_id, academic_year_id)
    references public.academic_years(school_id, id) on delete cascade
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  level text not null default 'primary',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint class_level_check check (level in ('pre_primary', 'primary', 'junior_secondary', 'senior_secondary')),
  constraint class_name_unique unique (school_id, name),
  constraint class_school_id_unique unique (school_id, id)
);

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint stream_name_unique unique (class_id, name),
  constraint stream_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete cascade
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  category text not null default 'core',
  created_at timestamptz not null default now(),
  constraint subject_category_check check (category in ('core', 'optional', 'co_curricular')),
  constraint subject_name_unique unique (school_id, name),
  constraint subject_school_id_unique unique (school_id, id)
);

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  constraint class_subject_unique unique (class_id, subject_id),
  constraint class_subject_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete cascade,
  constraint class_subject_subject_same_school_fk foreign key (school_id, subject_id)
    references public.subjects(school_id, id) on delete cascade
);

create index if not exists academic_years_school_idx on public.academic_years(school_id);
create index if not exists terms_school_year_idx on public.terms(school_id, academic_year_id);
create index if not exists classes_school_idx on public.classes(school_id);
create index if not exists streams_school_class_idx on public.streams(school_id, class_id);
create index if not exists subjects_school_idx on public.subjects(school_id);
create index if not exists class_subjects_school_class_idx on public.class_subjects(school_id, class_id);

alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;

drop policy if exists "Academic years school access" on public.academic_years;
create policy "Academic years school access" on public.academic_years
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "Terms school access" on public.terms;
create policy "Terms school access" on public.terms
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "Classes school access" on public.classes;
create policy "Classes school access" on public.classes
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "Streams school access" on public.streams;
create policy "Streams school access" on public.streams
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "Subjects school access" on public.subjects;
create policy "Subjects school access" on public.subjects
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

drop policy if exists "Class subjects school access" on public.class_subjects;
create policy "Class subjects school access" on public.class_subjects
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

grant select, insert, update, delete on public.academic_years, public.terms, public.classes, public.streams, public.subjects, public.class_subjects to authenticated;
