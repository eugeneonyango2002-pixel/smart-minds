-- Smart Minds Phase 25: Parent accounts and child-scoped read access.
-- Parent authentication users are provisioned separately through a server-side
-- Supabase Edge Function. No passwords are stored in application tables.

create table if not exists public.parent_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  parent_name text not null,
  phone text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_account_school_id_unique unique (school_id, id),
  constraint parent_account_school_user_unique unique (school_id, auth_user_id),
  constraint parent_account_school_phone_unique unique (school_id, phone)
);

create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  parent_account_id uuid not null,
  student_id uuid not null,
  relationship text,
  created_at timestamptz not null default now(),
  constraint parent_student_school_parent_fk
    foreign key (school_id, parent_account_id)
    references public.parent_accounts(school_id, id) on delete cascade,
  constraint parent_student_school_student_fk
    foreign key (school_id, student_id)
    references public.students(school_id, id) on delete cascade,
  constraint parent_student_link_unique unique (parent_account_id, student_id)
);

create index if not exists parent_accounts_user_status_idx
  on public.parent_accounts(auth_user_id, status);
create index if not exists parent_students_parent_idx
  on public.parent_students(parent_account_id);
create index if not exists parent_students_student_idx
  on public.parent_students(student_id);

alter table public.parent_accounts enable row level security;
alter table public.parent_students enable row level security;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.parent_accounts pa
      on pa.school_id = ps.school_id and pa.id = ps.parent_account_id
    where ps.student_id = p_student_id
      and pa.auth_user_id = auth.uid()
      and pa.status = 'active'
  );
$$;

create or replace function public.is_active_parent_in_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.parent_accounts pa
    where pa.school_id = p_school_id
      and pa.auth_user_id = auth.uid()
      and pa.status = 'active'
  );
$$;

revoke all on function public.is_parent_of_student(uuid) from public;
revoke all on function public.is_active_parent_in_school(uuid) from public;
grant execute on function public.is_parent_of_student(uuid) to authenticated;
grant execute on function public.is_active_parent_in_school(uuid) to authenticated;

drop policy if exists "Parent accounts self read" on public.parent_accounts;
create policy "Parent accounts self read" on public.parent_accounts
for select to authenticated
using (auth_user_id = auth.uid() and status = 'active');

drop policy if exists "Parent accounts staff manage" on public.parent_accounts;
create policy "Parent accounts staff manage" on public.parent_accounts
for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]));

drop policy if exists "Parent student links self read" on public.parent_students;
create policy "Parent student links self read" on public.parent_students
for select to authenticated
using (public.is_parent_of_student(student_id));

drop policy if exists "Parent student links staff manage" on public.parent_students;
create policy "Parent student links staff manage" on public.parent_students
for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]));

grant select, insert, update, delete on public.parent_accounts, public.parent_students to authenticated;

-- Parents may read only the learner records explicitly linked to their account.
drop policy if exists "Parents read linked students" on public.students;
create policy "Parents read linked students" on public.students
for select to authenticated
using (public.is_parent_of_student(id));

drop policy if exists "Parents read linked attendance" on public.student_attendance;
create policy "Parents read linked attendance" on public.student_attendance
for select to authenticated
using (public.is_parent_of_student(student_id));

drop policy if exists "Parents read published examinations" on public.examinations;
create policy "Parents read published examinations" on public.examinations
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.students s
    where s.id in (
      select ps.student_id
      from public.parent_students ps
      join public.parent_accounts pa
        on pa.school_id = ps.school_id and pa.id = ps.parent_account_id
      where pa.auth_user_id = auth.uid() and pa.status = 'active'
    )
    and s.school_id = examinations.school_id
    and s.class_id = examinations.class_id
  )
);

drop policy if exists "Parents read linked published results" on public.exam_results;
create policy "Parents read linked published results" on public.exam_results
for select to authenticated
using (
  public.is_parent_of_student(student_id)
  and exists (
    select 1 from public.examinations e
    where e.id = exam_results.examination_id
      and e.school_id = exam_results.school_id
      and e.status = 'published'
  )
);

drop policy if exists "Parents read linked published reading assessments" on public.reading_assessment_results;
create policy "Parents read linked published reading assessments" on public.reading_assessment_results
for select to authenticated
using (
  public.is_parent_of_student(student_id)
  and exists (
    select 1 from public.examinations e
    where e.id = reading_assessment_results.examination_id
      and e.school_id = reading_assessment_results.school_id
      and e.status = 'published'
  )
);

drop policy if exists "Parents read linked fee structures" on public.fee_structures;
create policy "Parents read linked fee structures" on public.fee_structures
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.school_id = fee_structures.school_id
      and s.class_id = fee_structures.class_id
      and public.is_parent_of_student(s.id)
  )
);

drop policy if exists "Parents read linked fee payments" on public.fee_payments;
create policy "Parents read linked fee payments" on public.fee_payments
for select to authenticated
using (public.is_parent_of_student(student_id));
