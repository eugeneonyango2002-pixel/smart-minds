import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHOOL_ID = "90a8e263-277f-46d3-ab50-a20f63a9eaae";
const ACADEMIC_YEAR_ID = "8e617250-cacd-42c7-b392-9094e7e31d8c";
const TERM_ID = "0ec4cc5c-d858-4f14-8319-6311bb28c60a";
const CLASS_ID = "b2eff6d6-82fb-47fe-90b2-7254fad7e0a4";
const SHEET_ID = "1pO9Pdtsz_XWcu8a1s0t1Xz0hujVS_7_5K7IUkNb3XjVQ";
const SHEET_NAME = "G1";
const EXAM_NAME = "End Term 3";

const SUBJECTS: Record<string, string> = {
  MATH: "Mathematical Activities",
  ENG: "English Language Activities",
  KISW: "Kiswahili Language Activities / Kenya Sign Language (KSL)",
  CRE: "Religious Education (CRE / IRE / HRE)",
  ENVI: "Environmental Activities",
  CREA: "Creative Activities",
};
const READING_COMPONENTS: Record<string, string> = {
  READ: "english_reading",
  KUS: "kiswahili_reading",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function clean(value: unknown) {
  return String(value ?? "").trim();
}
function parseScore(value: unknown, label: string): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const score = Number(raw);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(label + " must be a number from 0 to 100.");
  }
  return score;
}
function remark(score: number) {
  if (score >= 80) return "Excellent achievement. Demonstrates strong understanding and applies learning confidently. Keep extending this excellent work.";
  if (score >= 60) return "Good progress. Demonstrates the expected understanding of the learning area. Keep practising to strengthen and extend these skills.";
  if (score >= 40) return "Making progress but needs more practice to meet the expected outcomes. Focus on the areas covered and seek guidance when needed.";
  return "Needs additional support and regular practice to build understanding of the learning outcomes. Work closely with the teacher on the identified areas.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST requests only." }, 405);

  const expectedToken = Deno.env.get("GOOGLE_SHEETS_SYNC_TOKEN") ?? "";
  const suppliedToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expectedToken || suppliedToken !== expectedToken) {
    return json({ error: "Unauthorized Google Sheets sync request." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration is incomplete." }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    if (body.spreadsheetId !== SHEET_ID || body.sheetName !== SHEET_NAME) {
      return json({ error: "This spreadsheet or worksheet is not authorised for this sync." }, 403);
    }
    const row = body.row as Record<string, unknown>;
    if (!row || typeof row !== "object") throw new Error("A learner row is required.");
    const fullName = clean(row.Name ?? row.name);
    if (!fullName) throw new Error("The Name cell is empty.");
    const nameParts = fullName.split(/\s+/);
    if (nameParts.length < 2) throw new Error("Please enter the learner's full name (at least two names).");
    const firstName = nameParts.shift()!;
    const lastName = nameParts.join(" ");
    const normalized = fullName.toLocaleLowerCase().replace(/\s+/g, " ");

    const { data: existingStudents, error: studentsError } = await db
      .from("students")
      .select("id,first_name,middle_name,last_name,admission_number")
      .eq("school_id", SCHOOL_ID)
      .eq("class_id", CLASS_ID);
    if (studentsError) throw studentsError;

    const matches = (existingStudents ?? []).filter((student) =>
      [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean).join(" ").toLocaleLowerCase().replace(/\s+/g, " ") === normalized
    );
    if (matches.length > 1) throw new Error("More than one Grade 1 learner has this name. Resolve the duplicate in Smart Minds first.");

    let studentId: string;
    let admissionNumber: string;
    if (matches.length === 1) {
      studentId = matches[0].id;
      admissionNumber = matches[0].admission_number;
    } else {
      const year = new Date().getFullYear();
      const prefix = "SM/" + year + "/";
      const next = Math.max(0, ...(existingStudents ?? []).map((s) => {
        const number = clean(s.admission_number);
        const suffix = number.startsWith(prefix) ? number.slice(prefix.length) : "";
        return /^\d+$/.test(suffix) ? Number(suffix) : 0;
      })) + 1;
      admissionNumber = prefix + String(next).padStart(4, "0");
      const { data: created, error: createError } = await db.from("students").insert({
        school_id: SCHOOL_ID,
        admission_number: admissionNumber,
        first_name: firstName,
        middle_name: null,
        last_name: lastName,
        gender: "other",
        admission_date: new Date().toISOString().slice(0, 10),
        class_id: CLASS_ID,
        status: "active",
      }).select("id").single();
      if (createError) throw createError;
      studentId = created.id;
    }

    const { data: exams, error: examLookupError } = await db.from("examinations")
      .select("id").eq("school_id", SCHOOL_ID).eq("academic_year_id", ACADEMIC_YEAR_ID)
      .eq("term_id", TERM_ID).eq("class_id", CLASS_ID).eq("name", EXAM_NAME);
    if (examLookupError) throw examLookupError;
    if ((exams ?? []).length > 1) throw new Error("Duplicate End Term 3 examinations exist for Grade 1, 2027 Term 3.");
    let examId = exams?.[0]?.id;
    if (!examId) {
      const { data: exam, error: examCreateError } = await db.from("examinations").insert({
        school_id: SCHOOL_ID, academic_year_id: ACADEMIC_YEAR_ID, term_id: TERM_ID,
        class_id: CLASS_ID, name: EXAM_NAME, exam_date: new Date().toISOString().slice(0, 10),
        max_score: 100, status: "draft",
      }).select("id").single();
      if (examCreateError) throw examCreateError;
      examId = exam.id;
    }

    const subjectNames = Object.values(SUBJECTS);
    const { data: subjects, error: subjectError } = await db.from("subjects")
      .select("id,name").eq("school_id", SCHOOL_ID).in("name", subjectNames);
    if (subjectError) throw subjectError;
    const subjectByName = new Map((subjects ?? []).map((s) => [s.name, s.id]));
    const { data: allocations, error: allocationError } = await db.from("class_subjects")
      .select("subject_id").eq("school_id", SCHOOL_ID).eq("class_id", CLASS_ID);
    if (allocationError) throw allocationError;
    const allocated = new Set((allocations ?? []).map((a) => a.subject_id));

    let savedLearningAreaMarks = 0;
    let savedReadingMarks = 0;
    for (const [column, subjectName] of Object.entries(SUBJECTS)) {
      const score = parseScore(row[column], column);
      if (score === null) continue;
      const subjectId = subjectByName.get(subjectName);
      if (!subjectId || !allocated.has(subjectId)) {
        throw new Error("The Grade 1 learning area is not configured in Smart Minds: " + subjectName);
      }
      const { error } = await db.from("exam_results").upsert({
        school_id: SCHOOL_ID, examination_id: examId, student_id: studentId,
        subject_id: subjectId, score, remarks: remark(score),
      }, { onConflict: "examination_id,student_id,subject_id" });
      if (error) throw error;
      savedLearningAreaMarks++;
    }

    for (const [column, component] of Object.entries(READING_COMPONENTS)) {
      const score = parseScore(row[column], column);
      if (score === null) continue;
      const { error } = await db.from("reading_assessment_results").upsert({
        school_id: SCHOOL_ID, examination_id: examId, student_id: studentId,
        component, score,
      }, { onConflict: "examination_id,student_id,component" });
      if (error) throw error;
      savedReadingMarks++;
    }

    return json({
      success: true, learner: fullName, admissionNumber, exam: EXAM_NAME,
      learningAreaMarksSaved: savedLearningAreaMarks,
      readingAssessmentMarksSaved: savedReadingMarks,
    });
  } catch (error) {
    console.error("Google Sheets sync failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to sync this learner row." }, 400);
  }
});
