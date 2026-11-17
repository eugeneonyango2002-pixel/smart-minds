-- Smart Minds: secure record and school deletion controls
-- Run this migration in the Supabase SQL Editor before using the new Delete buttons.

create or replace function public.delete_school_record(
  p_school_id uuid,
  p_entity text,
  p_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_platform_admin();
  v_headteacher boolean := public.has_school_role(p_school_id, array['head_teacher']::text[]);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete records.';
  end if;

  if p_entity = 'school' then
    if not v_admin then
      raise exception 'Only the Super Admin can delete a school.';
    end if;
    if p_record_id is distinct from p_school_id then
      raise exception 'School confirmation did not match.';
    end if;
    -- Remove restrictive finance dependencies first. Other school-owned
    -- records are removed by their school_id ON DELETE CASCADE constraints.
    delete from public.fee_payments where school_id = p_school_id;
    delete from public.fee_structures where school_id = p_school_id;
    delete from public.schools where id = p_school_id;
    if not found then raise exception 'School not found or already deleted.'; end if;
    return true;
  end if;

  if not v_admin and not v_headteacher then
    raise exception 'Only the Super Admin or Headteacher can delete school records.';
  end if;

  if p_entity not in (
    'student','staff','examination','exam_result',
    'student_attendance','staff_attendance','staff_leave_request',
    'parent_account','fee_payment'
  ) then
    raise exception 'This record type cannot be deleted here.';
  end if;

  case p_entity
    when 'student' then
      delete from public.students where school_id = p_school_id and id = p_record_id;
    when 'staff' then
      delete from public.staff where school_id = p_school_id and id = p_record_id;
    when 'examination' then
      delete from public.examinations where school_id = p_school_id and id = p_record_id;
    when 'exam_result' then
      delete from public.exam_results where school_id = p_school_id and id = p_record_id;
    when 'student_attendance' then
      delete from public.student_attendance where school_id = p_school_id and id = p_record_id;
    when 'staff_attendance' then
      delete from public.staff_attendance where school_id = p_school_id and id = p_record_id;
    when 'staff_leave_request' then
      delete from public.staff_leave_requests where school_id = p_school_id and id = p_record_id;
    when 'parent_account' then
      delete from public.parent_accounts where school_id = p_school_id and id = p_record_id;
    when 'fee_payment' then
      delete from public.fee_payments where school_id = p_school_id and id = p_record_id;
  end case;

  if not found then raise exception 'Record not found or already deleted.'; end if;
  return true;
end;
$$;

revoke all on function public.delete_school_record(uuid,text,uuid) from public;
grant execute on function public.delete_school_record(uuid,text,uuid) to authenticated;
