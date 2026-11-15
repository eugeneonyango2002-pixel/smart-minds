-- Smart Minds Phase 6C: Allow school leadership to view staff records for their own school.
-- This is deliberately a SELECT-only policy; it does not grant staff editing privileges.
alter table public.staff enable row level security;

drop policy if exists "Staff leadership read" on public.staff;

create policy "Staff leadership read"
on public.staff
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_school_role(
    school_id,
    array['school_admin','head_teacher']::text[]
  )
);
