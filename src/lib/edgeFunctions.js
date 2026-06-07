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

// Server-side image moderation via the check-image-safety Edge Function.
// Caller passes the public CDN URL of the just-uploaded image. Mirrors the
// check-url-safety response shape so the submit flow can treat them the same:
//   { safe: boolean, threats?: string[], skipped?: boolean, error?: string }
//
// `skipped` means the server doesn't have GOOGLE_CLOUD_VISION_KEY configured —
// caller should treat the image as safe but admin will still see it in the
// queue and can spot-check.
export async function checkImageSafetyRemote(url) {
  try {
    const { data, error } = await supabase.functions.invoke('check-image-safety', {
      body: { url },
    })
    if (error) throw error
    if (!data || typeof data.safe !== 'boolean') {
      // Malformed response — treat as a service gap, not a verdict. Fail open
      // (admin reviews every submission before it's public) so a transient
      // moderation hiccup can't trap the submitter in a retry loop.
      return { safe: true, skipped: true, degraded: true }
    }
    return data
  } catch (err) {
    console.error('checkImageSafetyRemote failed (failing open):', err)
    // The moderation function is unreachable — don't block the user. Manual
    // review is the real backstop; only-approved apps are ever shown publicly.
    return { safe: true, skipped: true, degraded: true }
  }
}

// Validate a Cloudflare Turnstile token via the verify-turnstile Edge Function.
// `action` is optional; if you pass one to <Turnstile action="..."/> you should
// pass the same string here so the server can confirm the binding.
export async function verifyTurnstile(token, action) {
  if (!token) return { success: false, error: 'Missing captcha token' }

  // Local-dev convenience: with no site key there's no captcha to verify and the
  // edge function may not be running locally, so short-circuit. This is gated on
  // `import.meta.env.DEV` (statically false in prod builds), so production ALWAYS
  // calls the server — which is the real gate and only skips when its own secret
  // is unset. A forgotten client key therefore can't bypass a configured captcha.
  if (import.meta.env.DEV && !import.meta.env.VITE_TURNSTILE_SITE_KEY) {
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
