import { supabase } from '@/lib/supabaseClient'

// Generate a unique, cryptographically secure verification token
export function generateVerificationToken() {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `vg-verify-${random}`
}

// Get the verification file instructions
// Supports both .txt and .html
export function getVerificationInstructions(siteUrl, token) {
  const base = siteUrl.replace(/\/$/, '')

  return {
    token,
    // Option A: text file
    txtFile: {
      filename: `${token}.txt`,
      url: `${base}/${token}.txt`,
      content: token,
      instructions: [
        `Create a file called ${token}.txt`,
        `The file content should just be: ${token}`,
        `Place it in your project's /public folder`,
        `Deploy your site`,
        `The file should be accessible at: ${base}/${token}.txt`,
      ],
    },
    // Option B: html file
    htmlFile: {
      filename: `${token}.html`,
      url: `${base}/${token}.html`,
      content: `<!DOCTYPE html><html><head><meta name="vibedgallery-verification" content="${token}"></head><body>${token}</body></html>`,
      instructions: [
        `Create a file called ${token}.html`,
        `Copy the HTML content below into the file`,
        `Place it in your project's /public folder`,
        `Deploy your site`,
        `The file should be accessible at: ${base}/${token}.html`,
      ],
    },
  }
}

// Check if the verification file exists.
//
// The fetch happens server-side in the `verify-ownership` Supabase Edge
// Function so it is not blocked by CORS (which made the browser-only check
// effectively useless).
export async function checkOwnershipFile(siteUrl, token) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-ownership', {
      body: { siteUrl, token },
    })

    if (error) {
      return {
        verified: false,
        reason: 'error',
        note: 'Could not reach the verification service. Admin will check manually.',
      }
    }

    return data
  } catch (e) {
    return {
      verified: false,
      reason: 'error',
      note: 'Could not reach the verification service. Admin will check manually.',
    }
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
