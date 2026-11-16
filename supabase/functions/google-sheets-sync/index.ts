import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHOOL = "90a8e263-277f-46d3-ab50-a20f63a9eaae";
const YEAR = "8e617250-cacd-42c7-b392-9094e7e31d8c";
const TERM = "0ec4cc5c-d858-4f14-8319-6311bb28c60a";
const BOOK = "1X_lq5SjTQVLZUDPZsykRgyPau3Gpz2NP5D9ZusNGWpI";
const EXAM = "End Term 3";

const TABS: Record<string, { grade: string; stream: string | null }> = {
  G1: { grade: "Grade 1", stream: null },
  "2B": { grade: "Grade 2", stream: "B" },
  "2G": { grade: "Grade 2", stream: "G" },
  "3B": { grade: "Grade 3", stream: "B" },
  "3G": { grade: "Grade 3", stream: "G" },
};

const SUBJECTS: Record<string, string> = {
  MATH: "Mathematical Activities",
  ENG: "English Language Activities",
  KISW: "Kiswahili Language Activities / Kenya Sign Language (KSL)",
  CRE: "Religious Education (CRE / IRE / HRE)",
  ENVI: "Environmental Activities",
  CREA: "Creative Activities",
};

const READING: Record<string, string> = {
  READ: "english_reading",
  KUS: "kiswahili_reading",
};

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ");

function getScore(value: unknown, column: string): number | null {
  const text = clean(value);
  if (!text) return null;
  const score = Number(text);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(column + " must be from 0 to 100.");
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
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const secret = Deno.env.get("GOOGLE_SHEETS_SYNC_TOKEN") ?? "";
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || token !== secret) return json({ error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server configuration incomplete." }, 500);

  const db = createClient(url, key, { auth: { persistSession: false } });
  const started = Date.now();
  let stage = "request parsing";

  try {
    const body = await req.json();
    const tab = clean(body.sheetName);
    const config = TABS[tab];

    if (body.spreadsheetId !== BOOK || !config) {
      return json({ error: "Only G1, 2B, 2G, 3B and 3G in the authorised workbook are allowed." }, 403);
    }

    const row = body.row as Record<string, unknown>;
    const fullName = clean(row?.Name ?? row?.name);
    if (!fullName) throw new Error("Name is required.");

    const nameParts = fullName.split(/\s+/);
    if (nameParts.length < 2) throw new Error("Enter at least two names.");

    const firstName = nameParts.shift()!;
    const lastName = nameParts.join(" ");
    const wantedName = norm(fullName);

    stage = "class lookup";
    const { data: classes, error: classError } = await db
      .from("classes")
      .select("id")
      .eq("school_id", SCHOOL)
      .eq("name", config.grade);

    if (classError) throw classError;
    if (classes?.length !== 1) throw new Error("Smart Minds must have exactly one " + config.grade + " class.");
    const classId = classes[0].id;

    let streamId: string | null = null;
    if (config.stream) {
      stage = "stream lookup";
      const { data: streams, error: streamError } = await db
        .from("streams")
        .select("id")
        .eq("school_id", SCHOOL)
        .eq("class_id", classId)
        .eq("name", config.stream);

      if (streamError) throw streamError;
      if (streams?.length !== 1) throw new Error(config.grade + " stream " + config.stream + " is missing or duplicated.");
      streamId = streams[0].id;
    }

    stage = "parallel class data lookup";
    const [studentResult, examResult, subjectResult, allocationResult] = await Promise.all([
      db.from("students")
        .select("id,first_name,middle_name,last_name,admission_number,stream_id")
        .eq("school_id", SCHOOL)
        .eq("class_id", classId),
      db.from("examinations")
        .select("id")
        .eq("school_id", SCHOOL)
        .eq("academic_year_id", YEAR)
        .eq("term_id", TERM)
        .eq("class_id", classId)
        .eq("name", EXAM),
      db.from("subjects")
        .select("id,name")
        .eq("school_id", SCHOOL)
        .in("name", Object.values(SUBJECTS)),
      db.from("class_subjects")
        .select("subject_id")
        .eq("school_id", SCHOOL)
        .eq("class_id", classId),
    ]);

    if (studentResult.error) throw studentResult.error;
    if (examResult.error) throw examResult.error;
    if (subjectResult.error) throw subjectResult.error;
    if (allocationResult.error) throw allocationResult.error;
    if ((examResult.data ?? []).length > 1) throw new Error("Duplicate " + EXAM + " exam for " + config.grade);

    const matchingStudents = (studentResult.data ?? []).filter((student) =>
      norm([student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")) === wantedName &&
      (student.stream_id ?? null) === streamId
    );

    if (matchingStudents.length > 1) {
      throw new Error("Duplicate name in " + config.grade + (config.stream ? " " + config.stream : "") + ". Check Smart Minds first.");
    }

    const subjectIds = new Map((subjectResult.data ?? []).map((subject) => [subject.name, subject.id]));
    const allowedSubjects = new Set((allocationResult.data ?? []).map((item) => item.subject_id));

    const examRows: Record<string, unknown>[] = [];
    const readingRows: Record<string, unknown>[] = [];
    let savedCount = 0;
    let readingCount = 0;

    stage = "mark validation";
    for (const [column, subjectName] of Object.entries(SUBJECTS)) {
      const score = getScore(row[column], column);
      if (score === null) continue;

      const subjectId = subjectIds.get(subjectName);
      if (!subjectId || !allowedSubjects.has(subjectId)) {
        throw new Error(config.grade + " missing learning-area allocation: " + subjectName);
      }

      examRows.push({
        school_id: SCHOOL,
        examination_id: "",
        student_id: "",
        subject_id: subjectId,
        score,
        remarks: remark(score),
      });
      savedCount++;
    }

    for (const [column, component] of Object.entries(READING)) {
      const score = getScore(row[column], column);
      if (score === null) continue;
      readingRows.push({
        school_id: SCHOOL,
        examination_id: "",
        student_id: "",
        component,
        score,
      });
      readingCount++;
    }

    stage = "student registration";
    let studentId: string;
    let admissionNumber: string;

    if (matchingStudents.length === 1) {
      studentId = matchingStudents[0].id;
      admissionNumber = matchingStudents[0].admission_number;
    } else {
      const suppliedGender = norm(clean(row.Gender ?? row.gender));
      const gender = suppliedGender || "other";
      if (!["male", "female", "other"].includes(gender)) {
        throw new Error("Gender must be Male, Female or Other when supplied.");
      }

      const year = new Date().getFullYear();
      const prefix = "SM/" + year + "/";
      const { data: existingAdmissions, error: admissionsError } = await db
        .from("students")
        .select("admission_number")
        .eq("school_id", SCHOOL)
        .like("admission_number", prefix + "%");

      if (admissionsError) throw admissionsError;

      const nextNumber = Math.max(0, ...(existingAdmissions ?? []).map((student) => {
        const suffix = clean(student.admission_number).slice(prefix.length);
        return /^\d+$/.test(suffix) ? Number(suffix) : 0;
      })) + 1;

      admissionNumber = prefix + String(nextNumber).padStart(4, "0");

      const { data: createdStudent, error: insertStudentError } = await db
        .from("students")
        .insert({
          school_id: SCHOOL,
          admission_number: admissionNumber,
          first_name: firstName,
          middle_name: null,
          last_name: lastName,
          gender,
          admission_date: new Date().toISOString().slice(0, 10),
          class_id: classId,
          stream_id: streamId,
          status: "active",
        })
        .select("id")
        .single();

      if (insertStudentError) throw insertStudentError;
      studentId = createdStudent.id;
    }

    stage = "examination setup";
    let examId = examResult.data?.[0]?.id;
    if (!examId) {
      const { data: createdExam, error: insertExamError } = await db
        .from("examinations")
        .insert({
          school_id: SCHOOL,
          academic_year_id: YEAR,
          term_id: TERM,
          class_id: classId,
          name: EXAM,
          exam_date: null,
          max_score: 100,
          status: "draft",
        })
        .select("id")
        .single();

      if (insertExamError) throw insertExamError;
      examId = createdExam.id;
    }

    stage = "bulk mark saving";
    for (const mark of examRows) {
      mark.examination_id = examId;
      mark.student_id = studentId;
    }
    for (const mark of readingRows) {
      mark.examination_id = examId;
      mark.student_id = studentId;
    }

    if (examRows.length) {
      const { error } = await db
        .from("exam_results")
        .upsert(examRows, { onConflict: "examination_id,student_id,subject_id" });
      if (error) throw error;
    }

    if (readingRows.length) {
      const { error } = await db
        .from("reading_assessment_results")
        .upsert(readingRows, { onConflict: "examination_id,student_id,component" });
      if (error) throw error;
    }

    console.log("Google Sheets sync completed", {
      tab,
      learner: fullName,
      elapsedMs: Date.now() - started,
      learningAreaMarksSaved: savedCount,
      readingAssessmentMarksSaved: readingCount,
    });

    return json({
      success: true,
      learner: fullName,
      class: config.grade,
      stream: config.stream,
      sheet: tab,
      admissionNumber,
      exam: EXAM,
      learningAreaMarksSaved: savedCount,
      readingAssessmentMarksSaved: readingCount,
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : (error && typeof error === "object"
        ? [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ")
        : String(error || "Unknown sync error."));

    console.error("Google Sheets sync failed", {
      stage,
      elapsedMs: Date.now() - started,
      error: detail || "Unknown sync error.",
    });

    return json({
      error: detail || "Unknown sync error.",
      stage,
      elapsedMs: Date.now() - started,
    }, 400);
  }
});
