-- Smart Minds Phase 6B: Let authenticated staff see only their linked school.
-- This is needed by school selectors in staff workspaces.
alter table public.schools enable row level security;

drop policy if exists "Staff can view their linked school" on public.schools;
create policy "Staff can view their linked school"
on public.schools
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(
    id,
    array['school_admin','head_teacher','deputy_head_teacher','teacher','bursar','secretary','support_staff']::text[]
  )
);
