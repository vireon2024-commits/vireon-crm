import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs/promises'

let code = await fs.readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
code += '\n;globalThis.__sheetTests = { findHeaderRow_, ensureHeaders_, pull_, push_, applyIds_, prepareNewRow_, normalizePhone_, normalizeEmail_ };'

class Range {
  constructor(sheet, row, col, numRows = 1, numCols = 1) { Object.assign(this, { sheet, row, col, numRows, numCols }) }
  getDisplayValues() {
    const rows = []
    for (let r = 0; r < this.numRows; r++) {
      const values = []
      for (let c = 0; c < this.numCols; c++) values.push(String(this.sheet.get(this.row + r, this.col + c) ?? ''))
      rows.push(values)
    }
    return rows
  }
  setValue(value) { this.sheet.set(this.row, this.col, value); return this }
  copyFormatToRange() { this.sheet.formatCopies = (this.sheet.formatCopies || 0) + 1; return this }
  getDataValidations() { return Array.from({ length: this.numRows }, () => Array(this.numCols).fill(null)) }
  setDataValidations() { this.sheet.validationCopies = (this.sheet.validationCopies || 0) + 1; return this }
}

class MockSheet {
  constructor(values) { this.values = values.map(row => [...row]); this.name = 'leads new' }
  get(row, col) { return this.values[row - 1]?.[col - 1] ?? '' }
  set(row, col, value) {
    while (this.values.length < row) this.values.push([])
    while (this.values[row - 1].length < col) this.values[row - 1].push('')
    this.values[row - 1][col - 1] = value
  }
  getLastRow() {
    let last = 0
    this.values.forEach((row, i) => { if (row.some(cell => String(cell ?? '').trim() !== '')) last = i + 1 })
    return last
  }
  getLastColumn() { return Math.max(1, ...this.values.map(row => row.length)) }
  getRange(row, col, numRows = 1, numCols = 1) { return new Range(this, row, col, numRows, numCols) }
  getName() { return this.name }
  getParent() { return { getName: () => 'Vireon Leads', getId: () => 'sheet-id' } }
}

const context = {
  console,
  JSON,
  String,
  Number,
  Math,
  Array,
  Object,
  Error,
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  LockService: { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) },
  SpreadsheetApp: {},
}
vm.createContext(context)
vm.runInContext(code, context, { filename:'Code.gs' })
const t = context.__sheetTests

const sheet = new MockSheet([
  ['LEADS TRACKING SYSTEM'],
  [],
  ['Lead Name','Contact Number','Email','Business Type','Lead Source','Date First Contacted','Current Situation / Remarks','Lead Status','Priority','Next Follow-up Date'],
  ['Euro School','9801836581','','School','Vacancy','7/24/2026','Proposal sent','Negotiating','High','need to call back'],
  ['crownedunepal','9800000001','','Clothing','Coldcall','','','To call','Medium',''],
])

assert.equal(t.findHeaderRow_(sheet), 3)
const headers = t.ensureHeaders_(sheet, 3)
assert.equal(headers.includes('CRM ID'), true)
assert.equal(headers.includes('Expected Monthly Value'), true)
assert.equal(sheet.getLastRow(), 5)

let output = t.pull_(sheet)
let pulled = JSON.parse(output.text)
assert.equal(pulled.count, 2)
assert.equal(pulled.rows[0]._rowNumber, 4)
assert.equal(pulled.rows[0]['Lead Name'], 'Euro School')

output = t.push_(sheet, [
  { 'Lead Name':'Euro School', 'Contact Number':'9801836581', 'Email':'', 'Business Type':'School', 'Lead Source':'Vacancy', 'Date First Contacted':'7/24/2026', 'Current Situation / Remarks':'Updated', 'Lead Status':'waiting response', 'Priority':'High', 'Next Follow-up Date':'8/3/2026', 'Expected Monthly Value':25000, 'Score':80, 'CRM ID':'aaaaaaaa-aaaa-4aaa-8aaa-000000000001' },
  { 'Lead Name':'crownedunepal', 'Contact Number':'9800000099', 'Email':'', 'Business Type':'Clothing', 'Lead Source':'Coldcall', 'Date First Contacted':'', 'Current Situation / Remarks':'Separate contact', 'Lead Status':'To call', 'Priority':'Medium', 'Next Follow-up Date':'', 'Expected Monthly Value':'', 'Score':42, 'CRM ID':'aaaaaaaa-aaaa-4aaa-8aaa-000000000002' },
])
const pushed = JSON.parse(output.text)
assert.equal(pushed.updated, 1, 'Exact phone match should update the existing Euro School row.')
assert.equal(pushed.appended, 1, 'Same company with a different phone should remain a separate row.')
assert.equal(pushed.linkedByContact, 1)
assert.equal(sheet.getLastRow(), 6)
const crmIndex = headers.indexOf('CRM ID') + 1
assert.equal(sheet.get(4, crmIndex), 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001')
assert.equal(sheet.get(6, crmIndex), 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002')
assert.equal(sheet.get(4, 7), 'Updated')
assert.equal(sheet.formatCopies, 1, 'A newly appended row should copy the previous row formatting.')
assert.equal(sheet.validationCopies, 1, 'A newly appended row should copy dropdown/data validation rules.')

console.log('apps-script.test.mjs: header detection, pull, formatting preservation and non-destructive push passed')
