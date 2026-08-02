export async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
    body: JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
      appVersion: '1.0.0-final',
      sheetsConfigured: Boolean(process.env.GOOGLE_SHEETS_WEB_APP_URL && process.env.GOOGLE_SHEETS_SHARED_SECRET),
      teamAdminConfigured: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    }),
  }
}
