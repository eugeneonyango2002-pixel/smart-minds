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
  const isUsingOwnAccount = email === String(authData.user.email || "").trim().toLowerCase();
  if (!schoolId || !name || !email || !phone || (!isUsingOwnAccount && password.length < 8) || !studentIds.length) {
    return reply({ error: "Complete all fields and select at least one learner. A password of 8 characters or more is required only when creating a separate parent login." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter a valid parent email address." }, 400);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return reply({ error: "Use international phone format, e.g. +2547XXXXXXXX." }, 400);

  const { data: platformAdmin, error: platformAdminError } = await caller.rpc("is_platform_admin");
  const { data: staff } = await caller.from("staff_login_accounts").select("role")
    .eq("auth_user_id", authData.user.id).eq("school_id", schoolId).eq("status", "active").maybeSingle();
  const isAuthorisedStaff = Boolean(staff && ["school_admin", "head_teacher", "secretary"].includes(staff.role));
  if (platformAdminError) {
    return reply({ error: "Unable to verify platform administrator permissions: " + platformAdminError.message }, 403);
  }
  if (!Boolean(platformAdmin) && !isAuthorisedStaff) {
    return reply({
      error: "Permission check did not recognise this account. Platform administrator: " + String(Boolean(platformAdmin)) + "; school staff role: " + String(staff?.role || "not linked") + "."
    }, 403);
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

  // Resolve an existing login before attempting to create one. This avoids
  // duplicate-email errors and only reuses the currently signed-in account.
  let parentAuthUserId = authData.user.id;
  let reusedExistingLogin = email === String(authData.user.email || "").trim().toLowerCase();
  let createdNewAuthUser = false;

  if (!reusedExistingLogin) {
    let matchingUser: { id: string; email?: string } | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) return reply({ error: "Unable to check existing login: " + listError.message }, 500);
      matchingUser = usersPage.users.find((user) => String(user.email || "").trim().toLowerCase() === email) || null;
      if (matchingUser || usersPage.users.length < 1000) break;
    }

    if (matchingUser) {
      if (matchingUser.id !== authData.user.id) {
        return reply({ error: "This email already belongs to a different login. Sign in with that account to link it as a parent, or use another email for a separate parent account." }, 409);
      }
      reusedExistingLogin = true;
      parentAuthUserId = matchingUser.id;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: name, account_type: "parent" },
      });
      if (createError || !created.user) return reply({ error: createError?.message || "Unable to create login." }, 400);
      parentAuthUserId = created.user.id;
      createdNewAuthUser = true;
    }
  }

  const { data: account, error: accountError } = await admin.from("parent_accounts").upsert({
    school_id: schoolId, auth_user_id: parentAuthUserId, parent_name: name, email, phone,
    status: "active", created_by: authData.user.id,
  }, { onConflict: "school_id,auth_user_id" }).select("id").single();
  if (accountError || !account) {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(parentAuthUserId);
    return reply({ error: accountError?.message || "Unable to save parent account." }, 400);
  }

  const links = studentIds.map((student_id) => ({
    school_id: schoolId, parent_account_id: account.id, student_id,
    relationship: String(input.relationship || "Parent"),
  }));
  const { error: linksError } = await admin.from("parent_students").upsert(links, {
    onConflict: "parent_account_id,student_id",
    ignoreDuplicates: true,
  });
  if (linksError) {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(parentAuthUserId);
    return reply({ error: linksError.message }, 400);
  }

  return reply({
    success: true,
    message: reusedExistingLogin ? "Parent access linked to your existing login." : "Parent account created.",
    reused_existing_login: reusedExistingLogin,
  });
});
