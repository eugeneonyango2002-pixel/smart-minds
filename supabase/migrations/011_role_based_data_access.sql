-- Smart Minds Phase 6A: Role-based database access for academic, student and attendance records.
-- Requires migrations 003, 004, 005 and 009 to have been run.
-- Safe to run more than once: policies are dropped before being recreated.

-- Academic reference tables: staff may read; school leadership may manage.
drop policy if exists "Academic years school access" on public.academic_years;
drop policy if exists "Academic read" on public.academic_years;
drop policy if exists "Academic manage" on public.academic_years;
create policy "Academic read" on public.academic_years for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.academic_years for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

drop policy if exists "Terms school access" on public.terms;
drop policy if exists "Academic read" on public.terms;
drop policy if exists "Academic manage" on public.terms;
create policy "Academic read" on public.terms for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.terms for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

drop policy if exists "Classes school access" on public.classes;
drop policy if exists "Academic read" on public.classes;
drop policy if exists "Academic manage" on public.classes;
create policy "Academic read" on public.classes for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.classes for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

drop policy if exists "Streams school access" on public.streams;
drop policy if exists "Academic read" on public.streams;
drop policy if exists "Academic manage" on public.streams;
create policy "Academic read" on public.streams for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.streams for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

drop policy if exists "Subjects school access" on public.subjects;
drop policy if exists "Academic read" on public.subjects;
drop policy if exists "Academic manage" on public.subjects;
create policy "Academic read" on public.subjects for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.subjects for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

drop policy if exists "Class subjects school access" on public.class_subjects;
drop policy if exists "Academic read" on public.class_subjects;
drop policy if exists "Academic manage" on public.class_subjects;
create policy "Academic read" on public.class_subjects for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary']::text[]));
create policy "Academic manage" on public.class_subjects for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher']::text[]));

-- Students: teachers and school office staff can view; school admin, head teacher and secretary can manage.
drop policy if exists "Students school access" on public.students;
drop policy if exists "Students role read" on public.students;
drop policy if exists "Students role manage" on public.students;
create policy "Students role read" on public.students for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Students role manage" on public.students for all to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','secretary']::text[]));

-- Attendance: teaching and school leadership roles can read and record; only school admin/head teacher can delete.
drop policy if exists "Attendance school access" on public.student_attendance;
drop policy if exists "Attendance role read" on public.student_attendance;
drop policy if exists "Attendance role insert" on public.student_attendance;
drop policy if exists "Attendance role update" on public.student_attendance;
drop policy if exists "Attendance role delete" on public.student_attendance;
create policy "Attendance role read" on public.student_attendance for select to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role insert" on public.student_attendance for insert to authenticated
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role update" on public.student_attendance for update to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]))
with check (public.has_school_role(school_id, array['school_admin','head_teacher','deputy_head_teacher','teacher','secretary']::text[]));
create policy "Attendance role delete" on public.student_attendance for delete to authenticated
using (public.has_school_role(school_id, array['school_admin','head_teacher']::text[]));
