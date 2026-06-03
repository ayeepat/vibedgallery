// Supabase Edge Function: send-email
// Sends transactional emails via Resend.
//
// Supported `type` values (passed in the JSON body):
//   - "submission_confirmation" : confirmation to the submitter
//   - "admin_notification"      : alert to the admin that a new app arrived
//   - "approved"                : tell the submitter their app is live
//   - "rejected"                : tell the submitter why it was rejected
//
// Required secrets (set via `supabase secrets set`):
//   - RESEND_API_KEY  : your Resend API key
//   - EMAIL_FROM      : verified sender, e.g. "VibedGallery <noreply@yourdomain.com>"
//   - ADMIN_EMAIL     : where admin notifications are sent

import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "VibedGallery <onboarding@resend.dev>";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

interface Payload {
  type: "submission_confirmation" | "admin_notification" | "approved" | "rejected";
  app: {
    id?: string;
    title?: string;
    tagline?: string;
    url?: string;
    submitter_email?: string;
    category?: string;
    primary_tool?: string;
  };
  rejectionReason?: string;
}

function wrap(title: string, body: string): string {
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

function buildEmail(payload: Payload): { to: string; subject: string; html: string } | { error: string } {
  const { type, app, rejectionReason } = payload;
  const title = app?.title ?? "your app";

  switch (type) {
    case "submission_confirmation":
      if (!app?.submitter_email) return { error: "submitter_email required" };
      return {
        to: app.submitter_email,
        subject: `We received your submission — ${title}`,
        html: wrap("YOU'RE IN THE QUEUE.", `
          <p>Thanks for submitting <strong>${title}</strong> to VibedGallery.</p>
          <p>Our team manually reviews every submission, usually within 24 hours. We'll email you the moment it's approved.</p>
        `),
      };

    case "admin_notification":
      if (!ADMIN_EMAIL) return { error: "ADMIN_EMAIL not configured" };
      return {
        to: ADMIN_EMAIL,
        subject: `New submission: ${title}`,
        html: wrap("NEW SUBMISSION.", `
          <p>A new app is waiting in the review queue.</p>
          <p><strong>${title}</strong><br/>${app?.tagline ?? ""}</p>
          <p style="font-size:12px;color:#717171;">
            URL: ${app?.url ?? "—"}<br/>
            Category: ${app?.category ?? "—"}<br/>
            Built with: ${app?.primary_tool ?? "—"}<br/>
            Submitter: ${app?.submitter_email ?? "—"}
          </p>
        `),
      };

    case "approved":
      if (!app?.submitter_email) return { error: "submitter_email required" };
      return {
        to: app.submitter_email,
        subject: `Approved — ${title} is live`,
        html: wrap("YOU'RE IN.", `
          <p><strong>${title}</strong> has been approved and is now live in the gallery.</p>
          ${app?.url ? `<p><a href="${app.url}" style="color:#000;font-weight:700;">View your app →</a></p>` : ""}
        `),
      };

    case "rejected":
      if (!app?.submitter_email) return { error: "submitter_email required" };
      return {
        to: app.submitter_email,
        subject: `Update on your submission — ${title}`,
        html: wrap("SUBMISSION UPDATE.", `
          <p>Thanks for submitting <strong>${title}</strong>. After review, we weren't able to approve it this time.</p>
          ${rejectionReason ? `<p style="font-size:12px;color:#717171;border-left:3px solid #E5E5E5;padding-left:12px;">${rejectionReason}</p>` : ""}
          <p>You're welcome to address the feedback and submit again.</p>
        `),
      };

    default:
      return { error: `Unknown email type: ${type}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const payload = (await req.json()) as Payload;
    const built = buildEmail(payload);

    if ("error" in built) {
      return new Response(JSON.stringify({ error: built.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: built.to,
        subject: built.subject,
        html: built.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Resend error", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
