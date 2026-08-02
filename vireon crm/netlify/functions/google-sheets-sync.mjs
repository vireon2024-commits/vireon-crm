const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return response(405, { ok: false, error: 'Method not allowed.' })

  const webAppUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL
  const sharedSecret = process.env.GOOGLE_SHEETS_SHARED_SECRET
  if (!webAppUrl || !sharedSecret) return response(503, { ok: false, error: 'Google Sheets is not configured in Netlify.' })

  try {
    await requireAdmin(event)
    const body = parseBody(event.body)
    const allowedActions = new Set(['test', 'pull', 'push', 'applyIds'])
    if (!allowedActions.has(body.action)) return response(400, { ok: false, error: 'Invalid Sheets action.' })

    const payload = {
      secret: sharedSecret,
      action: body.action,
      rows: Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [],
      assignments: Array.isArray(body.assignments) ? body.assignments.slice(0, 5000) : [],
    }

    const sheetResponse = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    })
    const text = await sheetResponse.text()
    let result
    try { result = JSON.parse(text) } catch { throw new Error(`Apps Script returned invalid data: ${text.slice(0, 160)}`) }
    if (!sheetResponse.ok || result.ok === false) return response(400, result)
    return response(200, result)
  } catch (error) {
    const status = Number(error.statusCode) || 500
    return response(status, { ok: false, error: error instanceof Error ? error.message : 'Sheets sync failed.' })
  }
}

async function requireAdmin(event) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) throw statusError(503, 'Supabase is not configured in Netlify.')

  const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw statusError(401, 'Sign in is required.')

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!authResponse.ok) throw statusError(401, 'Invalid or expired session.')
  const user = await authResponse.json()

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  if (!profiles[0] || profiles[0].role !== 'admin' || profiles[0].is_active === false) {
    throw statusError(403, 'Administrator access is required.')
  }
  return user
}

function parseBody(body) {
  try { return JSON.parse(body || '{}') } catch { throw statusError(400, 'Invalid JSON body.') }
}
function statusError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error }
function response(statusCode, payload) { return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) } }
