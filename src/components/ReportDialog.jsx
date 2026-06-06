import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { sendEmail, verifyTurnstile } from "@/lib/edgeFunctions";
import Turnstile from "@/components/Turnstile";

// Report-an-app dialog. Triggered from a small "Report" link on the app
// detail page. Signed-out users are bounced through /login so we always know
// who filed the report (and the RLS policy enforces reporter_id = auth.uid()).
//
// The form is captcha-gated to keep the table from being filled with garbage,
// and the underlying RLS policy only allows insert against approved apps.
// On success we notify the admin via the send-email "report_notification"
// edge function, but UI success doesn't depend on the email going through.
const CATEGORIES = [
  { value: "spam",           label: "Spam / Scam" },
  { value: "malicious",      label: "Malicious or unsafe" },
  { value: "inappropriate",  label: "Inappropriate content" },
  { value: "impersonation",  label: "Impersonation" },
  { value: "copyright",      label: "Copyright / IP" },
  { value: "other",          label: "Other" },
];

const MAX_REASON_LEN = 1000;

export default function ReportDialog({ appId }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);
  const closeBtnRef = useRef(null);
  const reasonRef = useRef(null);

  // Escape closes the dialog; on open we focus the first interactive control
  // so keyboard users land inside the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Focus after the modal mounts.
    queueMicrotask(() => reasonRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset form whenever the dialog is closed so a second open starts fresh.
  useEffect(() => {
    if (open) return;
    setSubmitting(false);
    setError("");
    setCategory("other");
    setReason("");
    setCaptchaToken("");
    setSubmitted(false);
    captchaRef.current?.reset?.();
  }, [open]);

  const openDialog = () => {
    if (!isAuthenticated) {
      navigate(`/login?from=${encodeURIComponent(`/app/${appId}`)}`);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please add a short description so we can investigate.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the captcha.");
      return;
    }

    setSubmitting(true);
    try {
      // Captcha is verified server-side; this keeps abuse out without exposing
      // the secret. Matches the Submit flow's posture.
      const captcha = await verifyTurnstile(captchaToken, "report");
      if (!captcha.success) {
        setError("Captcha verification failed — try again.");
        captchaRef.current?.reset?.();
        setCaptchaToken("");
        setSubmitting(false);
        return;
      }

      const { data: userResp } = await supabase.auth.getUser();
      const reporterId = userResp?.user?.id;
      if (!reporterId) {
        setError("You need to be signed in to report an app.");
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from("reports").insert({
        app_id: appId,
        reporter_id: reporterId,
        reason: trimmed.slice(0, MAX_REASON_LEN),
        category,
      });
      if (insertErr) {
        // Friendly error for the common case (RLS blocked because the app
        // isn't approved, etc.); fall back to the raw message otherwise.
        setError(insertErr.message || "Could not file report.");
        setSubmitting(false);
        return;
      }

      // Fire-and-forget admin notification. Failure here doesn't undo the
      // insert — the report is in the table for admins to find regardless.
      sendEmail("report_notification", { id: appId }, { reason: trimmed.slice(0, MAX_REASON_LEN), category });

      setSubmitted(true);
    } catch (err) {
      setError(err?.message || "Could not file report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] hover:text-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
      >
        <Flag className="w-3 h-3" strokeWidth={2} />
        Report
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            // Click on backdrop closes; clicks inside the panel are caught by stopPropagation
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white border border-black w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
              <h2 id="report-dialog-title" className="text-[10px] font-bold uppercase tracking-widest text-black">
                Report this app
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-[#717171] hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="px-6 py-8 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                  Thanks for the heads-up
                </p>
                <p className="text-sm text-black leading-relaxed">
                  Our team will review this app. We don't share who filed the report.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 h-10 px-6 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                {error && (
                  <div className="px-3 py-2 bg-[#FFF0F0] border border-[#FFD0D0]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-10 px-3 text-xs text-black border border-[#E5E5E5] bg-white focus:outline focus:outline-2 focus:outline-black"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                      What's wrong?
                    </label>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest tabular-nums ${
                        reason.length > MAX_REASON_LEN - 50 ? "text-red-600" : "text-[#AAAAAA]"
                      }`}
                    >
                      {reason.length} / {MAX_REASON_LEN}
                    </span>
                  </div>
                  <textarea
                    ref={reasonRef}
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LEN))}
                    maxLength={MAX_REASON_LEN}
                    rows={4}
                    placeholder="Tell us what's wrong with this app..."
                    required
                    className="w-full px-3 py-2 text-xs text-black border border-[#E5E5E5] bg-white placeholder:text-[#AAAAAA] focus:outline focus:outline-2 focus:outline-black resize-none"
                  />
                </div>

                <Turnstile
                  innerRef={captchaRef}
                  action="report"
                  onVerify={(t) => setCaptchaToken(t)}
                  onExpire={() => setCaptchaToken("")}
                  onError={() => setCaptchaToken("")}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 h-10 bg-white text-black border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-10 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {submitting ? "Filing..." : "File Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
