import assert from 'node:assert/strict'
import { handler as configHandler } from '../netlify/functions/public-config.mjs'
import { handler as usersHandler } from '../netlify/functions/admin-users.mjs'
import { handler as sheetsHandler } from '../netlify/functions/google-sheets-sync.mjs'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const NEW_ID = '33333333-3333-4333-8333-333333333333'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function clearAdminKeys() {
  delete process.env.SUPABASE_SECRET_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
}

async function testPublicConfigHidesSecrets() {
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_server_only'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/example/exec'
  process.env.GOOGLE_SHEETS_SHARED_SECRET = 'sheet-secret'
  const result = await configHandler()
  const body = JSON.parse(result.body)
  assert.equal(result.statusCode, 200)
  assert.equal(body.sheetsConfigured, true)
  assert.equal(body.teamAdminConfigured, true)
  assert.equal(body.supabasePublishableKey, 'publishable')
  assert.equal(JSON.stringify(body).includes('sb_secret_server_only'), false)
  assert.equal(JSON.stringify(body).includes('sheet-secret'), false)
}

async function runCreateUserTest(adminKeyName, adminKeyValue, expectBearer) {
  clearAdminKeys()
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  process.env[adminKeyName] = adminKeyValue
  const calls = []
  const originalFetch = global.fetch
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID })
    if (String(url).includes('/rest/v1/profiles?id=eq.' + ADMIN_ID)) return jsonResponse([{ role: 'admin', is_active: true }])
    if (String(url).endsWith('/auth/v1/admin/users')) return jsonResponse({ user: { id: NEW_ID } })
    if (String(url).includes('/rest/v1/profiles?id=eq.' + NEW_ID) && options.method === 'PATCH') {
      return jsonResponse([{ id: NEW_ID, full_name: 'Aarohi Adhikari', role: 'member', is_active: true }])
    }
    return jsonResponse({ message: 'Unexpected mock URL: ' + url }, 500)
  }
  try {
    const result = await usersHandler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: JSON.stringify({ action: 'create', email: 'aarohi@example.com', password: 'temporary123', fullName: 'Aarohi Adhikari', jobTitle: 'Content Creator', role: 'admin' }),
    })
    const body = JSON.parse(result.body)
    assert.equal(result.statusCode, 200)
    assert.equal(body.userId, NEW_ID)
    assert.equal(body.profile.role, 'member', 'All in-app teammate accounts must remain Team Members.')
    const adminCall = calls.find(call => call.url.endsWith('/auth/v1/admin/users'))
    assert.equal(adminCall.options.headers.apikey, adminKeyValue)
    assert.equal(Boolean(adminCall.options.headers.Authorization), expectBearer)
    if (expectBearer) assert.equal(adminCall.options.headers.Authorization, `Bearer ${adminKeyValue}`)
  } finally {
    global.fetch = originalFetch
    clearAdminKeys()
  }
}

async function testSheetsProxyRequiresAdminAndKeepsSecretServerSide() {
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable'
  process.env.GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/example/exec'
  process.env.GOOGLE_SHEETS_SHARED_SECRET = 'sheet-secret'
  const originalFetch = global.fetch
  let postedToSheet = null
  global.fetch = async (url, options = {}) => {
    const href = String(url)
    if (href.endsWith('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID })
    if (href.includes('/rest/v1/profiles?id=eq.' + ADMIN_ID)) return jsonResponse([{ role: 'admin', is_active: true }])
    if (href.startsWith('https://script.google.com/')) {
      postedToSheet = JSON.parse(options.body)
      return jsonResponse({ ok: true, count: 2, rows: [{ 'Lead Name': 'Euro School' }, { 'Lead Name': 'Beyond Trend' }] })
    }
    return jsonResponse({ message: 'Unexpected mock URL: ' + href }, 500)
  }
  try {
    const result = await sheetsHandler({ httpMethod: 'POST', headers: { authorization: 'Bearer admin-token' }, body: JSON.stringify({ action: 'pull' }) })
    const body = JSON.parse(result.body)
    assert.equal(result.statusCode, 200)
    assert.equal(body.count, 2)
    assert.equal(postedToSheet.secret, 'sheet-secret')
    assert.equal(postedToSheet.action, 'pull')
    assert.equal(JSON.stringify(body).includes('sheet-secret'), false)
  } finally {
    global.fetch = originalFetch
  }
}

async function testRejectsWrongMethod() {
  const userResult = await usersHandler({ httpMethod: 'GET', headers: {} })
  const sheetResult = await sheetsHandler({ httpMethod: 'GET', headers: {} })
  assert.equal(userResult.statusCode, 405)
  assert.equal(sheetResult.statusCode, 405)
}

await testPublicConfigHidesSecrets()
await runCreateUserTest('SUPABASE_SECRET_KEY', 'sb_secret_server_only', false)
await runCreateUserTest('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service-role-jwt', true)
await testSheetsProxyRequiresAdminAndKeepsSecretServerSide()
await testRejectsWrongMethod()
console.log('functions.test.mjs: public config, modern/legacy keys, team role and Sheets proxy assertions passed')
