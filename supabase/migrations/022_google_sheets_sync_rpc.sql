-- Smart Minds: perform one spreadsheet learner sync inside PostgreSQL.
-- The Edge Function calls this once per learner using the service role.
create or replace function public.smart_minds_sync_sheet_row(
  p_sheet_name text,
  p_row jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school uuid := '90a8e263-277f-46d3-ab50-a20f63a9eaae';
  v_year uuid := '8e617250-cacd-42c7-b392-9094e7e31d8c';
  v_term uuid := '0ec4cc5c-d858-4f14-8319-6311bb28c60a';
  v_grade text;
  v_stream_name text;
  v_stream uuid;
  v_class uuid;
  v_full_name text;
  v_first text;
  v_last text;
  v_student uuid;
  v_admission text;
  v_exam uuid;
  v_prefix text;
  v_next integer;
  v_count integer;
  v_column text;
  v_subject_name text;
  v_subject uuid;
  v_score numeric;
  v_component text;
  v_saved integer := 0;
  v_reading integer := 0;
  v_remark text;
  v_gender text;
begin
  if p_sheet_name = 'G1' then
    v_grade := 'Grade 1';
  elsif p_sheet_name in ('2B','2G') then
    v_grade := 'Grade 2';
    v_stream_name := right(p_sheet_name,1);
  elsif p_sheet_name in ('3B','3G') then
    v_grade := 'Grade 3';
    v_stream_name := right(p_sheet_name,1);
  else
    raise exception 'Unauthorised worksheet.';
  end if;

  if jsonb_typeof(p_row) <> 'object' then
    raise exception 'Learner row is missing or invalid.';
  end if;

  v_full_name := btrim(coalesce(p_row->>'Name', p_row->>'name',''));
  if v_full_name = '' then raise exception 'Name is required.'; end if;
  if array_length(regexp_split_to_array(v_full_name, '\s+'),1) < 2 then
    raise exception 'Enter at least two names.';
  end if;
  v_first := split_part(v_full_name, ' ', 1);
  v_last := btrim(regexp_replace(v_full_name, '^\S+\s*', ''));

  select id into v_class
  from classes where school_id = v_school and name = v_grade;
  if v_class is null then raise exception 'Class not found: %', v_grade; end if;

  if v_stream_name is not null then
    select id into v_stream from streams
    where school_id = v_school and class_id = v_class and name = v_stream_name;
    if v_stream is null then raise exception 'Stream % is missing.', v_stream_name; end if;
  end if;

  select count(*), min(id), min(admission_number)
    into v_count, v_student, v_admission
  from students
  where school_id = v_school and class_id = v_class
    and stream_id is not distinct from v_stream
    and lower(regexp_replace(trim(concat_ws(' ',first_name,middle_name,last_name)), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(v_full_name), '\s+', ' ', 'g'));

  if v_count > 1 then raise exception 'Duplicate learner name in %.', v_grade; end if;

  if v_count = 0 then
    perform pg_advisory_xact_lock(hashtext(v_school::text), hashtext('student-admission-number'));
    v_prefix := 'SM/' || extract(year from current_date)::integer::text || '/';
    select coalesce(max(
      case when substring(admission_number from length(v_prefix)+1) ~ '^[0-9]+$'
        then substring(admission_number from length(v_prefix)+1)::integer end
    ),0) + 1 into v_next
    from students where school_id = v_school and admission_number like v_prefix || '%';
    v_admission := v_prefix || lpad(v_next::text,4,'0');

    v_gender := lower(btrim(coalesce(p_row->>'Gender',p_row->>'gender','other')));
    if v_gender not in ('male','female','other') then
      raise exception 'Gender must be Male, Female or Other when supplied.';
    end if;

    insert into students (
      school_id, admission_number, first_name, middle_name, last_name,
      gender, admission_date, class_id, stream_id, status
    ) values (
      v_school, v_admission, v_first, null, v_last,
      v_gender, current_date, v_class, v_stream, 'active'
    ) returning id into v_student;
  end if;

  select id into v_exam from examinations
  where school_id = v_school and academic_year_id = v_year
    and term_id = v_term and class_id = v_class and name = 'End Term 3'
  limit 1;

  if v_exam is null then
    insert into examinations (
      school_id, academic_year_id, term_id, class_id, name,
      exam_date, max_score, status
    ) values (
      v_school, v_year, v_term, v_class, 'End Term 3',
      null, 100, 'draft'
    ) returning id into v_exam;
  end if;

  for v_column, v_subject_name in
    select * from (values
      ('MATH','Mathematical Activities'),
      ('ENG','English Language Activities'),
      ('KISW','Kiswahili Language Activities / Kenya Sign Language (KSL)'),
      ('CRE','Religious Education (CRE / IRE / HRE)'),
      ('ENVI','Environmental Activities'),
      ('CREA','Creative Activities')
    ) as mapping(col, subject_name)
  loop
    if nullif(btrim(coalesce(p_row->>v_column,'')),'') is not null then
      if (p_row->>v_column) !~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then
        raise exception '% must be a number from 0 to 100.', v_column;
      end if;
      v_score := btrim(p_row->>v_column)::numeric;
      if v_score < 0 or v_score > 100 then
        raise exception '% must be from 0 to 100.', v_column;
      end if;

      select id into v_subject from subjects
      where school_id = v_school and name = v_subject_name;
      if v_subject is null or not exists (
        select 1 from class_subjects
        where school_id = v_school and class_id = v_class and subject_id = v_subject
      ) then
        raise exception '% missing learning-area allocation: %', v_grade, v_subject_name;
      end if;

      v_remark := case
        when v_score >= 80 then 'Excellent achievement. Demonstrates strong understanding and applies learning confidently. Keep extending this excellent work.'
        when v_score >= 60 then 'Good progress. Demonstrates the expected understanding of the learning area. Keep practising to strengthen and extend these skills.'
        when v_score >= 40 then 'Making progress but needs more practice to meet the expected outcomes. Focus on the areas covered and seek guidance when needed.'
        else 'Needs additional support and regular practice to build understanding of the learning outcomes. Work closely with the teacher on the identified areas.'
      end;

      insert into exam_results (
        school_id, examination_id, student_id, subject_id, score, remarks
      ) values (v_school, v_exam, v_student, v_subject, v_score, v_remark)
      on conflict (examination_id, student_id, subject_id)
      do update set score = excluded.score, remarks = excluded.remarks, updated_at = now();
      v_saved := v_saved + 1;
    end if;
  end loop;

  for v_column, v_component in
    select * from (values ('READ','english_reading'),('KUS','kiswahili_reading')) as reading_map(col, component)
  loop
    if nullif(btrim(coalesce(p_row->>v_column,'')),'') is not null then
      if (p_row->>v_column) !~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then
        raise exception '% must be a number from 0 to 100.', v_column;
      end if;
      v_score := btrim(p_row->>v_column)::numeric;
      if v_score < 0 or v_score > 100 then
        raise exception '% must be from 0 to 100.', v_column;
      end if;

      insert into reading_assessment_results (
        school_id, examination_id, student_id, component, score
      ) values (v_school, v_exam, v_student, v_component, v_score)
      on conflict (examination_id, student_id, component)
      do update set score = excluded.score, updated_at = now();
      v_reading := v_reading + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true, 'learner', v_full_name, 'class', v_grade,
    'stream', v_stream_name, 'sheet', p_sheet_name,
    'admissionNumber', v_admission, 'exam', 'End Term 3',
    'learningAreaMarksSaved', v_saved, 'readingAssessmentMarksSaved', v_reading
  );
end;
$$;

revoke all on function public.smart_minds_sync_sheet_row(text,jsonb) from public, anon, authenticated;
grant execute on function public.smart_minds_sync_sheet_row(text,jsonb) to service_role;
