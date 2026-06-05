import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateVerificationToken } from "@/lib/verifyOwnership";
import { checkImageSafety, uploadImage, deleteImage } from "@/lib/imageCheck";
import { sendEmail, verifyTurnstile, checkImageSafetyRemote } from "@/lib/edgeFunctions";
import { checkUrlSafety } from "@/lib/safeBrowsing";
import { normalizeUrl } from "@/lib/urlHelpers";
import { Loader2, X, Download, Image as ImageIcon } from "lucide-react";
import Nav from "@/components/Nav";
import Turnstile from "@/components/Turnstile";
import { usePageMeta } from "@/lib/usePageMeta";
import { toast } from "@/components/ui/use-toast";
import { formatSubmitError } from "@/lib/submitErrors";

const CATEGORIES = [
  "Productivity", "Creative", "Developer Tool", "Game",
  "AI", "Education", "Finance", "Health", "Social", "Other",
];

const TOOLS = [
  "Cursor", "Windsurf", "Bolt", "Lovable", "Replit",
  "Claude", "ChatGPT", "Gemini", "v0", "Other",
];

const STORAGE_KEY = "vibedgallery_submit_draft";
const DRAFT_TTL = 30 * 60 * 1000;

// ─── Draft helpers ─────────────────────────────────────────────
function saveDraft(form) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, savedAt: Date.now() }));
  } catch {
    // Storage may be full or blocked (private mode) — drafts are best-effort.
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > DRAFT_TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data.form;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Download verification file ────────────────────────────────
function downloadVerificationFile(token) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="vibedgallery-verification" content="${token}">
  <title>VibedGallery Verification</title>
</head>
<body>
  <!-- VibedGallery Site Verification -->
  <!-- Do not remove this file until your app is approved -->
  ${token}
</body>
</html>`;
  // octet-stream so browsers treat it as a download rather than navigating to /
  // rendering the HTML (Safari in particular). The verification step also shows
  // the file contents on-screen, so a failed download is never a dead end.
  const blob = new Blob([html], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    if (typeof a.download === "undefined") {
      // Ancient browser without the download attribute — last-resort new tab.
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      a.href = url;
      a.download = `${token}.html`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } finally {
    // Revoke after a tick so the download/navigation has a chance to start.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ─── Drag & Drop Upload ────────────────────────────────────────
function DragDropUpload({ label, onFile, preview, onRemove, required, multiple = false }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragOut = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (multiple) Array.from(files).forEach((f) => onFile(f));
      else onFile(files[0]);
    }
  }, [onFile, multiple]);

  if (preview && !multiple) {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
            {label} {required && <span className="text-black">*</span>}
          </span>
        )}
        <div className="relative border border-[#E5E5E5] aspect-video overflow-hidden">
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 w-7 h-7 bg-black text-white flex items-center justify-center hover:bg-[#333] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
          {label} {required && <span className="text-black">*</span>}
        </span>
      )}
      <div
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => ref.current?.click()}
        className={`border border-dashed aspect-video flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
          dragging
            ? "border-black bg-[#F0F0F0]"
            : "border-[#E5E5E5] hover:border-black hover:bg-[#F5F5F5]"
        }`}
      >
        {dragging ? (
          <>
            <Download className="w-6 h-6 text-black" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-black">Drop it here</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#717171]" />
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#717171] block">
                Drag & drop or click to upload
              </span>
              <span className="text-[9px] text-[#AAAAAA] block mt-1">
                JPG, PNG, WebP — max 5MB
              </span>
            </div>
          </>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (multiple) Array.from(e.target.files).forEach((f) => onFile(f));
          else if (e.target.files[0]) onFile(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="border-b border-[#E5E5E5]">
      <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
        {label} {required && <span className="text-black">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Error row ────────────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-black bg-[#FFF0F0] border-b border-[#FFD0D0]">
      ⚠ {msg}
    </p>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function Submit() {
  // <ProtectedRoute> guarantees the user is signed in before this mounts.
  const { user } = useAuth();

  usePageMeta({
    title: "Submit Your App",
    description: "Submit an app you built with AI coding tools to the VibedGallery gallery.",
    path: "/submit",
    noindex: true,
  });

  const defaultForm = {
    title: "", tagline: "", description: "", url: "",
    category: "", tags: "", primaryTool: "", otherTools: "",
    demoVideoUrl: "", twitterHandle: "", githubRepo: "",
    ownershipConfirmed: false,
  };

  const [form, setForm] = useState(() => loadDraft() || defaultForm);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  // Only the setter is consumed (drives the per-field upload state machine);
  // the value isn't read directly, so we skip binding it.
  const [, setThumbnailStatus] = useState("idle");
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("idle");
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [step, setStep] = useState("form");
  const [verificationToken, setVerificationToken] = useState("");
  const [submittedAppId, setSubmittedAppId] = useState(null);
  const [fileDownloaded, setFileDownloaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(!!loadDraft());
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Auto-save
  useEffect(() => {
    if (step !== "form") return;
    const timer = setInterval(() => saveDraft(form), 5000);
    return () => clearInterval(timer);
  }, [form, step]);

  useEffect(() => {
    const onHide = () => { if (document.hidden && step === "form") saveDraft(form); };
    const onUnload = () => { if (step === "form") saveDraft(form); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [form, step]);

  const handleThumbnail = async (file) => {
    setThumbnailStatus("checking");
    try {
      const check = await checkImageSafety(file);
      if (!check.safe) {
        setErrors((e) => ({ ...e, thumbnail: check.errors.join(", ") }));
        setThumbnailStatus("error");
        return;
      }
      setErrors((e) => ({ ...e, thumbnail: null }));
      setThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(file));
      setThumbnailStatus("ready");
    } catch {
      setErrors((e) => ({ ...e, thumbnail: "Failed to process image" }));
      setThumbnailStatus("error");
    }
  };

  const handleScreenshot = async (file) => {
    if (screenshots.length >= 4) return;
    const check = await checkImageSafety(file);
    if (!check.safe) { setGlobalError(check.errors.join(", ")); return; }
    setScreenshots((s) => [...s, { file, preview: URL.createObjectURL(file) }]);
  };

  const parseTags = (raw) =>
    (raw || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.tagline.trim()) e.tagline = "Required";
    if (form.tagline.length > 80) e.tagline = "Max 80 characters";
    if (!form.description.trim()) e.description = "Required";
    if (form.description.length > 500) e.description = "Max 500 characters";
    if (!form.url.trim()) e.url = "Required";
    if (!form.category) e.category = "Required";
    if (!form.primaryTool) e.primaryTool = "Required";
    if (!thumbnail) e.thumbnail = "Thumbnail is required";
    if (!form.ownershipConfirmed) e.ownership = "You must confirm you built this app";
    if (parseTags(form.tags).length > 5) e.tags = "Max 5 tags";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setErrors({});

    // Validate
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!captchaToken) {
      setGlobalError("Please complete the captcha at the bottom of the form.");
      return;
    }

    setLoading(true);

    try {
      // Captcha — verified server-side; secret never reaches the browser.
      const captcha = await verifyTurnstile(captchaToken, "submit");
      if (!captcha.success) {
        setGlobalError("Captcha verification failed. Try the captcha again.");
        captchaRef.current?.reset();
        setCaptchaToken("");
        setLoading(false);
        return;
      }

      const appUrl = normalizeUrl(form.url);

      // Safe browsing check
      const safety = await checkUrlSafety(appUrl);

      if (safety.error) {
        setGlobalError(safety.error);
        captchaRef.current?.reset();
        setCaptchaToken("");
        setLoading(false);
        return;
      }

      if (!safety.safe) {
        setGlobalError(
          `This URL was flagged as unsafe: ${safety.threats.join(", ")}. We cannot accept this submission.`
        );
        captchaRef.current?.reset();
        setCaptchaToken("");
        setLoading(false);
        return;
      }

      // Upload thumbnail and run it through server-side SafeSearch. The
      // client-side checkImageSafety() only validates MIME + dimensions and
      // is trivially bypassable by anyone hitting the storage API directly,
      // so we re-check on the trusted side after the file is in the bucket.
      // If it's flagged we delete the upload before bailing.
      setUploadProgress("uploading_thumbnail");
      const thumb = await uploadImage(thumbnail, user.id, "thumbnails");
      const uploadedPaths = [thumb.storagePath];

      setUploadProgress("moderating_thumbnail");
      const thumbModeration = await checkImageSafetyRemote(thumb.publicUrl);
      if (!thumbModeration.safe) {
        await Promise.all(uploadedPaths.map(deleteImage));
        const reason = thumbModeration.error
          || (thumbModeration.threats?.length
            ? `Thumbnail flagged: ${thumbModeration.threats.join(", ")}.`
            : "Thumbnail rejected by image safety check.");
        setGlobalError(reason);
        captchaRef.current?.reset();
        setCaptchaToken("");
        setLoading(false);
        return;
      }
      const thumbnailUrl = thumb.publicUrl;

      // Upload screenshots. Each one goes through the same moderation gate;
      // a flagged screenshot kills the whole submission and removes every
      // upload from this attempt.
      const screenshotUrls = [];
      for (let i = 0; i < screenshots.length; i++) {
        setUploadProgress(`uploading_screenshot_${i + 1}/${screenshots.length}`);
        const shot = await uploadImage(screenshots[i].file, user.id, "screenshots");
        uploadedPaths.push(shot.storagePath);

        setUploadProgress(`moderating_screenshot_${i + 1}/${screenshots.length}`);
        const shotModeration = await checkImageSafetyRemote(shot.publicUrl);
        if (!shotModeration.safe) {
          await Promise.all(uploadedPaths.map(deleteImage));
          const reason = shotModeration.error
            || (shotModeration.threats?.length
              ? `Screenshot ${i + 1} flagged: ${shotModeration.threats.join(", ")}.`
              : `Screenshot ${i + 1} rejected by image safety check.`);
          setGlobalError(reason);
          captchaRef.current?.reset();
          setCaptchaToken("");
          setLoading(false);
          return;
        }
        screenshotUrls.push(shot.publicUrl);
      }

      setUploadProgress("inserting_database");

      const token = generateVerificationToken();
      const tags = parseTags(form.tags).slice(0, 5);
      const demoUrl = form.demoVideoUrl ? normalizeUrl(form.demoVideoUrl) : null;
      const githubUrl = form.githubRepo ? normalizeUrl(form.githubRepo) : null;

      const { data, error } = await supabase
        .from("apps")
        .insert({
          user_id: user.id,
          // submitter_email is set server-side by the apps_set_submitter_email
          // trigger from auth.users; the column is also revoked from clients.
          submitter_twitter: form.twitterHandle || null,
          submitter_github: githubUrl,
          title: form.title.trim(),
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          url: appUrl,
          category: form.category,
          tags,
          primary_tool: form.primaryTool,
          other_tools: form.otherTools || null,
          demo_video_url: demoUrl,
          thumbnail_url: thumbnailUrl,
          screenshot_urls: screenshotUrls,
          verification_token: token,
          safe_browsing_passed: safety.safe,
          safe_browsing_threats: safety.threats,
          status: "pending_verification",
        })
        .select("id")
        .single();

      if (error) {
        console.error("DB insert error:", error);
        throw new Error(error.message);
      }

      // Fire-and-forget emails: confirmation to submitter + alert to admin.
      // The edge function looks up the recipient + content from the DB row;
      // we only pass the app id.
      sendEmail("submission_confirmation", { id: data.id });
      sendEmail("admin_notification", { id: data.id });

      clearDraft();
      setVerificationToken(token);
      setSubmittedAppId(data.id);
      setStep("verification");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({
        title: "Submission received",
        description: "Now deploy the verification file to prove ownership.",
      });

    } catch (err) {
      console.error("Submission failed:", err);
      // formatSubmitError maps the server-side rate-limit exception to a clean,
      // generic line — never echoes the raw "5 per hour" policy text.
      setGlobalError(formatSubmitError(err?.message));
      captchaRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  };

  // User claims the file is deployed. We still transition to pending_review
  // (admin re-runs verify-html before approving) but optimistically mark
  // ownership_verified so the queue tile reads correctly.
  const handleVerificationDone = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("apps")
        .update({ ownership_verified: true, status: "pending_review" })
        .eq("id", submittedAppId);
      if (error) throw error;
      setStep("success");
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // "Skip for now" — user wants to deploy the file later. Still move the
  // row into the admin queue (status=pending_review) but DO NOT claim
  // ownership_verified. Admin will run verify-html before approving.
  const handleSkipVerification = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("apps")
        .update({ status: "pending_review" })
        .eq("id", submittedAppId);
      if (error) throw error;
      setStep("success");
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    clearDraft();
    setForm(defaultForm);
    setThumbnail(null);
    setThumbnailPreview(null);
    setScreenshots([]);
    setDraftRestored(false);
    setErrors({});
    setGlobalError("");
  };

  // ─── Verification step ───────────────────────────────────────
  if (step === "verification") {
    const cleanUrl = normalizeUrl(form.url).replace(/\/$/, "");
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Nav hideSearch />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
          <div className="w-full max-w-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">Step 2 — Prove Ownership</p>
            <h1 className="text-4xl font-black uppercase leading-none mb-6" style={{ letterSpacing: "-0.04em" }}>
              VERIFY YOUR<br />SITE.
            </h1>
            <p className="text-sm text-[#717171] mb-8 leading-relaxed">
              Download the verification file and add it to your project's public folder. Same method Google uses.
            </p>

            {/* Step 1 */}
            <div className="border border-[#E5E5E5] mb-4">
              <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-3">
                <span className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black">Download verification file</span>
              </div>
              <div className="p-6">
                <p className="text-xs text-[#717171] mb-4 leading-relaxed">
                  A small HTML file unique to your submission.
                </p>
                <button
                  type="button"
                  onClick={() => { downloadVerificationFile(verificationToken); setFileDownloaded(true); }}
                  className={`w-full h-14 flex items-center gap-3 px-6 border transition-colors ${
                    fileDownloaded
                      ? "bg-[#F5F5F5] border-[#E5E5E5] text-[#717171]"
                      : "bg-black border-black text-white hover:bg-[#222]"
                  }`}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {fileDownloaded ? `✓ Downloaded — ${verificationToken}.html` : `Download ${verificationToken}.html`}
                  </span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-[#E5E5E5] mb-4">
              <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-3">
                <span className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black">Add to your /public folder & deploy</span>
              </div>
              <div className="p-6 space-y-2">
                {[
                  ["React / Vite / Next.js / Vue", `/public/${verificationToken}.html`],
                  ["Svelte", `/static/${verificationToken}.html`],
                  ["Plain HTML", `/${verificationToken}.html (root)`],
                ].map(([fw, path]) => (
                  <div key={fw} className="flex items-start gap-3 text-xs">
                    <span className="font-bold text-black w-40 shrink-0">{fw}</span>
                    <code className="text-[#717171] font-mono text-[11px]">{path}</code>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-[#E5E5E5]">
                  <p className="text-[9px] text-[#AAAAAA]">
                    After deploying, file must be accessible at:{" "}
                    <span className="font-mono text-black">{cleanUrl}/{verificationToken}.html</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 — host-specific gotchas */}
            <div className="border border-[#E5E5E5] mb-4">
              <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-3">
                <span className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black">
                  Host gotchas — check yours
                </span>
              </div>
              <div className="divide-y divide-[#E5E5E5]">
                {[
                  {
                    host: "Vercel",
                    body: "Disable Deployment Protection (Settings → Deployment Protection → Vercel Authentication = Disabled or Only Preview). A catch-all SPA rewrite is fine — static files in /public win over rewrites.",
                  },
                  {
                    host: "Netlify",
                    body: "If you have a catch-all rule in netlify.toml or _redirects (e.g. /* → /index.html 200), it will swallow the file. Add an explicit rule above it: /" + verificationToken + ".html /" + verificationToken + ".html 200",
                  },
                  {
                    host: "Cloudflare Pages",
                    body: "If using _redirects with a SPA fallback, add an explicit allow line for /" + verificationToken + ".html before the wildcard. Check Access policies aren't gating the path.",
                  },
                  {
                    host: "GitHub Pages",
                    body: "Drop the file at the repo root (or /docs depending on your config). No rewrite issues — should just work.",
                  },
                  {
                    host: "Custom server / Nginx / Apache",
                    body: "Make sure your SPA fallback (try_files) checks for the file on disk before falling back to index.html. Default Vite/CRA setups do this correctly.",
                  },
                ].map(({ host, body }) => (
                  <div key={host} className="px-6 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black">
                      {host}
                    </p>
                    <p className="text-[11px] text-[#717171] mt-1 leading-relaxed">{body}</p>
                  </div>
                ))}
                <div className="px-6 py-3 bg-[#FAFAFA]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black">
                    Quick self-test
                  </p>
                  <p className="text-[11px] text-[#717171] mt-1 leading-relaxed">
                    Open{" "}
                    <a
                      href={`${cleanUrl}/${verificationToken}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-black underline break-all"
                    >
                      {cleanUrl}/{verificationToken}.html
                    </a>{" "}
                    in an incognito window. If it returns your homepage or 404, the file isn't being served and verification will fail.
                  </p>
                </div>
              </div>
            </div>

            {globalError && (
              <div className="mb-4 border border-[#E5E5E5] p-4 bg-[#FFF0F0]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-black">⚠ {globalError}</p>
              </div>
            )}

            <div className="border border-[#E5E5E5]">
              <button
                onClick={handleVerificationDone}
                disabled={loading || !fileDownloaded}
                className="h-14 w-full flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {loading ? "Submitting..." : !fileDownloaded ? "Download the file first" : "I've Deployed The File →"}
                </span>
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              </button>
              <button
                onClick={handleSkipVerification}
                disabled={loading}
                className="h-10 w-full flex items-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors border-t border-[#E5E5E5] disabled:opacity-50"
              >
                Skip for now — verify later
              </button>
            </div>
          </div>
        </div>
        <div className="h-12 border-t border-[#E5E5E5] flex items-center px-6 justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">VibedGallery © 2025</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Apps built with AI, shared by their makers.</span>
        </div>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Nav hideSearch />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">Submission Received</p>
            <h1 className="text-5xl font-black uppercase leading-none mb-6" style={{ letterSpacing: "-0.04em" }}>
              YOU'RE<br />IN THE<br />QUEUE.
            </h1>
            <p className="text-sm text-[#717171] mb-8 leading-relaxed max-w-xs mx-auto">
              Pending review. We'll email{" "}
              <span className="font-bold text-black">{user.email}</span>{" "}
              once approved.
            </p>
            <div className="border border-[#E5E5E5]">
              <Link to="/gallery" className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group">
                <span className="text-[10px] font-bold uppercase tracking-widest">Browse the Gallery</span>
                <span className="text-xs text-[#888] group-hover:text-[#bbb]">→</span>
              </Link>
              <Link to="/" className="h-12 flex items-center justify-between px-6 bg-white text-black border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors group">
                <span className="text-[10px] font-bold uppercase tracking-widest">Back to Home</span>
                <span className="text-xs text-[#717171] group-hover:text-black">→</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="h-12 border-t border-[#E5E5E5] flex items-center px-6 justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">VibedGallery © 2025</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Apps built with AI, shared by their makers.</span>
        </div>
      </div>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <Nav hideSearch />
      <div className="pt-14">

        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-8 py-10 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">Submit Your App</p>
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-black uppercase leading-none" style={{ letterSpacing: "-0.04em" }}>
              ADD TO THE<br />GALLERY.
            </h1>
          </div>
          <p className="text-xs text-[#717171] max-w-xs text-right leading-relaxed hidden md:block">
            All submissions are manually reviewed. Usually within 24 hours.
          </p>
        </div>

        {/* Draft banner */}
        {draftRestored && (
          <div className="border-b border-[#E5E5E5] px-8 py-3 bg-[#F5F5F5] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
              ✓ Draft restored
            </span>
            <button onClick={handleClearDraft} className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors">
              Clear ✕
            </button>
          </div>
        )}

        {/* Global error — always visible at top */}
        {globalError && (
          <div className="mx-8 mt-4 border border-[#E5E5E5] p-4 bg-[#FFF0F0]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-black">⚠ {globalError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-[#E5E5E5]">

            {/* LEFT */}
            <div className="lg:border-r border-[#E5E5E5]">
              <div className="px-8 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Basic Information</span>
              </div>

              <div className="border border-[#E5E5E5] mx-8 mt-6 mb-6">
                <Field label="App Name" required>
                  <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
                    placeholder="My Awesome App"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
                <FieldError msg={errors.title} />

                <Field label="Tagline (max 80 chars)" required>
                  <input type="text" value={form.tagline} maxLength={80} onChange={(e) => set("tagline", e.target.value)}
                    placeholder="One sentence that captures your app"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
                <FieldError msg={errors.tagline} />

                <Field label="Description (max 500 chars)" required>
                  <textarea value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)}
                    placeholder="What does your app do? What makes it interesting?"
                    rows={4}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none resize-none" />
                  <div className="px-4 pb-2 flex justify-end">
                    <span className="text-[9px] text-[#AAAAAA]">{form.description.length}/500</span>
                  </div>
                </Field>
                <FieldError msg={errors.description} />

                <Field label="App URL" required>
                  <input type="text" value={form.url} onChange={(e) => set("url", e.target.value)}
                    placeholder="myapp.com"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
                <FieldError msg={errors.url} />

                <Field label="Category" required>
                  <select value={form.category} onChange={(e) => set("category", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none appearance-none">
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <FieldError msg={errors.category} />

                <Field label={`Tags (comma separated, ${parseTags(form.tags).length}/5)`}>
                  <input type="text" value={form.tags} onChange={(e) => set("tags", e.target.value)}
                    placeholder="ai, productivity, open-source"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
                <FieldError msg={
                  errors.tags ||
                  (parseTags(form.tags).length > 5
                    ? `${parseTags(form.tags).length} tags — only the first 5 will be saved`
                    : null)
                } />
              </div>

              <div className="px-8 py-4 border-y border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Built With</span>
              </div>
              <div className="border border-[#E5E5E5] mx-8 mt-6 mb-6">
                <Field label="Primary AI Tool" required>
                  <select value={form.primaryTool} onChange={(e) => set("primaryTool", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none appearance-none">
                    <option value="">Select a tool</option>
                    {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <FieldError msg={errors.primaryTool} />

                <Field label="Other Tools Used">
                  <input type="text" value={form.otherTools} onChange={(e) => set("otherTools", e.target.value)}
                    placeholder="Supabase, Tailwind, Stripe..."
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>

                <Field label="Demo Video URL">
                  <input type="text" value={form.demoVideoUrl} onChange={(e) => set("demoVideoUrl", e.target.value)}
                    placeholder="youtube.com/..."
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
              </div>

              <div className="px-8 py-4 border-y border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Optional Links</span>
              </div>
              <div className="border border-[#E5E5E5] mx-8 mt-6 mb-8">
                <Field label="Twitter / X Handle">
                  <input type="text" value={form.twitterHandle} onChange={(e) => set("twitterHandle", e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
                <Field label="GitHub Repository">
                  <input type="text" value={form.githubRepo} onChange={(e) => set("githubRepo", e.target.value)}
                    placeholder="github.com/you/repo"
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white placeholder:text-[#AAAAAA] focus:outline-none" />
                </Field>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              <div className="px-8 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Media</span>
              </div>

              <div className="px-8 py-6 space-y-6">
                {/* Thumbnail */}
                <DragDropUpload
                  label="Thumbnail (shown in gallery)"
                  required
                  onFile={handleThumbnail}
                  preview={thumbnailPreview}
                  onRemove={() => { setThumbnail(null); setThumbnailPreview(null); }}
                />
                <FieldError msg={errors.thumbnail} />

                {/* Screenshots */}
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] block mb-3">
                    Additional Screenshots (max 4)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {screenshots.map((s, i) => (
                      <div key={i} className="relative border border-[#E5E5E5] aspect-video overflow-hidden">
                        <img src={s.preview} alt={`screenshot ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setScreenshots((arr) => arr.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 w-6 h-6 bg-black text-white flex items-center justify-center hover:bg-[#333]">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {screenshots.length < 4 && (
                      <DragDropUpload label="" onFile={handleScreenshot} multiple />
                    )}
                  </div>
                </div>
              </div>

              {/* Confirmation */}
              <div className="px-8 py-4 border-y border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Confirmation</span>
              </div>
              <div className="px-8 py-6 space-y-4">
                <label className="flex items-start gap-4 cursor-pointer group">
                  <input type="checkbox" checked={form.ownershipConfirmed}
                    onChange={(e) => set("ownershipConfirmed", e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-black shrink-0" />
                  <span className="text-xs text-[#717171] leading-relaxed group-hover:text-black transition-colors">
                    I confirm that I built this application and have the right to submit it.
                    False submissions will result in account suspension.
                  </span>
                </label>
                <FieldError msg={errors.ownership} />

                <div className="border border-[#E5E5E5] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-3">What happens next</p>
                  {[
                    "URL checked against Google Safe Browsing",
                    "You download a verification file for your site",
                    "We manually review your submission",
                    "Email sent when approved (usually 24h)",
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3 mb-2">
                      <span className="text-[9px] font-bold text-[#717171] shrink-0">{i + 1}.</span>
                      <span className="text-[11px] text-[#717171]">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit button with progress */}
          <div className="border-t border-[#E5E5E5]">
            {loading && uploadProgress && uploadProgress !== "idle" && (
              <div className="px-8 py-4 bg-[#F5F5F5] border-b border-[#E5E5E5]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171] mb-2">
                  {uploadProgress === "uploading_thumbnail" && "Uploading thumbnail..."}
                  {uploadProgress === "moderating_thumbnail" && "Checking thumbnail..."}
                  {uploadProgress.startsWith("uploading_screenshot") && `Uploading ${uploadProgress.replace("uploading_screenshot_", "screenshot ")}`}
                  {uploadProgress.startsWith("moderating_screenshot") && `Checking ${uploadProgress.replace("moderating_screenshot_", "screenshot ")}`}
                  {uploadProgress === "inserting_database" && "Finalizing submission..."}
                </p>
                <div className="w-full h-1 bg-[#E5E5E5]">
                  <div 
                    className="h-full bg-black transition-all"
                    style={{
                      width: uploadProgress === "inserting_database" ? "95%" : "60%"
                    }}
                  />
                </div>
              </div>
            )}
            {/* Captcha — server-verified before the row is created */}
            <div className="px-8 py-5 border-t border-[#E5E5E5] flex items-center justify-center">
              <Turnstile
                action="submit"
                innerRef={captchaRef}
                onVerify={(t) => setCaptchaToken(t)}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
              />
            </div>
            {/* Kept clickable; the captcha is validated on submit (handleSubmit
                sets a clear error if it's missing) so the button is never dead. */}
            <button type="submit" disabled={loading}
              className="w-full h-16 flex items-center justify-between px-8 bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {loading ? "Submitting..." : "Submit App for Review"}
              </span>
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin text-[#888]" />
                : <span className="text-sm text-[#888]">→</span>
              }
            </button>
          </div>
        </form>
      </div>

      <div className="h-12 border-t border-[#E5E5E5] flex items-center px-8 justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">VibedGallery © 2025</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Apps built with AI, shared by their makers.</span>
      </div>
    </div>
  );
}