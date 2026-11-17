-- Smart Minds: student promotion, repetition and year rollover history.
-- Run this migration in the Supabase SQL Editor for the Smart Minds project.

create table if not exists public.student_promotion_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  from_academic_year_id uuid,
  to_academic_year_id uuid,
  from_class_id uuid,
  to_class_id uuid,
  action text not null check (action in ('promoted','repeated','graduated','transferred','withdrawn')),
  notes text,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now(),
  constraint promotion_history_student_same_school_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint promotion_history_from_year_same_school_fk
    foreign key (school_id, from_academic_year_id)
    references public.academic_years(school_id, id),
  constraint promotion_history_to_year_same_school_fk
    foreign key (school_id, to_academic_year_id)
    references public.academic_years(school_id, id),
  constraint promotion_history_from_class_same_school_fk
    foreign key (school_id, from_class_id)
    references public.classes(school_id, id),
  constraint promotion_history_to_class_same_school_fk
    foreign key (school_id, to_class_id)
    references public.classes(school_id, id)
);

create index if not exists student_promotion_history_school_date_idx
  on public.student_promotion_history(school_id, performed_at desc);
create index if not exists student_promotion_history_student_idx
  on public.student_promotion_history(school_id, student_id, performed_at desc);

alter table public.student_promotion_history enable row level security;

drop policy if exists "Student promotion history leadership read" on public.student_promotion_history;
create policy "Student promotion history leadership read"
on public.student_promotion_history
for select to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(school_id, array['school_admin','head_teacher']::text[])
);

grant select on public.student_promotion_history to authenticated;

create or replace function public.process_student_promotion(
  p_school_id uuid,
  p_student_ids uuid[],
  p_action text,
  p_to_academic_year_id uuid default null,
  p_to_class_id uuid default null,
  p_to_stream_id uuid default null,
  p_notes text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_from_year_id uuid;
  v_count integer := 0;
  v_target_class_school uuid;
  v_target_stream_class uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to process student progression.';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_school_role(p_school_id, array['school_admin','head_teacher']::text[])
  ) then
    raise exception 'Only the school administrator or headteacher can process student progression.';
  end if;

  if p_action not in ('promoted','repeated','graduated','transferred','withdrawn') then
    raise exception 'Choose a valid student progression action.';
  end if;

  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Select at least one learner.';
  end if;

  if cardinality(p_student_ids) <> (select count(distinct x) from unnest(p_student_ids) as x) then
    raise exception 'The learner selection contains duplicates. Refresh and try again.';
  end if;

  select id into v_from_year_id
  from public.academic_years
  where school_id = p_school_id and is_current = true
  order by start_date desc
  limit 1;

  if p_action in ('promoted','repeated') then
    if p_to_academic_year_id is null or p_to_class_id is null then
      raise exception 'Choose the next academic year and destination class.';
    end if;
    if not exists (
      select 1 from public.academic_years
      where school_id = p_school_id and id = p_to_academic_year_id
    ) then
      raise exception 'The selected academic year does not belong to this school.';
    end if;
    select school_id into v_target_class_school
    from public.classes where id = p_to_class_id;
    if v_target_class_school is distinct from p_school_id then
      raise exception 'The selected destination class does not belong to this school.';
    end if;
    if p_to_stream_id is not null then
      select class_id into v_target_stream_class
      from public.streams
      where id = p_to_stream_id and school_id = p_school_id;
      if v_target_stream_class is distinct from p_to_class_id then
        raise exception 'The selected stream does not belong to the destination class.';
      end if;
    end if;
  elsif p_to_academic_year_id is not null or p_to_class_id is not null or p_to_stream_id is not null then
    raise exception 'A destination class or year is not required for this action.';
  end if;

  for v_student in
    select id, class_id
    from public.students
    where school_id = p_school_id
      and id = any(p_student_ids)
      and status = 'active'
    for update
  loop
    insert into public.student_promotion_history (
      school_id, student_id, from_academic_year_id, to_academic_year_id,
      from_class_id, to_class_id, action, notes, performed_by
    ) values (
      p_school_id, v_student.id, v_from_year_id,
      case when p_action in ('promoted','repeated') then p_to_academic_year_id else null end,
      v_student.class_id,
      case when p_action in ('promoted','repeated') then p_to_class_id else null end,
      p_action, nullif(trim(coalesce(p_notes,'')),''), auth.uid()
    );

    if p_action in ('promoted','repeated') then
      update public.students
      set class_id = p_to_class_id,
          stream_id = p_to_stream_id,
          status = 'active',
          updated_at = now()
      where id = v_student.id and school_id = p_school_id;
    else
      update public.students
      set class_id = null,
          stream_id = null,
          status = p_action,
          updated_at = now()
      where id = v_student.id and school_id = p_school_id;
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count <> cardinality(p_student_ids) then
    raise exception 'Some selected learners were not found or are not active. No changes were saved.';
  end if;

  return v_count;
end;
$$;

revoke all on function public.process_student_promotion(uuid, uuid[], text, uuid, uuid, uuid, text) from public;
grant execute on function public.process_student_promotion(uuid, uuid[], text, uuid, uuid, uuid, text) to authenticated;
