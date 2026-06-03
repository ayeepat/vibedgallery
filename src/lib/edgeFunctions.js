import { supabase } from '@/lib/supabaseClient'

// Thin wrappers around the Supabase Edge Functions.
// All calls are best-effort: email failures never block the core flow.

export async function sendEmail(type, app, extra = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { type, app, ...extra },
    })
    if (error) throw error
    return data
  } catch (err) {
    console.error(`sendEmail(${type}) failed:`, err)
    return { success: false, error: String(err?.message ?? err) }
  }
}

// Verify the ownership HTML/TXT file exists at the app URL (server-side, no CORS).
export async function verifyHtml(url, token) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-html', {
      body: { url, token },
    })
    if (error) throw error
    return data
  } catch (err) {
    console.error('verifyHtml failed:', err)
    return { verified: false, reason: String(err?.message ?? err) }
  }
}
