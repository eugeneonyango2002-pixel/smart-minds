-- Smart Minds Phase 6A: Role-based database access for academic, student and attendance records.
-- Requires 009_staff_login_roles.sql and its public.has_school_role(uuid,text[]) helper.

do $$
begin
  drop policy if exists "Academic years school access" on public.academic_years;
  drop policy if exists "Terms school access" on public.terms;
  drop policy if exists "Classes school access" on public.classes;
  drop policy if exists "Streams school access" on public.streams;
  drop policy if exists "Subjects school access" on public.subjects;
  drop policy if exists "Class subjects school access" on public.class_subjects;
end $$;

-- Remove broad school-member policies before adding role-specific policies.
drop policy if exists "Students school access" on public.students;
drop policy if exists "Students role read" on public.students;
drop policy if exists "Students role manage" on public.students;
create policy "Students role read" on public.students for select to authenticated
using (public.is_platform_admin() or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Students role manage" on public.students for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]));

drop policy if exists "Attendance school access" on public.student_attendance;
drop policy if exists "Attendance role read" on public.student_attendance;
drop policy if exists "Attendance role insert" on public.student_attendance;
drop policy if exists "Attendance role update" on public.student_attendance;
drop policy if exists "Attendance role delete" on public.student_attendance;
create policy "Attendance role read" on public.student_attendance for select to authenticated
using (public.is_platform_admin() or public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role insert" on public.student_attendance for insert to authenticated
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role update" on public.student_attendance for update to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role delete" on public.student_attendance for delete to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher']::text[]));
