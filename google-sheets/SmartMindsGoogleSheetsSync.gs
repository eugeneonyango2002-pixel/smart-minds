/**
 * Smart Minds automatic Google Sheets sync.
 * Paste this file into Extensions > Apps Script in the spreadsheet.
 * Set Script Properties:
 *   SMART_MINDS_SYNC_URL = https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-sheets-sync
 *   SMART_MINDS_SYNC_TOKEN = the same long random token configured as a Supabase function secret
 */
const SMART_MINDS_SHEET_ID = "1pO9Pdtsz_XWcu8a1s0t1Xz0hujVS_7_5K7IUkNb3XjVQ";
const SMART_MINDS_TAB = "G1";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Smart Minds")
    .addItem("Sync all Grade 1 learners", "syncAllRows")
    .addItem("Install automatic sync", "installSmartMindsTrigger")
    .addToUi();
}

function installSmartMindsTrigger() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getId() !== SMART_MINDS_SHEET_ID) throw new Error("This is not the authorised Smart Minds spreadsheet.");
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "onSmartMindsEdit")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("onSmartMindsEdit").forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getUi().alert("Automatic sync is installed. Changes to learner rows on the G1 tab will be sent to Smart Minds.");
}

function onSmartMindsEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SMART_MINDS_TAB || e.range.getRow() < 2) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    syncOneRow_(sheet, e.range.getRow());
  } finally {
    lock.releaseLock();
  }
}

function syncAllRows() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getId() !== SMART_MINDS_SHEET_ID) throw new Error("This is not the authorised Smart Minds spreadsheet.");
  const sheet = ss.getSheetByName(SMART_MINDS_TAB);
  if (!sheet) throw new Error("The G1 tab was not found.");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("There are no learner rows to sync.");
    return;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let success = 0;
    const failures = [];
    for (let row = 2; row <= lastRow; row++) {
      try {
        const result = syncOneRow_(sheet, row);
        if (result && result.success) success++;
      } catch (err) {
        failures.push("Row " + row + ": " + err.message);
      }
    }
    const summary = success + " learner row(s) synced.";
    SpreadsheetApp.getUi().alert(failures.length ? summary + "\n\nSome rows need attention:\n" + failures.slice(0, 10).join("\n") : summary);
  } finally {
    lock.releaseLock();
  }
}

function syncOneRow_(sheet, rowNumber) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("SMART_MINDS_SYNC_URL");
  const token = props.getProperty("SMART_MINDS_SYNC_TOKEN");
  if (!url || !token) throw new Error("Set SMART_MINDS_SYNC_URL and SMART_MINDS_SYNC_TOKEN in Apps Script project settings first.");
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(h => String(h).trim());
  const values = sheet.getRange(rowNumber, 1, 1, width).getDisplayValues()[0];
  const row = {};
  headers.forEach((header, i) => { if (header) row[header] = values[i]; });
  if (!String(row.Name || "").trim()) return { success: false, skipped: true };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({
      spreadsheetId: SMART_MINDS_SHEET_ID,
      sheetName: SMART_MINDS_TAB,
      row: row
    }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let result;
  try { result = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error("Smart Minds returned an unreadable response (HTTP " + status + ")."); }
  if (status < 200 || status >= 300 || !result.success) {
    throw new Error(result.error || ("Smart Minds sync failed (HTTP " + status + ")."));
  }
  return result;
}
