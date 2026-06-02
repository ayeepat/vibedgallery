// Supabase Edge Function: verify-ownership
//
// Fetches the ownership verification token file from the submitter's site
// server-side, which avoids the CORS limitation that prevents this check
// from working in the browser.
//
// Request body:  { "siteUrl": "https://example.com", "token": "vg-verify-..." }
// Response body: { "verified": boolean, "method"?: "txt" | "html", "reason"?: string }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

async function fetchContains(targetUrl: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(targetUrl, { redirect: "follow" });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes(token);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let siteUrl: string | undefined;
  let token: string | undefined;
  try {
    const body = await req.json();
    siteUrl = body?.siteUrl;
    token = body?.token;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!siteUrl || !token) {
    return json({ error: "Missing 'siteUrl' or 'token'" }, 400);
  }

  const base = siteUrl.replace(/\/$/, "");

  if (await fetchContains(`${base}/${token}.txt`, token)) {
    return json({ verified: true, method: "txt" });
  }

  if (await fetchContains(`${base}/${token}.html`, token)) {
    return json({ verified: true, method: "html" });
  }

  return json({
    verified: false,
    reason: "not_found",
    note: "Verification file was not found at the expected URL.",
  });
});
