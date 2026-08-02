const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return response(405, { ok: false, error: 'Method not allowed.' })

  const supabaseUrl = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !publishableKey || !adminKey) {
    return response(503, { ok: false, error: 'Team account management is not fully configured in Netlify.' })
  }

  try {
    const caller = await requireAdmin(event, supabaseUrl, publishableKey)
    const body = parseBody(event.body)
    if (body.action === 'create') return await createUser(body, supabaseUrl, adminKey)
    if (body.action === 'resetPassword') return await resetPassword(body, supabaseUrl, adminKey, caller.id)
    if (body.action === 'deactivate') return await setActive(body, false, supabaseUrl, adminKey, caller.id)
    if (body.action === 'activate') return await setActive(body, true, supabaseUrl, adminKey, caller.id)
    return response(400, { ok: false, error: 'Invalid team action.' })
  } catch (error) {
    return response(Number(error.statusCode) || 500, { ok: false, error: error instanceof Error ? error.message : 'Team action failed.' })
  }
}

async function createUser(body, supabaseUrl, serviceKey) {
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const fullName = String(body.fullName || '').trim()
  const jobTitle = String(body.jobTitle || '').trim()
  const role = 'member'
  if (!/^\S+@\S+\.\S+$/.test(email)) throw statusError(400, 'Enter a valid email address.')
  if (password.length < 8) throw statusError(400, 'The temporary password must contain at least 8 characters.')
  if (!fullName) throw statusError(400, 'Enter the team member’s full name.')

  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
    signal: AbortSignal.timeout(15000),
  })
  const created = await safeJson(createResponse)
  if (!createResponse.ok) throw statusError(createResponse.status, created.msg || created.message || created.error_description || 'Could not create the account.')

  const userId = created.id || created.user?.id
  if (!userId) throw statusError(502, 'Supabase created the login but did not return a user ID.')

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify({ full_name: fullName, email, job_title: jobTitle || null, role, is_active: true }),
    signal: AbortSignal.timeout(10000),
  })
  const profile = await safeJson(profileResponse)
  if (!profileResponse.ok) throw statusError(profileResponse.status, profile.message || 'The login was created, but the team profile could not be updated.')
  return response(200, { ok: true, userId, profile: Array.isArray(profile) ? profile[0] : profile, message: `${fullName} can now sign in.` })
}

async function resetPassword(body, supabaseUrl, serviceKey, callerId) {
  const userId = String(body.userId || '')
  const password = String(body.password || '')
  if (!userId) throw statusError(400, 'Missing user ID.')
  if (password.length < 8) throw statusError(400, 'The new password must contain at least 8 characters.')
  const r = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT', headers: adminHeaders(serviceKey), body: JSON.stringify({ password }), signal: AbortSignal.timeout(10000),
  })
  const data = await safeJson(r)
  if (!r.ok) throw statusError(r.status, data.msg || data.message || 'Password reset failed.')
  return response(200, { ok: true, message: userId === callerId ? 'Your password was updated.' : 'Temporary password updated.' })
}

async function setActive(body, active, supabaseUrl, serviceKey, callerId) {
  const userId = String(body.userId || '')
  if (!userId) throw statusError(400, 'Missing user ID.')
  if (!active && userId === callerId) throw statusError(400, 'You cannot deactivate your own administrator account.')
  const r = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify({ is_active: active }),
    signal: AbortSignal.timeout(10000),
  })
  const data = await safeJson(r)
  if (!r.ok) throw statusError(r.status, data.message || 'Could not update account access.')
  return response(200, { ok: true, profile: Array.isArray(data) ? data[0] : data, message: active ? 'Account activated.' : 'Account deactivated.' })
}

async function requireAdmin(event, supabaseUrl, key) {
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw statusError(401, 'Sign in is required.')
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
  if (!userResponse.ok) throw statusError(401, 'Invalid or expired session.')
  const user = await userResponse.json()
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  if (!profiles[0] || profiles[0].role !== 'admin' || profiles[0].is_active === false) throw statusError(403, 'Administrator access is required.')
  return user
}

function adminHeaders(key) {
  const headers = { apikey: key, 'Content-Type': 'application/json' }
  // New sb_secret_ keys are opaque and must be supplied as apikey. Legacy service_role JWTs also need Bearer auth.
  if (!String(key).startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`
  return headers
}
async function safeJson(response) { try { return await response.json() } catch { return {} } }
function parseBody(body) { try { return JSON.parse(body || '{}') } catch { throw statusError(400, 'Invalid JSON body.') } }
function statusError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error }
function response(statusCode, payload) { return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) } }
