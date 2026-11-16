-- Smart Minds Phase 8C: approved CBC subject catalogue and weekly allocations.
-- CRE and Kiswahili are the school's selected options. PPI is non-examinable.
-- Unique (school_id, name) on subjects prevents duplicate catalogue rows.

with curriculum(class_name, subject_name, lessons_per_week, category) as (
  values
    ('PP1','Creative Activities',6,'core'),
    ('PP1','Language Activities',5,'core'),
    ('PP1','Mathematical Activities',5,'core'),
    ('PP1','Environmental Activities',5,'core'),
    ('PP1','CRE',3,'core'),
    ('PP1','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('PP2','Creative Activities',6,'core'),
    ('PP2','Language Activities',5,'core'),
    ('PP2','Mathematical Activities',5,'core'),
    ('PP2','Environmental Activities',5,'core'),
    ('PP2','CRE',3,'core'),
    ('PP2','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),

    ('Grade 1','Creative Activities (Art Craft Music & PE)',7,'core'),
    ('Grade 1','English Language Activities',5,'core'),
    ('Grade 1','Mathematical Activities',5,'core'),
    ('Grade 1','Kiswahili',4,'core'),
    ('Grade 1','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),
    ('Grade 1','CRE',3,'core'),
    ('Grade 1','Indigenous Language Activities',2,'core'),
    ('Grade 1','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 2','Creative Activities (Art Craft Music & PE)',7,'core'),
    ('Grade 2','English Language Activities',5,'core'),
    ('Grade 2','Mathematical Activities',5,'core'),
    ('Grade 2','Kiswahili',4,'core'),
    ('Grade 2','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),
    ('Grade 2','CRE',3,'core'),
    ('Grade 2','Indigenous Language Activities',2,'core'),
    ('Grade 2','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 3','Creative Activities (Art Craft Music & PE)',7,'core'),
    ('Grade 3','English Language Activities',5,'core'),
    ('Grade 3','Mathematical Activities',5,'core'),
    ('Grade 3','Kiswahili',4,'core'),
    ('Grade 3','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),
    ('Grade 3','CRE',3,'core'),
    ('Grade 3','Indigenous Language Activities',2,'core'),
    ('Grade 3','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),

    ('Grade 4','Creative Arts (Art Craft Music & PHE)',6,'core'),
    ('Grade 4','English',5,'core'),
    ('Grade 4','Mathematics',5,'core'),
    ('Grade 4','Kiswahili',4,'core'),
    ('Grade 4','Science and Technology',4,'core'),
    ('Grade 4','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 4','Social Studies',3,'core'),
    ('Grade 4','CRE',3,'core'),
    ('Grade 4','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 5','Creative Arts (Art Craft Music & PHE)',6,'core'),
    ('Grade 5','English',5,'core'),
    ('Grade 5','Mathematics',5,'core'),
    ('Grade 5','Kiswahili',4,'core'),
    ('Grade 5','Science and Technology',4,'core'),
    ('Grade 5','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 5','Social Studies',3,'core'),
    ('Grade 5','CRE',3,'core'),
    ('Grade 5','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 6','Creative Arts (Art Craft Music & PHE)',6,'core'),
    ('Grade 6','English',5,'core'),
    ('Grade 6','Mathematics',5,'core'),
    ('Grade 6','Kiswahili',4,'core'),
    ('Grade 6','Science and Technology',4,'core'),
    ('Grade 6','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 6','Social Studies',3,'core'),
    ('Grade 6','CRE',3,'core'),
    ('Grade 6','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),

    ('Grade 7','English',5,'core'),
    ('Grade 7','Mathematics',5,'core'),
    ('Grade 7','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),
    ('Grade 7','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),
    ('Grade 7','Kiswahili',4,'core'),
    ('Grade 7','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),
    ('Grade 7','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),
    ('Grade 7','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 7','CRE',4,'core'),
    ('Grade 7','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 8','English',5,'core'),
    ('Grade 8','Mathematics',5,'core'),
    ('Grade 8','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),
    ('Grade 8','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),
    ('Grade 8','Kiswahili',4,'core'),
    ('Grade 8','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),
    ('Grade 8','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),
    ('Grade 8','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 8','CRE',4,'core'),
    ('Grade 8','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 9','English',5,'core'),
    ('Grade 9','Mathematics',5,'core'),
    ('Grade 9','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),
    ('Grade 9','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),
    ('Grade 9','Kiswahili',4,'core'),
    ('Grade 9','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),
    ('Grade 9','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),
    ('Grade 9','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),
    ('Grade 9','CRE',4,'core'),
    ('Grade 9','Pastoral Programme of Instruction (PPI)',1,'co_curricular')
),
school_subjects as (
  insert into public.subjects (school_id, name, code, category)
  select distinct sc.id, cur.subject_name,
    left(regexp_replace(upper(cur.subject_name), '[^A-Z0-9]+', '_', 'g'), 20),
    cur.category
  from public.schools sc
  cross join curriculum cur
  on conflict (school_id, name) do update
    set category = excluded.category
  returning id, school_id, name
)
insert into public.class_subjects (school_id, class_id, subject_id, lessons_per_week)
select c.school_id, c.id, s.id, cur.lessons_per_week
from curriculum cur
join public.classes c on c.name = cur.class_name
join public.subjects s on s.school_id = c.school_id and s.name = cur.subject_name
on conflict (class_id, subject_id) do update
set lessons_per_week = excluded.lessons_per_week;

-- Correct the lower-primary lesson duration to the supplied 35-minute standard.
update public.cbc_timetable_profiles
set lesson_duration_minutes = 35,
    weekly_total_lessons = 31,
    updated_at = now()
where level_code = 'lower_primary';

-- Ensure every school's profile uses the weekly totals from the supplied curriculum.
update public.cbc_timetable_profiles
set weekly_total_lessons = case level_code
  when 'pre_primary' then 25
  when 'lower_primary' then 31
  when 'upper_primary' then 35
  when 'junior_school' then 41
  else weekly_total_lessons
end,
updated_at = now()
where level_code in ('pre_primary','lower_primary','upper_primary','junior_school');
