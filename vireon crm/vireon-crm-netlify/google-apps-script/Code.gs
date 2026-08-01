/**
 * Vireon CRM ↔ Google Sheets bridge.
 * 1. Open the leads sheet.
 * 2. Extensions → Apps Script.
 * 3. Paste this file.
 * 4. Project Settings → Script Properties:
 *      VIREON_SHARED_SECRET = the same long secret used in Netlify.
 *      VIREON_SHEET_NAME = Leads (optional; defaults to first sheet).
 * 5. Deploy → New deployment → Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 */
function doGet() {
  return json_({ ok: true, message: 'Vireon Sheets bridge is running.' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('VIREON_SHARED_SECRET');
    if (!expected || payload.secret !== expected) return json_({ ok: false, error: 'Unauthorized' });
    var sheet = getSheet_();
    if (payload.action === 'test') return json_({ ok: true, message: 'Connected to ' + sheet.getName() });
    if (payload.action === 'pull') return pull_(sheet);
    if (payload.action === 'push') return push_(sheet, payload.rows || []);
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = PropertiesService.getScriptProperties().getProperty('VIREON_SHEET_NAME');
  return name ? (ss.getSheetByName(name) || ss.getSheets()[0]) : ss.getSheets()[0];
}

function pull_(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return json_({ ok: true, headers: [], rows: [], count: 0 });
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var rows = values.slice(1).filter(function(row) { return row.some(function(cell) { return String(cell).trim() !== ''; }); }).map(function(row) {
    var obj = {};
    headers.forEach(function(header, index) { obj[header] = row[index] || ''; });
    return obj;
  });
  return json_({ ok: true, headers: headers, rows: rows, count: rows.length });
}

function push_(sheet, rows) {
  var defaultHeaders = ['Lead Name','Contact Number','Email','Business Type','Lead Source','Date First Contacted','Current Situation / Remarks','Lead Status','Priority','Next Follow-up Date','Expected Monthly Value','Score'];
  var headers = rows.length ? Object.keys(rows[0]) : defaultHeaders;
  var output = [headers].concat(rows.map(function(row) { return headers.map(function(header) { return row[header] == null ? '' : row[header]; }); }));
  sheet.clearContents();
  if (output.length) sheet.getRange(1, 1, output.length, headers.length).setValues(output);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  return json_({ ok: true, count: rows.length, message: 'Sheet updated from Vireon CRM.' });
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
