/**
 * VIREON LEAD HUB ↔ GOOGLE SHEETS BRIDGE (FINAL)
 *
 * Designed for the user's existing sheet where:
 * - Row 1 contains "LEADS TRACKING SYSTEM"
 * - Row 3 contains the actual column headers
 * - Data validation, dropdown colours and formatting must be preserved
 *
 * Setup:
 * 1. Open the leads spreadsheet → Extensions → Apps Script.
 * 2. Replace the editor contents with this file.
 * 3. Project Settings → Script Properties:
 *      VIREON_SHARED_SECRET = same long secret used in Netlify
 *      VIREON_SHEET_NAME = leads new   (optional; defaults to first sheet)
 *      VIREON_SPREADSHEET_ID = value between /d/ and /edit in the Sheet URL (optional fallback)
 * 4. Deploy → New deployment → Web app.
 *      Execute as: Me
 *      Who has access: Anyone
 */

var REQUIRED_HEADERS_ = [
  'Lead Name',
  'Contact Number',
  'Email',
  'Business Type',
  'Lead Source',
  'Date First Contacted',
  'Current Situation / Remarks',
  'Lead Status',
  'Priority',
  'Next Follow-up Date',
  'Expected Monthly Value',
  'Score',
  'CRM ID'
];

function doGet() {
  return json_({ ok: true, message: 'Vireon Sheets bridge is running.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('VIREON_SHARED_SECRET');
    if (!expected || !constantTimeEqual_(String(payload.secret || ''), String(expected))) {
      return json_({ ok: false, error: 'Unauthorized' });
    }

    var sheet = getSheet_();
    var action = String(payload.action || '');
    if (action === 'test') return test_(sheet);
    if (action === 'pull') return pull_(sheet);
    if (action === 'applyIds') return applyIds_(sheet, payload.assignments || []);
    if (action === 'push') return push_(sheet, payload.rows || []);
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getSheet_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('VIREON_SPREADSHEET_ID');
  var ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet was found. Add VIREON_SPREADSHEET_ID in Script Properties or open Apps Script from the leads spreadsheet.');
  var name = properties.getProperty('VIREON_SHEET_NAME');
  var sheet = name ? ss.getSheetByName(name) : null;
  if (name && !sheet) throw new Error('The sheet tab “' + name + '” was not found. Check VIREON_SHEET_NAME.');
  return sheet || ss.getSheets()[0];
}

function findHeaderRow_(sheet) {
  var scanRows = Math.min(Math.max(sheet.getLastRow(), 1), 25);
  var scanCols = Math.min(Math.max(sheet.getLastColumn(), 10), 30);
  var values = sheet.getRange(1, 1, scanRows, scanCols).getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    var normalized = values[r].map(normalizeHeader_);
    if (normalized.indexOf('lead name') !== -1 && normalized.indexOf('contact number') !== -1) return r + 1;
  }
  throw new Error('Could not find the header row. It must contain “Lead Name” and “Contact Number”.');
}

function ensureHeaders_(sheet, headerRow) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(headerRow, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h || '').trim(); });
  var normalized = headers.map(normalizeHeader_);
  REQUIRED_HEADERS_.forEach(function (header) {
    if (normalized.indexOf(normalizeHeader_(header)) === -1) {
      headers.push(header);
      normalized.push(normalizeHeader_(header));
      sheet.getRange(headerRow, headers.length).setValue(header);
    }
  });
  return headers;
}

function headerMap_(headers) {
  var map = {};
  headers.forEach(function (header, index) { map[normalizeHeader_(header)] = index + 1; });
  return map;
}

function test_(sheet) {
  var headerRow = findHeaderRow_(sheet);
  var headers = ensureHeaders_(sheet, headerRow);
  return json_({
    ok: true,
    message: 'Connected to “' + sheet.getName() + '”. Header row detected at row ' + headerRow + '.',
    spreadsheetName: sheet.getParent().getName(),
    spreadsheetId: sheet.getParent().getId(),
    sheetName: sheet.getName(),
    headerRow: headerRow,
    headers: headers,
    dataRows: Math.max(0, sheet.getLastRow() - headerRow)
  });
}

function pull_(sheet) {
  var headerRow = findHeaderRow_(sheet);
  var headers = ensureHeaders_(sheet, headerRow);
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return json_({ ok: true, headers: headers, rows: [], count: 0, headerRow: headerRow });

  var width = headers.length;
  var values = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, width).getDisplayValues();
  var crmIndex = headers.map(normalizeHeader_).indexOf('crm id');
  var rows = [];
  values.forEach(function (row, offset) {
    var hasLeadName = String(row[headers.map(normalizeHeader_).indexOf('lead name')] || '').trim() !== '';
    if (!hasLeadName && !row.some(function (cell) { return String(cell || '').trim() !== ''; })) return;
    var obj = { _rowNumber: headerRow + 1 + offset };
    headers.forEach(function (header, index) { obj[header] = row[index] == null ? '' : row[index]; });
    obj._crmId = crmIndex >= 0 ? String(row[crmIndex] || '').trim() : '';
    rows.push(obj);
  });

  return json_({ ok: true, headers: headers, rows: rows, count: rows.length, headerRow: headerRow, sheetName: sheet.getName() });
}

function applyIds_(sheet, assignments) {
  var headerRow = findHeaderRow_(sheet);
  var headers = ensureHeaders_(sheet, headerRow);
  var map = headerMap_(headers);
  var crmCol = map['crm id'];
  var applied = 0;
  assignments.forEach(function (item) {
    var rowNumber = Number(item.rowNumber || 0);
    var crmId = String(item.crmId || '').trim();
    if (rowNumber > headerRow && crmId) {
      sheet.getRange(rowNumber, crmCol).setValue(crmId);
      applied++;
    }
  });
  return json_({ ok: true, count: applied, message: 'Linked ' + applied + ' sheet row(s) to Vireon CRM.' });
}

function push_(sheet, rows) {
  var headerRow = findHeaderRow_(sheet);
  var headers = ensureHeaders_(sheet, headerRow);
  var map = headerMap_(headers);
  var lastRow = sheet.getLastRow();
  var existingById = {};
  var existingByPhone = {};
  var existingByEmail = {};
  var crmCol = map['crm id'];
  var phoneCol = map['contact number'];
  var emailCol = map['email'];

  if (lastRow > headerRow) {
    var existingValues = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, headers.length).getDisplayValues();
    existingValues.forEach(function (row, index) {
      var sheetRow = headerRow + 1 + index;
      var id = String(row[crmCol - 1] || '').trim();
      var phone = normalizePhone_(phoneCol ? row[phoneCol - 1] : '');
      var email = normalizeEmail_(emailCol ? row[emailCol - 1] : '');
      if (id && !existingById[id]) existingById[id] = sheetRow;
      if (phone && !existingByPhone[phone]) existingByPhone[phone] = sheetRow;
      if (email && !existingByEmail[email]) existingByEmail[email] = sheetRow;
    });
  }

  var updated = 0;
  var appended = 0;
  var linkedByContact = 0;
  var writableHeaders = REQUIRED_HEADERS_.filter(function (h) { return map[normalizeHeader_(h)]; });

  rows.forEach(function (row) {
    var crmId = String(row['CRM ID'] || '').trim();
    if (!crmId) return;
    var phone = normalizePhone_(row['Contact Number']);
    var email = normalizeEmail_(row['Email']);
    var rowNumber = existingById[crmId];
    if (!rowNumber && phone) rowNumber = existingByPhone[phone];
    if (!rowNumber && email) rowNumber = existingByEmail[email];

    if (!rowNumber) {
      rowNumber = Math.max(sheet.getLastRow() + 1, headerRow + 1);
      prepareNewRow_(sheet, rowNumber, headerRow, headers.length);
      appended++;
    } else {
      if (!existingById[crmId]) linkedByContact++;
      updated++;
    }

    existingById[crmId] = rowNumber;
    if (phone) existingByPhone[phone] = rowNumber;
    if (email) existingByEmail[email] = rowNumber;

    writableHeaders.forEach(function (header) {
      var col = map[normalizeHeader_(header)];
      var value = row[header] == null ? '' : row[header];
      sheet.getRange(rowNumber, col).setValue(value);
    });
  });

  return json_({
    ok: true,
    count: rows.length,
    updated: updated,
    appended: appended,
    linkedByContact: linkedByContact,
    message: 'Google Sheet synchronized: ' + updated + ' updated, ' + appended + ' added. Existing formatting and dropdowns were preserved.'
  });
}


function prepareNewRow_(sheet, rowNumber, headerRow, width) {
  var templateRow = rowNumber - 1;
  if (templateRow <= headerRow) return;
  var template = sheet.getRange(templateRow, 1, 1, width);
  var target = sheet.getRange(rowNumber, 1, 1, width);
  if (typeof template.copyFormatToRange === 'function') {
    template.copyFormatToRange(sheet, 1, width, rowNumber, rowNumber);
  }
  if (typeof template.getDataValidations === 'function' && typeof target.setDataValidations === 'function') {
    target.setDataValidations(template.getDataValidations());
  }
}

function normalizePhone_(value) {
  return String(value || '').replace(/\D/g, '').replace(/^977/, '');
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
