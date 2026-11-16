import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BOOK = "1X_lq5SjTQVLZUDPZsykRgyPau3Gpz2NP5D9ZusNGWpI";
const ALLOWED_TABS = ["G1", "2B", "2G", "3B", "3G"];

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const secret = Deno.env.get("GOOGLE_SHEETS_SYNC_TOKEN") ?? "";
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || token !== secret) return json({ error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server configuration incomplete." }, 500);

  try {
    const body = await req.json();
    const sheetName = String(body?.sheetName ?? "").trim();

    if (body?.spreadsheetId !== BOOK || !ALLOWED_TABS.includes(sheetName)) {
      return json({
        error: "Only G1, 2B, 2G, 3B and 3G in the authorised workbook are allowed.",
      }, 403);
    }

    if (!body?.row || typeof body.row !== "object" || Array.isArray(body.row)) {
      return json({ error: "Learner row is missing or invalid." }, 400);
    }

    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("smart_minds_sync_sheet_row", {
      p_sheet_name: sheetName,
      p_row: body.row,
    });

    if (error) {
      console.error("Database spreadsheet sync failed:", error);
      return json({
        error: error.message,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null,
      }, 400);
    }

    return json(data ?? { success: false, error: "Database sync returned no result." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Google Sheets sync request failed:", message);
    return json({ error: message || "Unknown sync error." }, 400);
  }
});
