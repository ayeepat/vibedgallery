// Supabase Edge Function: verify-html
// Server-side verification that the ownership file actually exists at the app's
// URL and contains the expected token. Runs server-side so it is NOT blocked by
// browser CORS (unlike the client-side checkOwnershipFile helper).
//
// Body: { url: string, token: string }
// Returns: { verified: boolean, method?: "html" | "txt", reason?: string }

import { corsHeaders } from "../_shared/cors.ts";

interface Payload {
  url: string;
  token: string;
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

async function tryFetch(target: string, token: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "VibedGallery-Verifier/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes(token);
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, token } = (await req.json()) as Payload;

    if (!url || !token) {
      return new Response(JSON.stringify({ error: "url and token are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = stripTrailingSlash(url);
    const htmlUrl = `${base}/${token}.html`;
    const txtUrl = `${base}/${token}.txt`;

    if (await tryFetch(htmlUrl, token)) {
      return new Response(JSON.stringify({ verified: true, method: "html" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (await tryFetch(txtUrl, token)) {
      return new Response(JSON.stringify({ verified: true, method: "txt" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        verified: false,
        reason: "Verification file not found or token mismatch",
        checked: [htmlUrl, txtUrl],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
