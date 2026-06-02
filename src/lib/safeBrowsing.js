const API_KEY = import.meta.env.VITE_GOOGLE_SAFE_BROWSING_KEY

export async function checkUrlSafety(url) {
  if (!API_KEY) {
    console.warn('No Safe Browsing API key found')
    return { safe: true, threats: [] }
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            clientId: 'vibedgallery',
            clientVersion: '1.0.0',
          },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    )

    const data = await response.json()

    // If matches exist, URL is flagged
    if (data.matches && data.matches.length > 0) {
      const threats = data.matches.map((m) => m.threatType)
      return { safe: false, threats }
    }

    return { safe: true, threats: [] }
  } catch (err) {
    console.error('Safe Browsing check failed:', err)
    // Fail open — don't block submission if API fails
    return { safe: true, threats: [] }
  }
}