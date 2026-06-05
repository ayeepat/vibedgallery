// Supabase Edge Function: verify-turnstile
// Server-side validation of a Cloudflare Turnstile token. The secret key
// lives in Supabase Function Secrets (TURNSTILE_SECRET_KEY) and never
// reaches the browser.
//
// Body:    { token: string, action?: string }
// Returns: { success: boolean, error?: string, codes?: string[] }

import { corsHeaders } from "../_shared/cors.ts";

const SECRET = Deno.env.get("TURNSTILE_SECRET_KEY");
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface Payload {
  token?: string;
  action?: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
  hostname?: string;
  challenge_ts?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // No secret configured → captcha isn't enabled on this deployment. Skip
  // rather than hard-fail, mirroring check-image-safety / check-url-safety, so
  // an unconfigured deployment still lets users register/submit. Set the secret
  // to turn enforcement on.
  if (!SECRET) {
    console.warn(
      "verify-turnstile: TURNSTILE_SECRET_KEY not set — skipping (captcha not configured)",
    );
    return json({ success: true, skipped: true });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const token = (payload.token ?? "").trim();
  if (!token) {
    return json({ success: false, error: "Missing captcha token" }, 400);
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", SECRET);
    form.set("response", token);

    // Forward the caller's IP for Cloudflare's risk scoring.
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";
    if (ip) form.set("remoteip", ip);

    const upstream = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const data = (await upstream.json()) as TurnstileResponse;

    // Optional action binding: if caller specified one, require Cloudflare
    // to confirm the same action was attached to the widget.
    if (data.success && payload.action && data.action !== payload.action) {
      return json({
        success: false,
        error: "Captcha action mismatch",
        codes: ["action-mismatch"],
      });
    }

    if (data.success) {
      return json({ success: true });
    }

    return json({
      success: false,
      error: "Captcha verification failed",
      codes: data["error-codes"] ?? [],
    });
  } catch (err) {
    console.error("verify-turnstile error", err);
    return json(
      {
        success: false,
        error: "Captcha verification error. Please try again.",
      },
      502
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
