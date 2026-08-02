import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs/promises'
import cryptoModule from 'node:crypto'

let code = await fs.readFile(new URL('../site/app.js', import.meta.url), 'utf8')
code += `\n;globalThis.__vireonTests = { mapSheetRow, buildSheetPreview, findDuplicates, smartParse, safeUrl, csvCell, sheetStatusForStage, parseDateValue, calculateScore };`
const app = { innerHTML: '', querySelector: () => null }
const context = {
  console, Response, URL, URLSearchParams, Intl, Date, Math, Number, String, Boolean, Array, Object, JSON, RegExp, Error, Promise,
  Blob, setTimeout, clearTimeout, crypto: cryptoModule.webcrypto,
  navigator: { onLine: true }, location: { hash: '#/login' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: id => id === 'app' ? app : ({ innerHTML:'', querySelector:() => null }), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ click(){}, remove(){} }), body: { appendChild(){} } },
  window: { addEventListener: () => {} },
  fetch: async url => new Response(JSON.stringify(String(url) === '/api/public-config' ? { supabaseUrl:'', supabasePublishableKey:'' } : {}), { status:200, headers:{'content-type':'application/json'} }),
}
vm.createContext(context)
vm.runInContext(code, context, { filename:'app.js' })
const t = context.__vireonTests

const mapped = t.mapSheetRow({
  _rowNumber: 4,
  'Lead Name': 'Euro School',
  'Contact Number': '9801836581',
  'Business Type': 'School',
  'Lead Source': 'Vacancy',
  'Date First Contacted': '7/24/2026',
  'Current Situation / Remarks': 'Proposal sent, waiting for reply',
  'Lead Status': 'Negotiating',
  'Priority': 'High',
  'Next Follow-up Date': 'need to call back',
})
assert.equal(mapped.company_name, 'Euro School')
assert.equal(mapped.stage, 'negotiating')
assert.equal(mapped.priority, 'high')
assert.equal(mapped.next_follow_up_at, undefined)
assert.equal(mapped.next_follow_up_note, 'need to call back')
assert.match(mapped.date_first_contacted, /^2026-07-24/)

const existing = [
  { id:'1', company_name:'crownedunepal', phone:'9800000001', email:'' },
  { id:'2', company_name:'Other', phone:'9800000002', email:'hello@example.com' },
]
const companyOnly = t.findDuplicates({ company_name:'Crowned U Nepal', phone:'9800000099' }, existing)
assert.equal(companyOnly[0].confidence, 35)
assert.equal(companyOnly[0].reasons.includes('same company'), true)
const exactPhone = t.findDuplicates({ company_name:'Different', phone:'9800000001' }, existing)
assert.equal(exactPhone[0].confidence >= 60, true)

const parsed = t.smartParse('Needs 12 videos monthly, budget around 20,000. Proposal sent, waiting for reply.')
assert.equal(parsed.videos, 12)
assert.equal(parsed.budget, 20000)
assert.equal(parsed.stage, 'proposal_sent')

assert.equal(t.safeUrl('javascript:alert(1)'), '')
assert.match(t.safeUrl('vireon.com.np', true), /^https:\/\/vireon\.com\.np/)
assert.equal(t.csvCell('=HYPERLINK("bad")').startsWith('"\'='), true)
assert.equal(t.sheetStatusForStage('follow_up'), 'waiting response')
assert.equal(t.parseDateValue('13/40/2026'), null)
assert.equal(t.calculateScore({ stage:'won', expected_monthly_value:50000, engagement_level:5, meeting_interest:5, urgency_level:5, requirements_completeness:100, decision_maker_contacted:true, created_at:new Date().toISOString() }).total, 100)

console.log('logic.test.mjs: sheet mapping, duplicate rules, parser, URLs and CSV safety passed')
