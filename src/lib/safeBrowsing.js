import { supabase } from '@/lib/supabaseClient'

/**
 * Check a URL against Google Safe Browsing.
 *
 * The actual API call happens server-side in the `safe-browsing` Supabase
 * Edge Function so the API key is never shipped to the browser.
 *
 * Fails open: if the function errors, we do not block the submission.
 *
 * @param {string} url
 * @returns {Promise<{ safe: boolean, threats: string[] }>}
 */
export async function checkUrlSafety(url) {
  try {
    const { data, error } = await supabase.functions.invoke('safe-browsing', {
      body: { url },
    })

    if (error) {
      console.warn('Safe Browsing check failed, failing open:', error.message)
      return { safe: true, threats: [] }
    }

    return {
      safe: data?.safe ?? true,
      threats: data?.threats ?? [],
    }
  } catch (err) {
    console.error('Safe Browsing check failed:', err)
    // Fail open — don't block submission if the function is unreachable.
    return { safe: true, threats: [] }
  }
}
