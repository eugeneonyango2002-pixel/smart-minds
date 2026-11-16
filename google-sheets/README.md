# Google Sheets → Smart Minds (Grade 1)

This integration is configured for the supplied spreadsheet, the `G1` tab, Mulwakhi Primary & Junior School, Grade 1, academic year 2027, Term 3, and the `End Term 3` examination (maximum 100).

## Data mapping

| Sheet column | Smart Minds destination |
| --- | --- |
| Name | Match an existing Grade 1 learner by full name, or register the learner if no exact match exists |
| MATH | Mathematical Activities |
| ENG | English Language Activities |
| KISW | Kiswahili Language Activities / Kenya Sign Language (KSL) |
| CRE | Religious Education (CRE / IRE / HRE) |
| ENVI | Environmental Activities |
| CREA | Creative Activities |
| READ | Separate English reading assessment |
| KUS | Separate Kiswahili reading assessment (Kusoma) |

READ and KUS are stored in `reading_assessment_results`, not as extra CBC learning areas. Blank score cells are ignored; a later nonblank edit updates the same learner/exam/learning-area result. Scores must be from 0 to 100. New learners receive an admission number in the current calendar-year format `SM/YYYY/0001` and are assigned to Grade 1. Gender is recorded as `other / not specified` because the sheet does not contain a gender column.

## Setup (required before data is sent)

1. In Supabase SQL Editor, run `supabase/migrations/021_reading_assessment_results.sql`.
2. Deploy the Edge Function at `supabase/functions/google-sheets-sync/index.ts` as `google-sheets-sync`.
   - Supabase Dashboard → Edge Functions → create/deploy the function.
   - Ensure JWT verification is disabled for this function because the Apps Script uses its own long random bearer token. If deploying with the CLI, use `supabase functions deploy google-sheets-sync --no-verify-jwt`.
3. In Supabase Edge Function secrets, set `GOOGLE_SHEETS_SYNC_TOKEN` to a newly generated long random secret (at least 32 random characters). Do not send this token in chat or commit it to GitHub. The function uses the project's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets.
4. Open the supplied Google Sheet → Extensions → Apps Script. Copy the contents of `google-sheets/SmartMindsGoogleSheetsSync.gs` into the editor and save.
5. In Apps Script → Project Settings → Script Properties, add:
   - `SMART_MINDS_SYNC_URL` = `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-sheets-sync`
   - `SMART_MINDS_SYNC_TOKEN` = the same secret set in Supabase.
6. Reload the spreadsheet. Use the **Smart Minds → Install automatic sync** menu and approve Google's permission prompt.
7. First use **Smart Minds → Sync all Grade 1 learners** to send the existing rows. After that, edits to learner rows on the `G1` tab are sent automatically.

## Safety and behaviour

- The endpoint only accepts the exact configured spreadsheet ID and `G1` worksheet.
- The service-role key stays inside Supabase and is never placed in Apps Script or the public website.
- Repeated row updates update existing result rows rather than adding duplicate marks.
- Learners are matched by exact normalised full name within Grade 1. If the same name matches multiple learners, the row is rejected for manual review.
- Do not rename the sheet headers or tab without updating the integration.
- Clearing a score cell does not delete an existing result; blank values are ignored to avoid accidental data loss.
- This integration is configured for this school's Grade 1 sheet only. Do not reuse its endpoint for another school or class.
