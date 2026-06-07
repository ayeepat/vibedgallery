import { supabase } from '@/lib/supabaseClient'

// Client-side wrapper that calls the `check-url-safety` Edge Function.
// The Google Safe Browsing API key lives in Supabase Function Secrets;
// it never ships to the browser bundle.
//
// Returns shape:
//   { safe: boolean, threats: string[], skipped?: boolean, error?: string }
export async function checkUrlSafety(url) {
  try {
    const { data, error } = await supabase.functions.invoke('check-url-safety', {
      body: { url },
    })
    if (error) throw error

    if (!data || typeof data.safe !== 'boolean') {
      // Malformed response — degrade rather than trap the submitter. Admin
      // reviews every submission before it goes public.
      return { safe: true, threats: [], skipped: true, degraded: true }
    }

    // Server config gap (no key) or an upstream outage (degraded). Don't block
    // submissions — accept the URL but flag it so admins can see it bypassed
    // Safe Browsing in the queue. A real threat match still returns safe:false.
    if (data.skipped) {
      return { safe: true, threats: [], skipped: true, degraded: !!data.degraded }
    }

    return data
  } catch (err) {
    console.error('checkUrlSafety failed (failing open):', err)
    // Edge function unreachable — degrade, don't trap. Manual review is the
    // real backstop and only approved apps are ever shown publicly.
    return { safe: true, threats: [], skipped: true, degraded: true }
  }
}
