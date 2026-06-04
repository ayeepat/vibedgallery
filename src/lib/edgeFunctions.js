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

// Validate a Cloudflare Turnstile token via the verify-turnstile Edge Function.
// `action` is optional; if you pass one to <Turnstile action="..."/> you should
// pass the same string here so the server can confirm the binding.
export async function verifyTurnstile(token, action) {
  if (!token) return { success: false, error: 'Missing captcha token' }

  // Dev-mode bypass — must mirror the sentinel in src/components/Turnstile.jsx.
  if (token === 'DEV_BYPASS' && !import.meta.env.VITE_TURNSTILE_SITE_KEY) {
    return { success: true, dev: true }
  }

  try {
    const { data, error } = await supabase.functions.invoke('verify-turnstile', {
      body: { token, action },
    })
    if (error) throw error
    return data ?? { success: false, error: 'Empty response' }
  } catch (err) {
    console.error('verifyTurnstile failed:', err)
    return { success: false, error: String(err?.message ?? err) }
  }
}
