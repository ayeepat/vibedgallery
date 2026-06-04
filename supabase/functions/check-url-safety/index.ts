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
      console.error("Safe Browsing upstream failed", upstream.status, detail);
      return json({
        safe: false,
        threats: ["API_ERROR"],
        error: "Upstream Safe Browsing check failed. Try again.",
      });
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
    console.error("check-url-safety error", err);
    return json({
      safe: false,
      threats: ["API_ERROR"],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
