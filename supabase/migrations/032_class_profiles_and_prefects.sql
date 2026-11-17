-- Smart Minds: class profiles, class teachers and gender-balanced prefects.
create table if not exists public.class_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  class_teacher_id uuid,
  boy_prefect_id uuid,
  girl_prefect_id uuid,
  class_motto text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_profile_one_per_class unique (school_id, class_id),
  constraint class_profile_school_id_unique unique (school_id, id),
  constraint class_profile_class_same_school_fk foreign key (school_id, class_id)
    references public.classes(school_id, id) on delete cascade,
  constraint class_profile_teacher_same_school_fk foreign key (school_id, class_teacher_id)
    references public.staff(school_id, id),
  constraint class_profile_boy_prefect_same_school_fk foreign key (school_id, boy_prefect_id)
    references public.students(school_id, id),
  constraint class_profile_girl_prefect_same_school_fk foreign key (school_id, girl_prefect_id)
    references public.students(school_id, id) on delete set null,
  constraint class_profile_distinct_prefects check (
    boy_prefect_id is null or girl_prefect_id is null or boy_prefect_id <> girl_prefect_id
  )
);

create index if not exists class_profiles_school_class_idx
  on public.class_profiles(school_id, class_id);

create or replace function public.validate_class_profile_assignments()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.class_teacher_id is not null and not exists (
    select 1 from public.staff
    where id = new.class_teacher_id and school_id = new.school_id
      and staff_role = 'teacher' and status = 'active'
  ) then
    raise exception 'Choose an active teacher registered in this school.';
  end if;

  if new.boy_prefect_id is not null and not exists (
    select 1 from public.students
    where id = new.boy_prefect_id and school_id = new.school_id
      and class_id = new.class_id and gender = 'male' and status = 'active'
  ) then
    raise exception 'The boy prefect must be an active male learner in this class.';
  end if;

  if new.girl_prefect_id is not null and not exists (
    select 1 from public.students
    where id = new.girl_prefect_id and school_id = new.school_id
      and class_id = new.class_id and gender = 'female' and status = 'active'
  ) then
    raise exception 'The girl prefect must be an active female learner in this class.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists class_profile_validate_assignments on public.class_profiles;
create trigger class_profile_validate_assignments
before insert or update on public.class_profiles
for each row execute function public.validate_class_profile_assignments();

alter table public.class_profiles enable row level security;
drop policy if exists "Class profiles school access" on public.class_profiles;
create policy "Class profiles school access" on public.class_profiles
for all to authenticated
using (public.is_platform_admin() or public.is_school_member(school_id))
with check (public.is_platform_admin() or public.is_school_member(school_id));

grant select, insert, update, delete on public.class_profiles to authenticated;
