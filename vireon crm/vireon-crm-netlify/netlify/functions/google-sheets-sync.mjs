export async function handler(event) {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' })
  const webAppUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL
  const sharedSecret = process.env.GOOGLE_SHEETS_SHARED_SECRET
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!webAppUrl || !sharedSecret) return response(500, { error: 'Google Sheets is not configured in Netlify.' })

  const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (supabaseUrl && supabaseKey) {
    if (!token) return response(401, { error: 'Sign in is required.' })
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } })
    if (!authCheck.ok) return response(401, { error: 'Invalid or expired session.' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    if (!['test', 'pull', 'push'].includes(body.action)) return response(400, { error: 'Invalid action.' })
    const sheetResponse = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: sharedSecret, action: body.action, rows: body.rows || [] }),
      redirect: 'follow',
    })
    const text = await sheetResponse.text()
    let payload
    try { payload = JSON.parse(text) } catch { throw new Error(`Apps Script returned invalid data: ${text.slice(0, 120)}`) }
    return response(payload.ok === false ? 400 : 200, payload)
  } catch (error) {
    return response(500, { error: error instanceof Error ? error.message : 'Sheets sync failed.' })
  }
}

function response(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
}
