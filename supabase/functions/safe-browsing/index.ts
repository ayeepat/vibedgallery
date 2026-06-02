// Supabase Edge Function: safe-browsing
//
// Calls the Google Safe Browsing API using a server-side secret so the
// API key is never shipped to the browser.
//
// Required secret:
//   supabase secrets set GOOGLE_SAFE_BROWSING_KEY=your_key
//
// Request body:  { "url": "https://example.com" }
// Response body: { "safe": boolean, "threats": string[] }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GOOGLE_SAFE_BROWSING_KEY");
  if (!apiKey) {
    console.warn("GOOGLE_SAFE_BROWSING_KEY is not set");
    // Fail open: never block submissions on a config/API error.
    return json({ safe: true, threats: [] });
  }

  let url: string | undefined;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!url || typeof url !== "string") {
    return json({ error: "Missing 'url' in request body" }, 400);
  }

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "vibedgallery", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: THREAT_TYPES,
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      },
    );

    if (!res.ok) {
      console.warn("Safe Browsing API error:", res.status);
      return json({ safe: true, threats: [] });
    }

    const data = await res.json();
    if (Array.isArray(data.matches) && data.matches.length > 0) {
      const threats = data.matches.map((m: { threatType: string }) => m.threatType);
      return json({ safe: false, threats });
    }

    return json({ safe: true, threats: [] });
  } catch (err) {
    console.error("Safe Browsing check failed:", err);
    // Fail open.
    return json({ safe: true, threats: [] });
  }
});
