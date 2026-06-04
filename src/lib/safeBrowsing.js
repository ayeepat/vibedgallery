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
      return {
        safe: false,
        threats: ['API_ERROR'],
        error: 'Could not verify URL safety. Please try again.',
      }
    }

    // Operator hasn't configured GOOGLE_SAFE_BROWSING_KEY. Don't block
    // submissions on a server config gap — accept the URL but flag it so
    // admins can see it bypassed Safe Browsing in the queue.
    if (data.skipped) {
      return { safe: true, threats: [], skipped: true }
    }

    return data
  } catch (err) {
    console.error('checkUrlSafety failed:', err)
    return {
      safe: false,
      threats: ['API_ERROR'],
      error: 'Could not verify URL safety. Please try again.',
    }
  }
}
