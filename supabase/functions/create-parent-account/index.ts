import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") || "";
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply({ error: "Sign in required." }, 401);

  const input = await request.json();
  const schoolId = String(input.school_id || "");
  const name = String(input.parent_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const studentIds = Array.isArray(input.student_ids) ? [...new Set(input.student_ids.map(String))] : [];
  if (!schoolId || !name || !email || !phone || password.length < 8 || !studentIds.length) {
    return reply({ error: "Complete all fields and select at least one learner. Password must be 8 characters or more." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter a valid parent email address." }, 400);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return reply({ error: "Use international phone format, e.g. +2547XXXXXXXX." }, 400);

  const { data: staff } = await caller.from("staff_login_accounts").select("role")
    .eq("auth_user_id", authData.user.id).eq("school_id", schoolId).eq("status", "active").maybeSingle();
  if (!staff || !["school_admin", "head_teacher", "secretary"].includes(staff.role)) {
    return reply({ error: "You are not authorised to create parent accounts." }, 403);
  }

  const admin = createClient(url, service);
  const { data: learners, error: learnersError } = await caller
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", studentIds);

  if (learnersError) {
    return reply({
      error: "Unable to verify selected learners with your staff access: " + learnersError.message,
    }, 400);
  }

  if (!learners || learners.length !== studentIds.length) {
    return reply({
      error: "One or more selected learners could not be verified in this school. Refresh the learner list and select them again.",
    }, 400);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name, account_type: "parent" },
  });
  if (createError || !created.user) return reply({ error: createError?.message || "Unable to create login." }, 400);

  const { data: account, error: accountError } = await admin.from("parent_accounts").insert({
    school_id: schoolId, auth_user_id: created.user.id, parent_name: name, email, phone,
    status: "active", created_by: authData.user.id,
  }).select("id").single();
  if (accountError || !account) {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply({ error: accountError?.message || "Unable to save parent account." }, 400);
  }

  const links = studentIds.map((student_id) => ({
    school_id: schoolId, parent_account_id: account.id, student_id,
    relationship: String(input.relationship || "Parent"),
  }));
  const { error: linksError } = await admin.from("parent_students").insert(links);
  if (linksError) {
    await admin.from("parent_accounts").delete().eq("id", account.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return reply({ error: linksError.message }, 400);
  }

  return reply({ success: true, message: "Parent account created." });
});
