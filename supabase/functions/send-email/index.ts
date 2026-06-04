// Supabase Edge Function: send-email
// Sends transactional emails via Resend.
//
// Supported `type` values (passed in the JSON body):
//   - "submission_confirmation" : confirmation to the submitter
//   - "admin_notification"      : alert to the admin that a new app arrived
//   - "approved"                : tell the submitter their app is live
//   - "rejected"                : tell the submitter why it was rejected
//
// Hard rules (vs. older version which trusted body fields):
//   - JWT is enforced (verify_jwt=true in config.toml).
//   - The recipient is NEVER read from the body — it's always derived
//     server-side from auth.users via the app row, so a signed-in attacker
//     cannot use this endpoint to spam arbitrary addresses.
//   - "submission_confirmation" / "admin_notification" require the caller
//     to own the referenced app (i.e. apps.user_id = auth.uid()).
//   - "approved" / "rejected" require the caller's profiles.role = 'admin'.
//
// Required secrets (set via `supabase secrets set`):
//   - RESEND_API_KEY  : your Resend API key
//   - EMAIL_FROM      : verified sender, e.g. "VibedGallery <noreply@yourdomain.com>"
//   - ADMIN_EMAIL     : where admin notifications are sent
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are auto-injected by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "VibedGallery <onboarding@resend.dev>";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type EmailType =
  | "submission_confirmation"
  | "admin_notification"
  | "approved"
  | "rejected";

interface Payload {
  type: EmailType;
  app: { id?: string };
  rejectionReason?: string;
}

interface AppRow {
  id: string;
  user_id: string;
  title: string;
  tagline: string | null;
  url: string | null;
  category: string | null;
  primary_tool: string | null;
  submitter_email: string | null;
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000000;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#717171;margin:0 0 12px;">VibedGallery</p>
      <h1 style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.04em;line-height:1.05;margin:0 0 20px;">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#333333;">${body}</div>
      <hr style="border:none;border-top:1px solid #E5E5E5;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#AAAAAA;margin:0;">A Museum of the Digital Avant-Garde.</p>
    </div>
  </body>
</html>`;
}

// Escape any user-controlled fragment that goes into the email body.
function esc(s: string | null | undefined): string {
  if (s == null) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) return jsonResp({ error: "RESEND_API_KEY not set" }, 500);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResp({ error: "Supabase env not injected" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return jsonResp({ error: "Missing bearer token" }, 401);

    const payload = (await req.json()) as Payload;
    const appId = payload?.app?.id;
    if (!payload?.type) return jsonResp({ error: "Missing type" }, 400);
    if (!appId) return jsonResp({ error: "Missing app.id" }, 400);

    // Service-role client for trusted reads (auth.users, profiles, full app row).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve the caller from the bearer token.
    const { data: callerData, error: callerErr } = await admin.auth.getUser(accessToken);
    if (callerErr || !callerData?.user) {
      return jsonResp({ error: "Invalid session" }, 401);
    }
    const callerId = callerData.user.id;

    // Pull the app row (and the submitter's email) server-side. Never trust
    // the body for the recipient.
    const { data: appRow, error: appErr } = await admin
      .from("apps")
      .select("id, user_id, title, tagline, url, category, primary_tool, submitter_email")
      .eq("id", appId)
      .maybeSingle<AppRow>();
    if (appErr) return jsonResp({ error: "App lookup failed", detail: appErr.message }, 500);
    if (!appRow) return jsonResp({ error: "App not found" }, 404);

    // Caller can't pass arbitrary content downstream — every email is built
    // here from DB data plus a single bounded `rejectionReason` string.

    // Per-type authorization.
    const callerOwnsApp = appRow.user_id === callerId;
    let callerIsAdmin = false;
    if (payload.type === "approved" || payload.type === "rejected") {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", callerId)
        .maybeSingle<{ role: string }>();
      callerIsAdmin = profile?.role === "admin";
      if (!callerIsAdmin) return jsonResp({ error: "Admin required" }, 403);
    } else {
      // submission_confirmation / admin_notification: must be the app owner.
      if (!callerOwnsApp) return jsonResp({ error: "Not your app" }, 403);
    }

    // Resolve recipient from the app row's submitter_email (set by the
    // apps_set_submitter_email trigger from auth.users at insert time).
    let recipient: string | null = null;
    if (payload.type === "admin_notification") {
      if (!ADMIN_EMAIL) return jsonResp({ error: "ADMIN_EMAIL not set" }, 500);
      recipient = ADMIN_EMAIL;
    } else {
      recipient = appRow.submitter_email;
      // Fallback: if the column was never populated, look it up via auth.users.
      if (!recipient) {
        const { data: u } = await admin.auth.admin.getUserById(appRow.user_id);
        recipient = u?.user?.email ?? null;
      }
      if (!recipient) return jsonResp({ error: "Submitter email not found" }, 500);
    }

    // Build the email.
    const title = appRow.title ?? "your app";
    let subject = "";
    let body = "";
    switch (payload.type) {
      case "submission_confirmation":
        subject = `We received your submission — ${title}`;
        body = html("YOU'RE IN THE QUEUE.", `
          <p>Thanks for submitting <strong>${esc(title)}</strong> to VibedGallery.</p>
          <p>Our team manually reviews every submission, usually within 24 hours. We'll email you the moment it's approved.</p>
        `);
        break;
      case "admin_notification":
        subject = `New submission: ${title}`;
        body = html("NEW SUBMISSION.", `
          <p>A new app is waiting in the review queue.</p>
          <p><strong>${esc(title)}</strong><br/>${esc(appRow.tagline)}</p>
          <p style="font-size:12px;color:#717171;">
            URL: ${esc(appRow.url)}<br/>
            Category: ${esc(appRow.category)}<br/>
            Built with: ${esc(appRow.primary_tool)}<br/>
            Submitter: ${esc(appRow.submitter_email)}
          </p>
        `);
        break;
      case "approved":
        subject = `Approved — ${title} is live`;
        body = html("YOU'RE IN.", `
          <p><strong>${esc(title)}</strong> has been approved and is now live in the gallery.</p>
          ${appRow.url ? `<p><a href="${esc(appRow.url)}" style="color:#000;font-weight:700;">View your app →</a></p>` : ""}
        `);
        break;
      case "rejected": {
        subject = `Update on your submission — ${title}`;
        const reason = (payload.rejectionReason ?? "").slice(0, 2000);
        body = html("SUBMISSION UPDATE.", `
          <p>Thanks for submitting <strong>${esc(title)}</strong>. After review, we weren't able to approve it this time.</p>
          ${reason ? `<p style="font-size:12px;color:#717171;border-left:3px solid #E5E5E5;padding-left:12px;">${esc(reason)}</p>` : ""}
          <p>You're welcome to address the feedback and submit again.</p>
        `);
        break;
      }
      default:
        return jsonResp({ error: `Unknown type: ${(payload as { type: string }).type}` }, 400);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: recipient, subject, html: body }),
    });
    const data = await res.json();
    if (!res.ok) return jsonResp({ error: "Resend error", details: data }, 502);

    return jsonResp({ success: true, id: data.id });
  } catch (err) {
    return jsonResp({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
