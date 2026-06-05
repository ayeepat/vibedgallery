import { supabase } from '@/lib/supabaseClient'

// Pure token helpers live in verifyTokens.js (no Supabase import) so they can
// be unit-tested. Re-exported here to keep existing import paths working.
export {
  generateVerificationToken,
  getVerificationInstructions,
  buildVerificationHtml,
} from '@/lib/verifyTokens'

// Check if the verification file exists
// Tries both .txt and .html
export async function checkOwnershipFile(siteUrl, token) {
  const base = siteUrl.replace(/\/$/, '')
  const txtUrl = `${base}/${token}.txt`
  const htmlUrl = `${base}/${token}.html`

  // Try .txt first
  try {
    const res = await fetch(txtUrl, { mode: 'cors' })
    if (res.ok) {
      const text = await res.text()
      if (text.trim().includes(token)) {
        return { verified: true, method: 'txt' }
      }
    }
  } catch (e) {
    // CORS will likely block this from browser
    // That's okay, we'll handle it via trust + manual review
  }

  // Try .html
  try {
    const res = await fetch(htmlUrl, { mode: 'cors' })
    if (res.ok) {
      const text = await res.text()
      if (text.includes(token)) {
        return { verified: true, method: 'html' }
      }
    }
  } catch (e) {
    // Same CORS issue
  }

  // Can't verify from browser due to CORS
  // Return pending — admin will verify manually
  return { 
    verified: false, 
    reason: 'cors',
    note: 'Cannot verify from browser. Admin will check manually.'
  }
}

// Save verification token to database
export async function saveVerificationToken(appId, token) {
  const { error } = await supabase
    .from('apps')
    .update({ verification_token: token })
    .eq('id', appId)

  if (error) throw error
}