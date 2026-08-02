import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs/promises'
import cryptoModule from 'node:crypto'

const appCode = await fs.readFile(new URL('../site/app.js', import.meta.url), 'utf8')
const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const STAFF_ID = '22222222-2222-4222-8222-222222222222'

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function fixture(role) {
  const id = role === 'admin' ? ADMIN_ID : STAFF_ID
  const profile = { id, full_name: role === 'admin' ? 'Aavash Adhikari' : 'Vireon Staff', email: role + '@example.com', role: role === 'admin' ? 'admin' : 'member', is_active: true, job_title: role === 'admin' ? 'Administrator' : 'Video Editor' }
  const profiles = role === 'admin' ? [profile, { id: STAFF_ID, full_name: 'Vireon Staff', email: 'staff@example.com', role: 'member', is_active: true, job_title: 'Video Editor' }] : [profile]
  const leads = [
    { id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', company_name:'Euro School', phone:'9800000001', industry:'School', lead_source:'Vacancy', stage:'proposal_sent', priority:'high', assigned_to:id, created_by:ADMIN_ID, remarks:'Proposal shared and waiting for review.', score:76, next_follow_up_note:'Follow up Sunday', created_at:'2026-07-20T00:00:00Z', updated_at:'2026-07-30T00:00:00Z', last_activity_at:'2026-07-30T00:00:00Z' },
    { id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002', company_name:'Beyond Trend', phone:'9800000002', industry:'Clothing', lead_source:'Coldcall', stage:'negotiating', priority:'urgent', assigned_to:id, created_by:ADMIN_ID, remarks:'Needs 12–15 videos monthly.', score:82, created_at:'2026-07-21T00:00:00Z', updated_at:'2026-08-01T00:00:00Z', last_activity_at:'2026-08-01T00:00:00Z' },
  ]
  const client = { id:'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', lead_id:leads[0].id, company_name:'Euro School', status:'active', package_name:'Content Growth', account_manager:id, scope_summary:'Monthly content production.', services:['Video','Design'], created_by:ADMIN_ID, created_at:'2026-08-01T00:00:00Z', updated_at:'2026-08-01T00:00:00Z' }
  return {
    profiles, leads, lead_requirements:[], clients:[client], activities:[], tasks:[], client_cycles:[], deliverables:[], shoots:[], quick_replies:[], stale_rules:[],
    client_financials: role === 'admin' ? [{ client_id:client.id, monthly_fee:20000, billing_cycle:'monthly' }] : [],
    payments:[], sync_logs:[], audit_logs:[],
  }
}

async function render(role, hash = '#/dashboard') {
  const app = { innerHTML: '', querySelector: () => null }
  const modal = { innerHTML: '' }
  const toast = { innerHTML: '', querySelector: () => null }
  const session = { access_token: role + '-token', refresh_token: 'refresh-token', user: { id: role === 'admin' ? ADMIN_ID : STAFF_ID } }
  const storage = new Map([['vireon-lead-hub-session-v1', JSON.stringify(session)]])
  const data = fixture(role)
  const context = {
    console,
    Response,
    URL,
    URLSearchParams,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    RegExp,
    Error,
    Promise,
    setTimeout,
    clearTimeout,
    crypto: cryptoModule.webcrypto,
    navigator: { onLine: true },
    location: { hash },
    localStorage: { getItem:k => storage.get(k) ?? null, setItem:(k,v) => storage.set(k,v), removeItem:k => storage.delete(k) },
    document: {
      getElementById: id => id === 'app' ? app : id === 'modal-root' ? modal : toast,
      addEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    window: { addEventListener: () => {} },
    fetch: async (url, options = {}) => {
      const href = String(url)
      if (href === '/api/public-config') return response({ supabaseUrl:'https://mock.supabase.co', supabasePublishableKey:'test-key', appVersion:'1.0.0-final', sheetsConfigured:true, teamAdminConfigured:true })
      const match = href.match(/\/rest\/v1\/([^?]+)/)
      if (match) return response(data[match[1]] || [])
      if (href.includes('/auth/v1/')) return response({ id: session.user.id })
      return response({}, 404)
    },
  }
  vm.createContext(context)
  vm.runInContext(appCode, context, { filename: 'app.js' })
  await new Promise(resolve => setTimeout(resolve, 60))
  return app.innerHTML
}

const admin = await render('admin')
assert.match(admin, /Good evening, Aavash/)
assert.match(admin, /Leads by stage/)
assert.match(admin, /Active client MRR/)
assert.match(admin, />Reports</)
assert.match(admin, />Team</)
assert.doesNotMatch(admin, /Opening secure workspace/)

const staff = await render('member')
assert.match(staff, /My workspace/)
assert.match(staff, /My Leads/)
assert.doesNotMatch(staff, />Reports</)
assert.doesNotMatch(staff, />Team</)
assert.doesNotMatch(staff, /Active client MRR/)
assert.doesNotMatch(staff, /Payments received/)

const adminLeads = await render('admin', '#/leads')
assert.match(adminLeads, /Euro School/)
assert.match(adminLeads, /Beyond Trend/)
assert.match(adminLeads, /Proposal Sent/)

const staffLeads = await render('member', '#/leads')
assert.match(staffLeads, /My leads/)
assert.match(staffLeads, /Euro School/)
assert.doesNotMatch(staffLeads, /Add lead/)

console.log('app-render.test.mjs: admin and staff rendering assertions passed')
