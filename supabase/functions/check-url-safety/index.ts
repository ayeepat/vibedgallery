// Supabase Edge Function: check-url-safety
// Server-side wrapper around the Google Safe Browsing API so the API key
// never ships to the browser.
//
// Body:    { url: string }
// Returns: { safe: boolean, threats: string[], skipped?: boolean, error?: string }

import { corsHeaders } from "../_shared/cors.ts";

const API_KEY = Deno.env.get("GOOGLE_SAFE_BROWSING_KEY");

interface Payload {
  url?: string;
}

interface SafeBrowsingMatch {
  threatType: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ safe: false, threats: [], error: "Method not allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ safe: false, threats: [], error: "Invalid JSON body" }, 400);
  }

  const target = (payload.url ?? "").trim();
  if (!target) {
    return json({ safe: false, threats: [], error: "Missing url" }, 400);
  }

  // Fail safe: if the operator hasn't configured the key, surface that clearly
  // and let the caller decide what to do. We do NOT silently accept any URL.
  if (!API_KEY) {
    console.warn("check-url-safety: GOOGLE_SAFE_BROWSING_KEY not set");
    return json({
      safe: false,
      threats: [],
      skipped: true,
      error: "Safe Browsing key not configured on server",
    });
  }

  try {
    const upstream = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            clientId: "vibedgallery",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: target }],
          },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return degraded(`Safe Browsing upstream HTTP ${upstream.status}: ${detail}`);
    }

    const data = (await upstream.json()) as { matches?: SafeBrowsingMatch[] };

    if (data.matches && data.matches.length > 0) {
      return json({
        safe: false,
        threats: data.matches.map((m) => m.threatType),
      });
    }

    return json({ safe: true, threats: [] });
  } catch (err) {
    return degraded(`Safe Browsing fetch threw: ${String(err)}`);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// The Safe Browsing SERVICE failed (unreachable / non-200) — not a verdict that
// the URL is malicious. Fail OPEN but flag it: an upstream outage must not trap
// every submitter. Real threat matches still hard-block. Every submission is
// manually reviewed before going public. Mirrors the missing-key `skipped` path.
function degraded(reason: string): Response {
  console.error("check-url-safety: degraded (failing open) —", reason);
  return json({ safe: true, threats: [], skipped: true, degraded: true, reason });
}
