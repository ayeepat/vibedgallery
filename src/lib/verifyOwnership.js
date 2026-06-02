import { supabase } from '@/lib/supabaseClient'

// Generate a unique verification token
export function generateVerificationToken() {
  const random = Math.random().toString(36).substring(2, 10)
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