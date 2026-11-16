# Smart Minds Google Sheets import — Lower Primary

Only this copied workbook and tabs G1, 2B, 2G, 3B and 3G are accepted. Other tabs are ignored.

| Tab | Class | Stream |
|---|---|---|
| G1 | Grade 1 | None |
| 2B | Grade 2 | B |
| 2G | Grade 2 | G |
| 3B | Grade 3 | B |
| 3G | Grade 3 | G |

Headers in each tab: Name, MATH, ENG, READ, KISW, KUS, CRE, ENVI, CREA. MATH, ENG, KISW, CRE, ENVI and CREA map to the matching lower-primary CBC learning areas. READ and KUS are separate English and Kiswahili reading assessments. Scores are out of 100. Exam is End Term 3, 2027 Term 3.

The Edge Function validates the copied workbook ID and the five-tab allowlist, then resolves class and stream records from Smart Minds. It matches learners within their exact class/stream. It creates an exam per class and upserts results.

Apps Script uses @OnlyCurrentDoc to request current-workbook access rather than all spreadsheets. This narrows permissions but does not remove Google's unverified-app warning. Rotate the previously shared bearer token in Supabase and Apps Script before live use.

Deploy the Edge Function as google-sheets-sync with JWT verification disabled. Set SMART_MINDS_SYNC_URL and SMART_MINDS_SYNC_TOKEN in Apps Script Project Settings. Replace Code.gs with SmartMindsGoogleSheetsSync.gs, save and reload. Install automatic sync, then use the individual Smart Minds menu items to import one class at a time.
