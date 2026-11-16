-- Smart Minds: enforce the rationalised CBC/CBE learning-area names for Grades 1–9.
-- Preserves examination marks, timetable records and teacher assignments.
-- PP1/PP2 and Grade 10+ are not changed.

CREATE TEMP TABLE cbc_subject_name_map (
  class_name text NOT NULL,
  old_name text NOT NULL,
  new_name text NOT NULL,
  PRIMARY KEY (class_name, old_name)
) ON COMMIT DROP;

INSERT INTO cbc_subject_name_map VALUES
-- Lower Primary: Grades 1–3
('Grade 1','Creative Activities (Art Craft Music & PE)','Creative Activities'),
('Grade 2','Creative Activities (Art Craft Music & PE)','Creative Activities'),
('Grade 3','Creative Activities (Art Craft Music & PE)','Creative Activities'),
('Grade 1','Kiswahili','Kiswahili Language Activities / Kenya Sign Language (KSL)'),
('Grade 2','Kiswahili','Kiswahili Language Activities / Kenya Sign Language (KSL)'),
('Grade 3','Kiswahili','Kiswahili Language Activities / Kenya Sign Language (KSL)'),
('Grade 1','Environmental Activities (Includes Hygiene & Nutrition)','Environmental Activities'),
('Grade 2','Environmental Activities (Includes Hygiene & Nutrition)','Environmental Activities'),
('Grade 3','Environmental Activities (Includes Hygiene & Nutrition)','Environmental Activities'),
('Grade 1','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 2','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 3','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 1','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 2','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 3','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 1','Indigenous Languages','Indigenous Language Activities'),
('Grade 2','Indigenous Languages','Indigenous Language Activities'),
('Grade 3','Indigenous Languages','Indigenous Language Activities'),
('Grade 1','English','English Language Activities'),
('Grade 2','English','English Language Activities'),
('Grade 3','English','English Language Activities'),
('Grade 1','Mathematics','Mathematical Activities'),
('Grade 2','Mathematics','Mathematical Activities'),
('Grade 3','Mathematics','Mathematical Activities'),
('Grade 1','Environmental Activities','Environmental Activities'),
('Grade 2','Environmental Activities','Environmental Activities'),
('Grade 3','Environmental Activities','Environmental Activities'),
-- Upper Primary: Grades 4–6
('Grade 4','Creative Arts (Art Craft Music & PHE)','Creative Arts'),
('Grade 5','Creative Arts (Art Craft Music & PHE)','Creative Arts'),
('Grade 6','Creative Arts (Art Craft Music & PHE)','Creative Arts'),
('Grade 4','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 5','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 6','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 4','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 5','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 6','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 4','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 5','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 6','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 4','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 5','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 6','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 4','Agriculture and Nutrition','Agriculture and Nutrition'),
('Grade 5','Agriculture and Nutrition','Agriculture and Nutrition'),
('Grade 6','Agriculture and Nutrition','Agriculture and Nutrition'),
-- Junior School: Grades 7–9
('Grade 7','Integrated Science (Biology Chemistry Physics & Health Ed)','Integrated Science'),
('Grade 8','Integrated Science (Biology Chemistry Physics & Health Ed)','Integrated Science'),
('Grade 9','Integrated Science (Biology Chemistry Physics & Health Ed)','Integrated Science'),
('Grade 7','Creative Arts and Sports (Visual Performing Arts & Sports)','Creative Arts and Sports'),
('Grade 8','Creative Arts and Sports (Visual Performing Arts & Sports)','Creative Arts and Sports'),
('Grade 9','Creative Arts and Sports (Visual Performing Arts & Sports)','Creative Arts and Sports'),
('Grade 7','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 8','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 9','Kiswahili','Kiswahili / Kenya Sign Language (KSL)'),
('Grade 7','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 8','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 9','CRE','Religious Education (CRE / IRE / HRE)'),
('Grade 7','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 8','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 9','Religious Education','Religious Education (CRE / IRE / HRE)'),
('Grade 7','Social Studies (History Geography Citizenship & Life Skills)','Social Studies'),
('Grade 8','Social Studies (History Geography Citizenship & Life Skills)','Social Studies'),
('Grade 9','Social Studies (History Geography Citizenship & Life Skills)','Social Studies'),
('Grade 7','Pre-Technical Studies (Pre-Technical Computer & Business)','Pre-Technical Studies'),
('Grade 8','Pre-Technical Studies (Pre-Technical Computer & Business)','Pre-Technical Studies'),
('Grade 9','Pre-Technical Studies (Pre-Technical Computer & Business)','Pre-Technical Studies'),
('Grade 7','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 8','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 9','Agriculture and Nutrition (Agriculture & Home Science)','Agriculture and Nutrition'),
('Grade 7','Agriculture','Agriculture and Nutrition'),
('Grade 8','Agriculture','Agriculture and Nutrition'),
('Grade 9','Agriculture','Agriculture and Nutrition');

-- Create the canonical subjects before moving any existing records.
INSERT INTO public.subjects (school_id, name, code, category, is_examinable)
SELECT DISTINCT c.school_id, m.new_name,
  left(regexp_replace(upper(m.new_name), '[^A-Z0-9]+', '_', 'g'), 20),
  'core', true
FROM public.classes c
JOIN cbc_subject_name_map m ON m.class_name = c.name
ON CONFLICT (school_id, name) DO NOTHING;

-- Stop rather than silently overwrite a learner's mark if both names already have a mark.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.exam_results old_result
    JOIN public.examinations e ON e.id = old_result.examination_id AND e.school_id = old_result.school_id
    JOIN public.classes c ON c.id = e.class_id AND c.school_id = e.school_id
    JOIN cbc_subject_name_map m ON m.class_name = c.name
    JOIN public.subjects old_s ON old_s.id = old_result.subject_id AND old_s.school_id = old_result.school_id AND old_s.name = m.old_name
    JOIN public.subjects new_s ON new_s.school_id = c.school_id AND new_s.name = m.new_name
    JOIN public.exam_results new_result
      ON new_result.examination_id = old_result.examination_id
     AND new_result.student_id = old_result.student_id
     AND new_result.subject_id = new_s.id
     AND new_result.id <> old_result.id
  ) THEN
    RAISE EXCEPTION 'CBC subject update stopped: both old and new subject marks exist for a learner. Please review those duplicate marks before retrying.';
  END IF;
END $$;

-- Remap marks and timetable entries using the class attached to each record.
UPDATE public.exam_results er
SET subject_id = new_s.id
FROM public.examinations e
JOIN public.classes c ON c.id = e.class_id AND c.school_id = e.school_id
JOIN cbc_subject_name_map m ON m.class_name = c.name
JOIN public.subjects old_s ON old_s.school_id = c.school_id AND old_s.name = m.old_name
JOIN public.subjects new_s ON new_s.school_id = c.school_id AND new_s.name = m.new_name
WHERE er.examination_id = e.id AND er.school_id = e.school_id AND er.subject_id = old_s.id;

UPDATE public.timetable_entries te
SET subject_id = new_s.id
FROM public.classes c
JOIN cbc_subject_name_map m ON m.class_name = c.name
JOIN public.subjects old_s ON old_s.school_id = c.school_id AND old_s.name = m.old_name
JOIN public.subjects new_s ON new_s.school_id = c.school_id AND new_s.name = m.new_name
WHERE te.class_id = c.id AND te.school_id = c.school_id AND te.subject_id = old_s.id;

-- Merge duplicate class links while retaining assigned teachers and lesson settings.
UPDATE public.class_subjects target_link
SET teacher_id = COALESCE(target_link.teacher_id, old_link.teacher_id),
    allow_double_lesson = COALESCE(target_link.allow_double_lesson, false) OR COALESCE(old_link.allow_double_lesson, false),
    lessons_per_week = GREATEST(target_link.lessons_per_week, old_link.lessons_per_week)
FROM public.class_subjects old_link
JOIN public.classes c ON c.id = old_link.class_id AND c.school_id = old_link.school_id
JOIN cbc_subject_name_map m ON m.class_name = c.name
JOIN public.subjects old_s ON old_s.id = old_link.subject_id AND old_s.school_id = old_link.school_id AND old_s.name = m.old_name
JOIN public.subjects new_s ON new_s.school_id = old_link.school_id AND new_s.name = m.new_name
WHERE target_link.class_id = old_link.class_id
  AND target_link.school_id = old_link.school_id
  AND target_link.subject_id = new_s.id;

DELETE FROM public.class_subjects old_link
USING public.classes c, public.subjects old_s, cbc_subject_name_map m, public.subjects new_s
WHERE c.id = old_link.class_id AND c.school_id = old_link.school_id
  AND old_s.id = old_link.subject_id AND old_s.school_id = old_link.school_id
  AND m.class_name = c.name AND m.old_name = old_s.name
  AND new_s.school_id = old_link.school_id AND new_s.name = m.new_name
  AND EXISTS (
    SELECT 1 FROM public.class_subjects target_link
    WHERE target_link.class_id = old_link.class_id
      AND target_link.school_id = old_link.school_id
      AND target_link.subject_id = new_s.id
  );

UPDATE public.class_subjects old_link
SET subject_id = new_s.id
FROM public.classes c, public.subjects old_s, cbc_subject_name_map m, public.subjects new_s
WHERE c.id = old_link.class_id AND c.school_id = old_link.school_id
  AND old_s.id = old_link.subject_id AND old_s.school_id = old_link.school_id
  AND m.class_name = c.name AND m.old_name = old_s.name
  AND new_s.school_id = old_link.school_id AND new_s.name = m.new_name
  AND NOT EXISTS (
    SELECT 1 FROM public.class_subjects target_link
    WHERE target_link.class_id = old_link.class_id
      AND target_link.school_id = old_link.school_id
      AND target_link.subject_id = new_s.id
  );

-- PPI is not part of the requested Grades 1–9 learning-area lists.
DELETE FROM public.class_subjects cs
USING public.classes c, public.subjects s
WHERE c.id = cs.class_id AND c.school_id = cs.school_id
  AND c.name IN ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9')
  AND s.id = cs.subject_id AND s.school_id = cs.school_id
  AND s.name = 'Pastoral Programme of Instruction (PPI)';

-- Remove obsolete catalogue rows only after all class links, marks and timetable entries are safely moved.
DELETE FROM public.subjects s
WHERE s.name IN (
  'Creative Activities (Art Craft Music & PE)','English Language Activities',
  'Mathematical Activities','Kiswahili','Environmental Activities (Includes Hygiene & Nutrition)',
  'Environmental Activities','Indigenous Languages','Religious Education','CRE',
  'Creative Arts (Art Craft Music & PHE)','Agriculture and Nutrition (Agriculture & Home Science)',
  'Agriculture','Creative Arts and Sports (Visual Performing Arts & Sports)',
  'Integrated Science (Biology Chemistry Physics & Health Ed)',
  'Social Studies (History Geography Citizenship & Life Skills)',
  'Pre-Technical Studies (Pre-Technical Computer & Business)'
)
AND NOT EXISTS (SELECT 1 FROM public.class_subjects cs WHERE cs.school_id=s.school_id AND cs.subject_id=s.id)
AND NOT EXISTS (SELECT 1 FROM public.exam_results er WHERE er.school_id=s.school_id AND er.subject_id=s.id)
AND NOT EXISTS (SELECT 1 FROM public.timetable_entries te WHERE te.school_id=s.school_id AND te.subject_id=s.id);

-- Make the canonical subject names the only active Grade 1–9 class allocations.
