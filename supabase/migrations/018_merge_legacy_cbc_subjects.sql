-- Smart Minds Phase 8D: merge legacy CBC subject names safely.
-- Run AFTER 017_approved_cbc_subject_catalogue.sql.
-- Preserves exam marks, timetable rows, teacher assignments and class links.

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_examinable boolean NOT NULL DEFAULT true;

UPDATE public.subjects
SET is_examinable = false
WHERE name = 'Pastoral Programme of Instruction (PPI)';

CREATE TEMP TABLE subject_name_map (
  class_name text NOT NULL,
  old_name text NOT NULL,
  new_name text NOT NULL,
  PRIMARY KEY (class_name, old_name)
) ON COMMIT DROP;

INSERT INTO subject_name_map (class_name, old_name, new_name) VALUES
  ('PP1','Psychomotor and Creative Activities','Creative Activities'),
  ('PP2','Psychomotor and Creative Activities','Creative Activities'),
  ('PP1','Religious Education Activities','CRE'),
  ('PP2','Religious Education Activities','CRE'),
  ('Grade 1','Creative Activities','Creative Activities (Art Craft Music & PE)'),
  ('Grade 2','Creative Activities','Creative Activities (Art Craft Music & PE)'),
  ('Grade 3','Creative Activities','Creative Activities (Art Craft Music & PE)'),
  ('Grade 1','English','English Language Activities'),
  ('Grade 2','English','English Language Activities'),
  ('Grade 3','English','English Language Activities'),
  ('Grade 1','Environmental Activities','Environmental Activities (Includes Hygiene & Nutrition)'),
  ('Grade 2','Environmental Activities','Environmental Activities (Includes Hygiene & Nutrition)'),
  ('Grade 3','Environmental Activities','Environmental Activities (Includes Hygiene & Nutrition)'),
  ('Grade 1','Indigenous Languages','Indigenous Language Activities'),
  ('Grade 2','Indigenous Languages','Indigenous Language Activities'),
  ('Grade 3','Indigenous Languages','Indigenous Language Activities'),
  ('Grade 1','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 2','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 3','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 1','Mathematics','Mathematical Activities'),
  ('Grade 2','Mathematics','Mathematical Activities'),
  ('Grade 3','Mathematics','Mathematical Activities'),
  ('Grade 1','Religious Education','CRE'),
  ('Grade 2','Religious Education','CRE'),
  ('Grade 3','Religious Education','CRE'),
  ('Grade 4','Creative Arts','Creative Arts (Art Craft Music & PHE)'),
  ('Grade 5','Creative Arts','Creative Arts (Art Craft Music & PHE)'),
  ('Grade 6','Creative Arts','Creative Arts (Art Craft Music & PHE)'),
  ('Grade 4','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 5','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 6','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 4','Religious Education','CRE'),
  ('Grade 5','Religious Education','CRE'),
  ('Grade 6','Religious Education','CRE'),
  ('Grade 4','Agriculture and Nutrition','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 5','Agriculture and Nutrition','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 6','Agriculture and Nutrition','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 7','Agriculture','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 8','Agriculture','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 9','Agriculture','Agriculture and Nutrition (Agriculture & Home Science)'),
  ('Grade 7','Creative Arts and Sports','Creative Arts and Sports (Visual Performing Arts & Sports)'),
  ('Grade 8','Creative Arts and Sports','Creative Arts and Sports (Visual Performing Arts & Sports)'),
  ('Grade 9','Creative Arts and Sports','Creative Arts and Sports (Visual Performing Arts & Sports)'),
  ('Grade 7','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 8','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 9','Kiswahili / Kenya Sign Language','Kiswahili'),
  ('Grade 7','Religious Education','CRE'),
  ('Grade 8','Religious Education','CRE'),
  ('Grade 9','Religious Education','CRE'),
  ('Grade 7','Integrated Science','Integrated Science (Biology Chemistry Physics & Health Ed)'),
  ('Grade 8','Integrated Science','Integrated Science (Biology Chemistry Physics & Health Ed)'),
  ('Grade 9','Integrated Science','Integrated Science (Biology Chemistry Physics & Health Ed)'),
  ('Grade 7','Social Studies','Social Studies (History Geography Citizenship & Life Skills)'),
  ('Grade 8','Social Studies','Social Studies (History Geography Citizenship & Life Skills)'),
  ('Grade 9','Social Studies','Social Studies (History Geography Citizenship & Life Skills)'),
  ('Grade 7','Pre-Technical Studies','Pre-Technical Studies (Pre-Technical Computer & Business)'),
  ('Grade 8','Pre-Technical Studies','Pre-Technical Studies (Pre-Technical Computer & Business)'),
  ('Grade 9','Pre-Technical Studies','Pre-Technical Studies (Pre-Technical Computer & Business)');

-- Ensure every target subject exists before moving references.
INSERT INTO public.subjects (school_id, name, code, category, is_examinable)
SELECT DISTINCT sc.id, cur.subject_name,
  left(regexp_replace(upper(cur.subject_name), '[^A-Z0-9]+', '_', 'g'), 20),
  cur.category,
  cur.subject_name <> 'Pastoral Programme of Instruction (PPI)'
FROM public.schools sc
CROSS JOIN (
  SELECT DISTINCT new_name AS subject_name,
    CASE WHEN new_name = 'Pastoral Programme of Instruction (PPI)' THEN 'co_curricular' ELSE 'core' END AS category
  FROM subject_name_map
  UNION
  SELECT 'CRE', 'core'
  UNION
  SELECT 'Kiswahili', 'core'
  UNION
  SELECT 'Pastoral Programme of Instruction (PPI)', 'co_curricular'
) cur
ON CONFLICT (school_id, name) DO UPDATE
SET category = EXCLUDED.category,
    is_examinable = EXCLUDED.is_examinable;

-- Preserve historical examination results by remapping each result through its examination's class.
UPDATE public.exam_results er
SET subject_id = target.id
FROM public.examinations e
JOIN public.classes c ON c.id = e.class_id AND c.school_id = e.school_id
JOIN subject_name_map m ON m.class_name = c.name
JOIN public.subjects old_s ON old_s.name = m.old_name AND old_s.school_id = c.school_id
JOIN public.subjects target ON target.name = m.new_name AND target.school_id = c.school_id
WHERE er.examination_id = e.id
  AND er.school_id = e.school_id
  AND er.subject_id = old_s.id
  AND NOT EXISTS (
    SELECT 1 FROM public.exam_results already
    WHERE already.examination_id = er.examination_id
      AND already.student_id = er.student_id
      AND already.subject_id = target.id
      AND already.id <> er.id
  );

-- Stop safely rather than overwrite marks if both old and new subject results exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.exam_results er
    JOIN public.examinations e ON e.id = er.examination_id AND e.school_id = er.school_id
    JOIN public.classes c ON c.id = e.class_id AND c.school_id = e.school_id
    JOIN subject_name_map m ON m.class_name = c.name
    JOIN public.subjects old_s ON old_s.name = m.old_name AND old_s.school_id = c.school_id
    JOIN public.subjects target ON target.name = m.new_name AND target.school_id = c.school_id
    JOIN public.exam_results already
      ON already.examination_id = er.examination_id
     AND already.student_id = er.student_id
     AND already.subject_id = target.id
     AND already.id <> er.id
    WHERE er.subject_id = old_s.id
  ) THEN
    RAISE EXCEPTION 'Subject migration stopped: duplicate old/new examination results need manual review before merging.';
  END IF;
END $$;

-- Remap timetable records by class; current school data has none, but preserve any future/history rows.
UPDATE public.timetable_entries te
SET subject_id = target.id
FROM public.classes c
JOIN subject_name_map m ON m.class_name = c.name
JOIN public.subjects old_s ON old_s.name = m.old_name AND old_s.school_id = c.school_id
JOIN public.subjects target ON target.name = m.new_name AND target.school_id = c.school_id
WHERE te.class_id = c.id
  AND te.school_id = c.school_id
  AND te.subject_id = old_s.id;

-- Merge duplicate class-subject links into the approved link, retaining any teacher assignment.
UPDATE public.class_subjects target_link
SET teacher_id = COALESCE(target_link.teacher_id, old_link.teacher_id),
    allow_double_lesson = target_link.allow_double_lesson OR old_link.allow_double_lesson,
    lessons_per_week = CASE
      WHEN c.name IN ('PP1','PP2') AND m.new_name = 'Creative Activities' THEN 6
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Creative Activities (Art Craft Music & PE)' THEN 7
      ELSE target_link.lessons_per_week
    END
FROM public.class_subjects old_link
JOIN public.classes c ON c.id = old_link.class_id
JOIN public.subjects old_s ON old_s.id = old_link.subject_id AND old_s.school_id = old_link.school_id
JOIN subject_name_map m ON m.class_name = c.name AND m.old_name = old_s.name
JOIN public.subjects new_s ON new_s.school_id = old_link.school_id AND new_s.name = m.new_name
WHERE target_link.class_id = old_link.class_id
  AND target_link.school_id = old_link.school_id
  AND target_link.subject_id = new_s.id;

DELETE FROM public.class_subjects old_link
USING public.classes c, public.subjects old_s, subject_name_map m, public.subjects new_s
WHERE c.id = old_link.class_id
  AND c.school_id = old_link.school_id
  AND old_s.id = old_link.subject_id
  AND old_s.school_id = old_link.school_id
  AND m.class_name = c.name
  AND m.old_name = old_s.name
  AND new_s.school_id = old_link.school_id
  AND new_s.name = m.new_name
  AND EXISTS (
    SELECT 1 FROM public.class_subjects target_link
    WHERE target_link.class_id = old_link.class_id
      AND target_link.school_id = old_link.school_id
      AND target_link.subject_id = new_s.id
  );

-- Move any remaining old class links where no approved target link exists.
UPDATE public.class_subjects old_link
SET subject_id = new_s.id,
    lessons_per_week = CASE
      WHEN c.name IN ('PP1','PP2') AND m.new_name = 'Creative Activities' THEN 6
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Creative Activities (Art Craft Music & PE)' THEN 7
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'English Language Activities' THEN 5
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Mathematical Activities' THEN 5
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Kiswahili' THEN 4
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Environmental Activities (Includes Hygiene & Nutrition)' THEN 4
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'Indigenous Language Activities' THEN 2
      WHEN c.name IN ('Grade 1','Grade 2','Grade 3') AND m.new_name = 'CRE' THEN 3
      WHEN c.name IN ('Grade 4','Grade 5','Grade 6') AND m.new_name = 'Creative Arts (Art Craft Music & PHE)' THEN 6
      WHEN c.name IN ('Grade 4','Grade 5','Grade 6') AND m.new_name = 'Kiswahili' THEN 4
      WHEN c.name IN ('Grade 4','Grade 5','Grade 6') AND m.new_name = 'CRE' THEN 3
      WHEN c.name IN ('Grade 7','Grade 8','Grade 9') AND m.new_name = 'CRE' THEN 4
      WHEN c.name IN ('Grade 7','Grade 8','Grade 9') AND m.new_name = 'Kiswahili' THEN 4
      ELSE old_link.lessons_per_week
    END
FROM public.classes c, public.subjects old_s, subject_name_map m, public.subjects new_s
WHERE c.id = old_link.class_id
  AND c.school_id = old_link.school_id
  AND old_s.id = old_link.subject_id
  AND old_s.school_id = old_link.school_id
  AND m.class_name = c.name
  AND m.old_name = old_s.name
  AND new_s.school_id = old_link.school_id
  AND new_s.name = m.new_name
  AND NOT EXISTS (
    SELECT 1 FROM public.class_subjects target_link
    WHERE target_link.class_id = old_link.class_id
      AND target_link.school_id = old_link.school_id
      AND target_link.subject_id = new_s.id
  );

-- Ensure the approved weekly allocations and PPI are present for each existing PP1–Grade 9 class.
WITH curriculum(class_name, subject_name, lessons_per_week, category) AS (
  VALUES
    ('PP1','Creative Activities',6,'core'),('PP1','Language Activities',5,'core'),('PP1','Mathematical Activities',5,'core'),('PP1','Environmental Activities',5,'core'),('PP1','CRE',3,'core'),('PP1','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('PP2','Creative Activities',6,'core'),('PP2','Language Activities',5,'core'),('PP2','Mathematical Activities',5,'core'),('PP2','Environmental Activities',5,'core'),('PP2','CRE',3,'core'),('PP2','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 1','Creative Activities (Art Craft Music & PE)',7,'core'),('Grade 1','English Language Activities',5,'core'),('Grade 1','Mathematical Activities',5,'core'),('Grade 1','Kiswahili',4,'core'),('Grade 1','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),('Grade 1','CRE',3,'core'),('Grade 1','Indigenous Language Activities',2,'core'),('Grade 1','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 2','Creative Activities (Art Craft Music & PE)',7,'core'),('Grade 2','English Language Activities',5,'core'),('Grade 2','Mathematical Activities',5,'core'),('Grade 2','Kiswahili',4,'core'),('Grade 2','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),('Grade 2','CRE',3,'core'),('Grade 2','Indigenous Language Activities',2,'core'),('Grade 2','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 3','Creative Activities (Art Craft Music & PE)',7,'core'),('Grade 3','English Language Activities',5,'core'),('Grade 3','Mathematical Activities',5,'core'),('Grade 3','Kiswahili',4,'core'),('Grade 3','Environmental Activities (Includes Hygiene & Nutrition)',4,'core'),('Grade 3','CRE',3,'core'),('Grade 3','Indigenous Language Activities',2,'core'),('Grade 3','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 4','Creative Arts (Art Craft Music & PHE)',6,'core'),('Grade 4','English',5,'core'),('Grade 4','Mathematics',5,'core'),('Grade 4','Kiswahili',4,'core'),('Grade 4','Science and Technology',4,'core'),('Grade 4','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 4','Social Studies',3,'core'),('Grade 4','CRE',3,'core'),('Grade 4','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 5','Creative Arts (Art Craft Music & PHE)',6,'core'),('Grade 5','English',5,'core'),('Grade 5','Mathematics',5,'core'),('Grade 5','Kiswahili',4,'core'),('Grade 5','Science and Technology',4,'core'),('Grade 5','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 5','Social Studies',3,'core'),('Grade 5','CRE',3,'core'),('Grade 5','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 6','Creative Arts (Art Craft Music & PHE)',6,'core'),('Grade 6','English',5,'core'),('Grade 6','Mathematics',5,'core'),('Grade 6','Kiswahili',4,'core'),('Grade 6','Science and Technology',4,'core'),('Grade 6','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 6','Social Studies',3,'core'),('Grade 6','CRE',3,'core'),('Grade 6','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 7','English',5,'core'),('Grade 7','Mathematics',5,'core'),('Grade 7','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),('Grade 7','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),('Grade 7','Kiswahili',4,'core'),('Grade 7','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),('Grade 7','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),('Grade 7','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 7','CRE',4,'core'),('Grade 7','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 8','English',5,'core'),('Grade 8','Mathematics',5,'core'),('Grade 8','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),('Grade 8','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),('Grade 8','Kiswahili',4,'core'),('Grade 8','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),('Grade 8','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),('Grade 8','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 8','CRE',4,'core'),('Grade 8','Pastoral Programme of Instruction (PPI)',1,'co_curricular'),
    ('Grade 9','English',5,'core'),('Grade 9','Mathematics',5,'core'),('Grade 9','Integrated Science (Biology Chemistry Physics & Health Ed)',5,'core'),('Grade 9','Creative Arts and Sports (Visual Performing Arts & Sports)',5,'core'),('Grade 9','Kiswahili',4,'core'),('Grade 9','Social Studies (History Geography Citizenship & Life Skills)',4,'core'),('Grade 9','Pre-Technical Studies (Pre-Technical Computer & Business)',4,'core'),('Grade 9','Agriculture and Nutrition (Agriculture & Home Science)',4,'core'),('Grade 9','CRE',4,'core'),('Grade 9','Pastoral Programme of Instruction (PPI)',1,'co_curricular')
)
INSERT INTO public.class_subjects (school_id, class_id, subject_id, lessons_per_week)
SELECT c.school_id, c.id, s.id, cur.lessons_per_week
FROM curriculum cur
JOIN public.classes c ON c.name = cur.class_name
JOIN public.subjects s ON s.school_id = c.school_id AND s.name = cur.subject_name
ON CONFLICT (class_id, subject_id) DO UPDATE
SET lessons_per_week = EXCLUDED.lessons_per_week;

-- Remove only legacy subjects that are now unreferenced. Keep any subject still used by senior classes.
DELETE FROM public.subjects s
WHERE s.name IN (
  'Psychomotor and Creative Activities','Religious Education Activities',
  'Creative Activities','English','Environmental Activities','Indigenous Languages',
  'Kiswahili / Kenya Sign Language','Mathematics','Religious Education',
  'Creative Arts','Agriculture and Nutrition','Agriculture','Creative Arts and Sports',
  'Integrated Science','Social Studies','Pre-Technical Studies'
)
AND NOT EXISTS (SELECT 1 FROM public.class_subjects cs WHERE cs.school_id=s.school_id AND cs.subject_id=s.id)
AND NOT EXISTS (SELECT 1 FROM public.exam_results er WHERE er.school_id=s.school_id AND er.subject_id=s.id)
AND NOT EXISTS (SELECT 1 FROM public.timetable_entries te WHERE te.school_id=s.school_id AND te.subject_id=s.id);

-- Apply correct timetable profile values supplied for the Kenyan CBC curriculum.
UPDATE public.cbc_timetable_profiles
SET lesson_duration_minutes = CASE level_code
      WHEN 'pre_primary' THEN 30
      WHEN 'lower_primary' THEN 35
      WHEN 'upper_primary' THEN 35
      WHEN 'junior_school' THEN 40
      ELSE lesson_duration_minutes
    END,
    weekly_total_lessons = CASE level_code
      WHEN 'pre_primary' THEN 25
      WHEN 'lower_primary' THEN 31
      WHEN 'upper_primary' THEN 35
      WHEN 'junior_school' THEN 41
      ELSE weekly_total_lessons
    END,
    updated_at = now()
WHERE level_code IN ('pre_primary','lower_primary','upper_primary','junior_school');
