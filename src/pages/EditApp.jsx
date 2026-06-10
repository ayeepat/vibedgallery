import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateVerificationToken } from "@/lib/verifyOwnership";
import { checkImageSafety, uploadImage, deleteImage } from "@/lib/imageCheck";
import { sendEmail, checkImageSafetyRemote } from "@/lib/edgeFunctions";
import { checkUrlSafety } from "@/lib/safeBrowsing";
import { normalizeUrl, isValidSlug } from "@/lib/urlHelpers";
import { usePageMeta } from "@/lib/usePageMeta";
import Nav from "@/components/Nav";
import { toast } from "@/components/ui/use-toast";
import { Loader2, X, Download, Image as ImageIcon, ArrowLeft } from "lucide-react";

const CATEGORIES = [
  "Productivity", "Creative", "Developer Tool", "Game",
  "AI", "Education", "Finance", "Health", "Social", "Other",
];

const TOOLS = [
  "Cursor", "Windsurf", "Bolt", "Lovable", "Replit",
  "Claude", "ChatGPT", "Gemini", "v0", "Other",
];

// ─── Build the verification HTML file the user adds to /public ─────
function downloadVerificationFile(token) {
  // Tokens are self-generated hex, but escape anyway so a tampered value can
  // never break out of the attribute/body in the downloaded file.
  const t = String(token)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="vibedgallery-verification" content="${t}">
  <title>VibedGallery Verification</title>
</head>
<body>
  <!-- VibedGallery Site Verification -->
  ${t}
</body>
</html>`;
  const blob = new Blob([html], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    if (typeof a.download === "undefined") {
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ─── Drag & Drop Upload (lifted unchanged from Submit.jsx) ──────────
function DragDropUpload({ label, onFile, preview = null, onRemove = undefined, required = false, multiple = false }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragOut = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
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
              <span className="text-[9px] text-[#AAAAAA] block mt-1">JPG, PNG, WebP — max 5MB</span>
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

function Field({ label, required = false, children }) {
  return (
    <div className="border-b border-[#E5E5E5]">
      <label className="block px-4 pt-3 text-[9px] font-bold uppercase tracking-widest text-[#717171]">
        {label} {required && <span className="text-black">*</span>}
      </label>
      {children}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-black bg-[#FFF0F0] border-b border-[#FFD0D0]">
      ⚠ {msg}
    </p>
  );
}

const cleanSlug = (v) => String(v).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

export default function EditApp() {
  const { appId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  usePageMeta({
    title: "Edit Submission",
    description: "Propose an edit to an approved VibedGallery app.",
    path: `/edit/${appId}`,
    noindex: true,
  });

  // Page-load state
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Live (approved) row — the "previous values" reference.
  const [app, setApp] = useState(null);
  // Existing pending edit (if any) — so the user can continue iterating on it.
  const [existingEdit, setExistingEdit] = useState(null);

  // Form state
  const [form, setForm] = useState({
    title: "", tagline: "", description: "", url: "",
    category: "", tags: "", primaryTool: "", otherTools: "",
    demoVideoUrl: "", twitterHandle: "", githubRepo: "",
    slug: "",
  });

  // Thumbnail: either a freshly-picked File (replaces existing) or a kept URL.
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  // Screenshots: mix of {kind:'url',url} (kept) and {kind:'file',file,preview} (new).
  const [screenshots, setScreenshots] = useState([]);

  const [errors, setErrors] = useState(/** @type {Record<string, string | null>} */ ({}));
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Verification step (only entered when URL changed).
  const [step, setStep] = useState("form"); // "form" | "verification" | "success"
  const [verificationToken, setVerificationToken] = useState("");
  const [fileDownloaded, setFileDownloaded] = useState(false);
  const [editId, setEditId] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Load app + any existing pending edit. RLS scopes to owner/admin already.
  useEffect(() => {
    let cancelled = false;
    if (!user || !appId) return;
    setLoadingApp(true);
    setLoadError("");
    (async () => {
      const { data: appData, error: appErr } = await supabase
        .from("apps")
        .select("id, user_id, title, tagline, description, url, category, tags, primary_tool, other_tools, demo_video_url, thumbnail_url, screenshot_urls, slug, submitter_twitter, submitter_github, status")
        .eq("id", appId)
        .maybeSingle();
      if (cancelled) return;

      if (appErr || !appData) {
        setLoadError("App not found or you don't have access.");
        setLoadingApp(false);
        return;
      }
      if (appData.user_id !== user.id) {
        setLoadError("You can only edit apps you submitted.");
        setLoadingApp(false);
        return;
      }
      if (appData.status !== "approved") {
        setLoadError("Only approved apps can be edited from here. Pending or rejected apps use the original submission flow.");
        setLoadingApp(false);
        return;
      }

      const { data: editData } = await supabase
        .from("app_edits")
        .select("*")
        .eq("app_id", appId)
        .in("status", ["pending_verification", "pending_review"])
        .maybeSingle();
      if (cancelled) return;

      const src = editData || appData;
      setApp(appData);
      setExistingEdit(editData || null);
      setForm({
        title: src.title || "",
        tagline: src.tagline || "",
        description: src.description || "",
        url: src.url || "",
        category: src.category || "",
        tags: (src.tags || []).join(", "),
        primaryTool: src.primary_tool || "",
        otherTools: src.other_tools || "",
        demoVideoUrl: src.demo_video_url || "",
        twitterHandle: src.submitter_twitter || "",
        githubRepo: src.submitter_github || "",
        slug: src.slug || "",
      });
      setThumbnailUrl(src.thumbnail_url || "");
      setScreenshots(
        (src.screenshot_urls || []).map((url) => ({ kind: "url", url, preview: url }))
      );
      // Resume mid-verification: if there's an in-flight edit whose status is
      // pending_verification (URL changed but creator never deployed the new
      // HTML file), drop them straight onto that step instead of the form so
      // they can finish the flow without re-submitting.
      if (editData && editData.status === "pending_verification" && editData.verification_token) {
        setEditId(editData.id);
        setVerificationToken(editData.verification_token);
        setStep("verification");
      }
      setLoadingApp(false);
    })();
    return () => { cancelled = true; };
  }, [appId, user]);

  const handleThumbnail = async (file) => {
    try {
      const check = await checkImageSafety(file);
      if (!check.safe) {
        setErrors((e) => ({ ...e, thumbnail: check.errors.join(", ") }));
        return;
      }
      setErrors((e) => ({ ...e, thumbnail: null }));
      setThumbnailFile(file);
      setThumbnailUrl(URL.createObjectURL(file));
    } catch {
      setErrors((e) => ({ ...e, thumbnail: "Failed to process image" }));
    }
  };

  const handleScreenshot = async (file) => {
    if (screenshots.length >= 4) return;
    try {
      const check = await checkImageSafety(file);
      if (!check.safe) { setGlobalError(check.errors.join(", ")); return; }
      setScreenshots((s) => [...s, { kind: "file", file, preview: URL.createObjectURL(file) }]);
    } catch (err) {
      setGlobalError(err?.message || "Failed to process screenshot.");
    }
  };

  const parseTags = (raw) =>
    (raw || "").split(",").map((t) => t.trim()).filter(Boolean);

  const validate = () => {
    const e = /** @type {Record<string, string | null>} */ ({});
    if (!form.title.trim()) e.title = "Required";
    if (!form.tagline.trim()) e.tagline = "Required";
    if (form.tagline.length > 80) e.tagline = "Max 80 characters";
    if (!form.description.trim()) e.description = "Required";
    if (form.description.length > 500) e.description = "Max 500 characters";
    if (!form.url.trim()) e.url = "Required";
    if (!form.category) e.category = "Required";
    if (!form.primaryTool) e.primaryTool = "Required";
    if (!form.slug.trim()) e.slug = "Required";
    else if (!isValidSlug(form.slug)) e.slug = "1–60 chars: a–z, 0–9, - or _";
    if (!thumbnailFile && !thumbnailUrl) e.thumbnail = "Thumbnail is required";
    if (parseTags(form.tags).length > 5) e.tags = "Max 5 tags";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // No-op edit guard: bail early if NOTHING differs from the live app row.
    // Otherwise the admin sees an edit with "No changes detected" and the
    // app_edits table fills with noise. Image changes are detected via
    // thumbnailFile / any screenshot whose kind === "file".
    const tagsList = parseTags(form.tags).slice(0, 5).join(",");
    const liveTagsList = (app?.tags || []).join(",");
    const liveScreens = (app?.screenshot_urls || []).join(",");
    const keptScreens = screenshots.filter((s) => s.kind === "url").map((s) => s.url).join(",");
    const hasFileChange = !!thumbnailFile || screenshots.some((s) => s.kind === "file");
    const fieldChanges = (
      form.title.trim() !== (app?.title || "") ||
      form.tagline.trim() !== (app?.tagline || "") ||
      form.description.trim() !== (app?.description || "") ||
      normalizeUrl(form.url) !== (app?.url || "") ||
      form.category !== (app?.category || "") ||
      form.primaryTool !== (app?.primary_tool || "") ||
      (form.otherTools || "") !== (app?.other_tools || "") ||
      (form.demoVideoUrl ? normalizeUrl(form.demoVideoUrl) : null) !== (app?.demo_video_url || null) ||
      (form.twitterHandle || "") !== (app?.submitter_twitter || "") ||
      (form.githubRepo ? normalizeUrl(form.githubRepo) : null) !== (app?.submitter_github || null) ||
      form.slug.trim() !== (app?.slug || "") ||
      tagsList !== liveTagsList ||
      keptScreens !== liveScreens
    );
    if (!fieldChanges && !hasFileChange) {
      setGlobalError("You haven't changed anything yet. Make at least one change before submitting.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    const newlyUploaded = [];

    try {
      const newUrl = normalizeUrl(form.url);
      const urlChanged = newUrl !== app.url;
      const slugChanged = form.slug.trim() !== (app.slug || "");

      // If slug changed, make sure it doesn't collide with another of this
      // maker's apps. We can't enforce this in app_edits (it's not in apps yet)
      // so we do the live check here. The unique constraint on apps catches
      // anything that races at approval time.
      if (slugChanged) {
        // Rejected rows don't hold a slug (the unique index excludes them).
        const { data: clash } = await supabase
          .from("apps")
          .select("id")
          .eq("user_id", user.id)
          .eq("slug", form.slug.trim())
          .neq("id", app.id)
          .neq("status", "rejected")
          .maybeSingle();
        if (clash) {
          setErrors((e) => ({ ...e, slug: "You already have another app with this link" }));
          setSubmitting(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      // Re-run Safe Browsing on the new URL whenever it changed. Old URL was
      // already vetted at approval time, so skip the check in that case.
      // We treat skipped/degraded as "no verdict" — submission proceeds, but
      // we DON'T claim safe_browsing_passed=true on the edit row, so the
      // admin queue still surfaces the bypass.
      let safety = { safe: true, threats: [], skipped: false };
      if (urlChanged) {
        setUploadProgress("Checking URL safety...");
        safety = await checkUrlSafety(newUrl);
        if (safety.error) {
          setGlobalError(safety.error);
          setSubmitting(false);
          return;
        }
        if (!safety.safe && !safety.skipped) {
          setGlobalError(
            `This URL was flagged as unsafe: ${(safety.threats || []).join(", ")}. We cannot accept this edit.`
          );
          setSubmitting(false);
          return;
        }
      }

      // Upload new thumbnail if one was picked. Otherwise we keep the existing
      // public URL on the apps row.
      let finalThumbnailUrl = thumbnailUrl;
      if (thumbnailFile) {
        setUploadProgress("Uploading thumbnail...");
        const thumb = await uploadImage(thumbnailFile, user.id, "thumbnails");
        newlyUploaded.push(thumb.storagePath);
        setUploadProgress("Checking thumbnail...");
        const mod = await checkImageSafetyRemote(thumb.publicUrl);
        if (!mod.safe) {
          await Promise.all(newlyUploaded.map(deleteImage));
          setGlobalError(
            mod.error
              || (mod.threats?.length
                ? `Thumbnail flagged: ${mod.threats.join(", ")}.`
                : "Thumbnail rejected by image safety check.")
          );
          setSubmitting(false);
          return;
        }
        finalThumbnailUrl = thumb.publicUrl;
      }

      // Upload any newly-added screenshots. Kept-URL entries pass through.
      const finalScreenshotUrls = [];
      for (let i = 0; i < screenshots.length; i++) {
        const s = screenshots[i];
        if (s.kind === "url") {
          finalScreenshotUrls.push(s.url);
          continue;
        }
        setUploadProgress(`Uploading screenshot ${i + 1}...`);
        const shot = await uploadImage(s.file, user.id, "screenshots");
        newlyUploaded.push(shot.storagePath);
        setUploadProgress(`Checking screenshot ${i + 1}...`);
        const mod = await checkImageSafetyRemote(shot.publicUrl);
        if (!mod.safe) {
          await Promise.all(newlyUploaded.map(deleteImage));
          setGlobalError(
            mod.error
              || (mod.threats?.length
                ? `Screenshot ${i + 1} flagged: ${mod.threats.join(", ")}.`
                : `Screenshot ${i + 1} rejected by image safety check.`)
          );
          setSubmitting(false);
          return;
        }
        finalScreenshotUrls.push(shot.publicUrl);
      }

      setUploadProgress("Saving edit...");

      const newToken = urlChanged ? generateVerificationToken() : null;
      const editStatus = urlChanged ? "pending_verification" : "pending_review";

      // REPLACE any existing pending edit: delete-then-insert. RLS allows the
      // owner to do both on their own pending edit, and the partial unique
      // index would otherwise reject the insert.
      if (existingEdit?.id) {
        const { error: delErr } = await supabase
          .from("app_edits")
          .delete()
          .eq("id", existingEdit.id);
        if (delErr) throw delErr;
      }

      const insertPayload = {
        app_id: app.id,
        user_id: user.id,
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        url: newUrl,
        category: form.category,
        tags: parseTags(form.tags).slice(0, 5),
        primary_tool: form.primaryTool,
        other_tools: form.otherTools || null,
        demo_video_url: form.demoVideoUrl ? normalizeUrl(form.demoVideoUrl) : null,
        thumbnail_url: finalThumbnailUrl,
        screenshot_urls: finalScreenshotUrls,
        slug: form.slug.trim(),
        submitter_twitter: form.twitterHandle || null,
        submitter_github: form.githubRepo ? normalizeUrl(form.githubRepo) : null,
        status: editStatus,
        verification_token: newToken,
        ownership_verified: false,
        // Pass only on a real clean verdict — skipped/degraded is NOT a pass.
        safe_browsing_passed: urlChanged ? (safety.safe === true && !safety.skipped) : null,
        safe_browsing_threats: urlChanged ? (safety.threats || []) : null,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("app_edits")
        .insert(insertPayload)
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Best-effort admin notification about the new edit.
      sendEmail("edit_submitted", { id: app.id }, { editId: inserted.id });

      setEditId(inserted.id);
      if (urlChanged) {
        setVerificationToken(newToken);
        setStep("verification");
      } else {
        setStep("success");
        toast({
          title: "Edit submitted",
          description: "Your changes are pending admin review.",
        });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Edit submit failed:", err);
      setGlobalError(err?.message || "Something went wrong saving the edit.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  };

  // Both "I've deployed the file" and "Skip for now" flip the edit to
  // pending_review. We do NOT set ownership_verified from the client — only
  // the admin's server-side verifyHtml result is trusted to flip that flag.
  // Setting it here previously created a verified-badge spoofing path on
  // force-approve (see Admin.jsx handleApprove).
  const moveToReviewQueue = async () => {
    if (!editId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("app_edits")
        .update({ status: "pending_review" })
        .eq("id", editId);
      if (error) throw error;
      setStep("success");
    } catch (err) {
      setGlobalError(err?.message || "Failed to update edit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingApp) {
    return (
      <div className="min-h-screen bg-white">
        <Nav hideSearch />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-[#AAAAAA]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white">
        <Nav hideSearch />
        <div className="max-w-md mx-auto px-6 py-24 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">Can't edit</p>
          <h1 className="text-3xl font-black uppercase mb-4" style={{ letterSpacing: "-0.04em" }}>
            {loadError}
          </h1>
          <Link
            to="/profile"
            className="inline-flex h-12 px-6 items-center justify-center gap-3 bg-black text-white hover:bg-[#222] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Back to profile</span>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "verification") {
    const cleanUrl = normalizeUrl(form.url).replace(/\/$/, "");
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Nav hideSearch />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
          <div className="w-full max-w-lg">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to edit form
            </button>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">Step 2 — Re-verify Ownership</p>
            <h1 className="text-4xl font-black uppercase leading-none mb-6" style={{ letterSpacing: "-0.04em" }}>
              NEW URL,<br />NEW FILE.
            </h1>
            <p className="text-sm text-[#717171] mb-8 leading-relaxed">
              You changed your app's URL, so we need to confirm you own the new site too. Drop the verification file in its public folder.
            </p>

            <div className="border border-[#E5E5E5] mb-4">
              <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-3">
                <span className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black">Download verification file</span>
              </div>
              <div className="p-6">
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

            <div className="border border-[#E5E5E5] mb-4">
              <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-3">
                <span className="w-6 h-6 bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black">Deploy at the new URL</span>
              </div>
              <div className="p-6 space-y-2">
                <p className="text-[11px] text-[#717171] leading-relaxed">
                  After deploying, the file must be accessible at:
                </p>
                <p className="text-[11px] font-mono text-black break-all">
                  {cleanUrl}/{verificationToken}.html
                </p>
              </div>
            </div>

            {globalError && (
              <div className="mb-4 border border-[#E5E5E5] p-4 bg-[#FFF0F0]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-black">⚠ {globalError}</p>
              </div>
            )}

            <div className="border border-[#E5E5E5]">
              <button
                onClick={moveToReviewQueue}
                disabled={submitting || !fileDownloaded}
                className="h-14 w-full flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {submitting ? "Submitting..." : !fileDownloaded ? "Download the file first" : "I've Deployed The File →"}
                </span>
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              </button>
              <button
                onClick={moveToReviewQueue}
                disabled={submitting}
                className="h-10 w-full flex items-center px-6 text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors border-t border-[#E5E5E5] disabled:opacity-50"
              >
                Skip for now — verify later
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Nav hideSearch />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">Edit Submitted</p>
            <h1 className="text-5xl font-black uppercase leading-none mb-6" style={{ letterSpacing: "-0.04em" }}>
              PENDING<br />REVIEW.
            </h1>
            <p className="text-sm text-[#717171] mb-8 leading-relaxed max-w-xs mx-auto">
              Your changes are queued for admin review. Your app stays live with the current content until the edit is approved.
            </p>
            <div className="border border-[#E5E5E5]">
              <Link to="/profile" className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group">
                <span className="text-[10px] font-bold uppercase tracking-widest">Back to Profile</span>
                <span className="text-xs text-[#888] group-hover:text-[#bbb]">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main edit form ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <Nav hideSearch />
      <div className="pt-14">
        <div className="border-b border-[#E5E5E5] px-8 py-10 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-3">Edit Submission</p>
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-black uppercase leading-none" style={{ letterSpacing: "-0.04em" }}>
              UPDATE YOUR<br />APP.
            </h1>
          </div>
          <p className="text-xs text-[#717171] max-w-xs text-right leading-relaxed hidden md:block">
            Your edit goes to admin review. Your app stays live with the current content until approved.
          </p>
        </div>

        {existingEdit && (
          <div className="border-b border-[#E5E5E5] px-8 py-3 bg-[#F5F5F5]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
              ✎ You have an edit pending review — saving will replace it with these new values.
            </span>
          </div>
        )}

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
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
                <FieldError msg={errors.title} />

                <Field label="Tagline (max 80 chars)" required>
                  <input type="text" value={form.tagline} maxLength={80} onChange={(e) => set("tagline", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
                <FieldError msg={errors.tagline} />

                <Field label="Description (max 500 chars)" required>
                  <textarea value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)}
                    rows={4}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none resize-none" />
                  <div className="px-4 pb-2 flex justify-end">
                    <span className="text-[9px] text-[#AAAAAA]">{form.description.length}/500</span>
                  </div>
                </Field>
                <FieldError msg={errors.description} />

                <Field label="App URL" required>
                  <input type="text" value={form.url} onChange={(e) => set("url", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
                <FieldError msg={errors.url} />
                {app && normalizeUrl(form.url) !== app.url && form.url.trim() && (
                  <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-black bg-[#FFF8E6] border-b border-[#F0E0A0]">
                    ⚠ URL changed — you'll re-verify ownership on the new site after saving.
                  </p>
                )}

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
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
                <FieldError msg={errors.tags} />
              </div>

              <div className="px-8 py-4 border-y border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Your Public Link</span>
              </div>
              <div className="border border-[#E5E5E5] mx-8 mt-6 mb-6">
                <div className="px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] block mb-1.5">
                    Your app will live at
                  </span>
                  <p className="text-xs font-mono text-black break-all leading-relaxed">
                    vibedgallery.com/<span className="font-bold">{profile?.username || "username"}</span>
                    /<span className="font-bold">{form.slug || "app-name"}</span>
                  </p>
                </div>
                <Field label="App link (slug)" required>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => set("slug", cleanSlug(e.target.value))}
                    maxLength={60}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none lowercase"
                  />
                </Field>
                <FieldError msg={errors.slug} />
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
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>

                <Field label="Demo Video URL">
                  <input type="text" value={form.demoVideoUrl} onChange={(e) => set("demoVideoUrl", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
              </div>

              <div className="px-8 py-4 border-y border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Optional Links</span>
              </div>
              <div className="border border-[#E5E5E5] mx-8 mt-6 mb-8">
                <Field label="Twitter / X Handle">
                  <input type="text" value={form.twitterHandle} onChange={(e) => set("twitterHandle", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
                <Field label="GitHub Repository">
                  <input type="text" value={form.githubRepo} onChange={(e) => set("githubRepo", e.target.value)}
                    className="w-full px-4 pb-3 pt-1 text-xs text-black bg-white focus:outline-none" />
                </Field>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              <div className="px-8 py-4 border-b border-[#E5E5E5] bg-[#F5F5F5]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">Media</span>
              </div>

              <div className="px-8 py-6 space-y-6">
                <DragDropUpload
                  label="Thumbnail (shown in gallery)"
                  required
                  onFile={handleThumbnail}
                  preview={thumbnailUrl}
                  onRemove={() => { setThumbnailFile(null); setThumbnailUrl(""); }}
                />
                <FieldError msg={errors.thumbnail} />

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
            </div>
          </div>

          <div className="border-t border-[#E5E5E5]">
            {submitting && uploadProgress && (
              <div className="px-8 py-4 bg-[#F5F5F5] border-b border-[#E5E5E5]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                  {uploadProgress}
                </p>
              </div>
            )}
            <div className="flex">
              <Link
                to="/profile"
                className="h-16 flex items-center justify-center px-8 bg-white text-black border-r border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">Cancel</span>
              </Link>
              <button type="submit" disabled={submitting}
                className="flex-1 h-16 flex items-center justify-between px-8 bg-black text-white hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {submitting ? "Submitting..." : existingEdit ? "Replace Pending Edit" : "Submit Edit For Review"}
                </span>
                {submitting
                  ? <Loader2 className="w-4 h-4 animate-spin text-[#888]" />
                  : <span className="text-sm text-[#888]">→</span>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
