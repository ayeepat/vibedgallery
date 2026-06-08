import { supabase } from '@/lib/supabaseClient'

// Client-side wrapper that calls the `check-url-safety` Edge Function.
// The Google Safe Browsing API key lives in Supabase Function Secrets;
// it never ships to the browser bundle.
//
// Returns shape:
//   { safe: boolean, threats: string[], skipped?: boolean, degraded?: boolean,
//     error?: string }
//
// Semantics: `safe: true` means a real verdict came back clean. `skipped`
// means we never got a verdict (server unreachable, key unset, upstream
// outage). Callers must persist `safe_browsing_passed` from `safe && !skipped`
// so the admin queue accurately distinguishes "Safe Browsing said OK" from
// "Safe Browsing was bypassed."
export async function checkUrlSafety(url) {
  try {
    const { data, error } = await supabase.functions.invoke('check-url-safety', {
      body: { url },
    })
    if (error) throw error

    if (!data || typeof data.safe !== 'boolean') {
      // Malformed response — degrade rather than trap the submitter. Admin
      // reviews every submission before it goes public.
      return { safe: false, threats: [], skipped: true, degraded: true }
    }

    // Server config gap (no key) or an upstream outage (degraded). Don't block
    // submissions — accept the URL but propagate `skipped` so the admin queue
    // sees this row bypassed Safe Browsing rather than passed it.
    if (data.skipped) {
      return { safe: false, threats: [], skipped: true, degraded: !!data.degraded }
    }

    return data
  } catch (err) {
    console.error('checkUrlSafety failed (failing open):', err)
    // Edge function unreachable — degrade, don't trap. Manual review is the
    // real backstop and only approved apps are ever shown publicly.
    return { safe: false, threats: [], skipped: true, degraded: true }
  }
}
