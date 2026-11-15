-- Smart Minds Phase 3B: Student records
-- Ensure streams has the composite key needed to enforce same-school student placement.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'streams_school_id_unique'
      and conrelid = 'public.streams'::regclass
  ) then
    alter table public.streams
      add constraint streams_school_id_unique unique (school_id, id);
  end if;
end
$$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text not null check (gender in ('male','female','other')),
  date_of_birth date,
  admission_date date not null default current_date,
  class_id uuid,
  stream_id uuid,
  guardian_name text,
  guardian_relationship text,
  guardian_phone text,
  guardian_email text,
  address text,
  status text not null default 'active' check (status in ('active','transferred','graduated','withdrawn','suspended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_admission_number_unique unique (school_id, admission_number),
  constraint student_school_id_unique unique (school_id, id),
  constraint student_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id),
  constraint student_stream_same_school_fk foreign key (school_id, stream_id)
    references public.streams(school_id, id),
  constraint student_stream_requires_class check (stream_id is null or class_id is not null)
);
create index if not exists students_school_idx on public.students(school_id);
create index if not exists students_school_class_idx on public.students(school_id,class_id);
create index if not exists students_name_idx on public.students(school_id,last_name,first_name);
alter table public.students enable row level security;
drop policy if exists "Students school access" on public.students;
create policy "Students school access" on public.students
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));
grant select, insert, update, delete on public.students to authenticated;
