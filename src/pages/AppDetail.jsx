import { useParams, Link, useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "@/components/Footer";
import { useApp, useAppByHandle, useMaker } from "@/lib/useApps";
import { appPath, safeHttpUrl } from "@/lib/urlHelpers";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { toggleUpvoteCount, rollbackUpvoteCount, nextUpvoted } from "@/lib/upvote";
import BookmarkButton from "@/components/BookmarkButton";
import ReportDialog from "@/components/ReportDialog";

// Returns an embeddable src for YouTube/Vimeo/Loom URLs, or null if the URL
// isn't a recognized provider (in which case we render a plain link).
function getEmbedUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === "loom.com" || host.endsWith(".loom.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("share");
      const id = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch {
    // Not a parseable URL — fall through to null.
  }
  return null;
}

// Twitter handles are stored as "@name" or bare. Returns a usable URL or null.
function twitterUrl(raw) {
  if (!raw) return null;
  const handle = raw.replace(/^@/, "").trim();
  if (!handle) return null;
  if (/^https?:\/\//i.test(raw)) return safeHttpUrl(raw);
  return `https://x.com/${encodeURIComponent(handle)}`;
}

// One view per browser session per app — keeps the counter honest without
// requiring auth and prevents F5-spam from skewing it.
const VIEW_SESSION_KEY = "vibedgallery_viewed_apps";

function markViewedThisSession(appId) {
  try {
    const raw = sessionStorage.getItem(VIEW_SESSION_KEY);
    const set = new Set(raw ? JSON.parse(raw) : []);
    if (set.has(appId)) return false;
    set.add(appId);
    sessionStorage.setItem(VIEW_SESSION_KEY, JSON.stringify([...set]));
    return true;
  } catch {
    // sessionStorage blocked — best-effort, fall back to counting once per mount.
    return true;
  }
}

export default function AppDetail() {
  // This component serves both the legacy /app/:id route and the pretty
  // /:username/:slug route. useParams gives us whichever pair matched.
  const { id, username, slug } = useParams();
  const navigate = useNavigate();

  const byId = useApp(id);
  const byHandle = useAppByHandle(username, slug);
  const { data: app, isLoading, error } = id ? byId : byHandle;

  const { data: maker } = useMaker(app?.user_id);

  // Legacy /app/:id links redirect to the canonical pretty URL once the maker
  // handle + slug resolve, so shared/old links land on /<username>/<slug>.
  useEffect(() => {
    if (!id || !app) return;
    if (app.username && app.slug) {
      navigate(appPath(app), { replace: true });
    }
  }, [id, app, navigate]);

  // Bump the views counter once per session. Fire-and-forget — failures
  // here don't matter for rendering the page.
  useEffect(() => {
    if (!app?.id) return;
    if (!markViewedThisSession(app.id)) return;
    Promise.resolve(
      supabase.rpc("increment_app_views", { target_app_id: app.id })
    )
      .then(({ error: rpcError }) => {
        if (rpcError) console.warn("view counter failed:", rpcError.message);
      })
      .catch((err) => console.warn("view counter threw:", err?.message ?? err));
  }, [app?.id]);

  // Per-app meta. usePageMeta safely handles undefined values — it falls back
  // to defaults until the app row resolves.
  const structuredData = useMemo(() => {
    if (!app) return null;
    return {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: app.name,
      headline: app.name,
      description: app.tagline || app.description,
      image: app.image,
      url: `https://www.vibedgallery.com${appPath(app)}`,
      datePublished: app.created_at,
      author: maker?.name
        ? { "@type": "Person", name: maker.name }
        : { "@type": "Organization", name: "VibedGallery Maker" },
      genre: app.category,
      keywords: [app.category, app.tool, ...(app.tags || [])]
        .filter(Boolean)
        .join(", "),
      // No aggregateRating: we don't have a star-rating system. Upvotes are not
      // ratings, and forging a 5-star rating from them is the kind of trick
      // Google rewards with a manual action. If we add real reviews later,
      // populate this block from that data — not from upvote counts.
    };
  }, [app, maker]);

  // Don't let search engines index a soft-404 (app missing / RLS-filtered) or
  // an app that isn't publicly approved — only live gallery entries belong in
  // the index. While loading we also withhold indexing until the row resolves.
  const shouldNoindex = isLoading || !!error || !app || app.status !== "approved";

  usePageMeta({
    title: app ? `${app.name} — ${app.tagline || app.category}` : "App",
    description: app
      ? (app.description || app.tagline || `${app.name} — built with ${app.tool}.`).slice(0, 200)
      : "App details on VibedGallery.",
    path: app ? appPath(app) : `/app/${id || ""}`,
    image: app?.image,
    type: "article",
    noindex: shouldNoindex,
    structuredData: shouldNoindex ? null : structuredData,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-[#AAAAAA]" />
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">App not found.</p>
          <Link
            to="/gallery"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black underline underline-offset-4"
          >
            ← Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  const makerName = maker?.name || "Anonymous Maker";
  // Scheme-gate every stored URL before it becomes an href (see safeHttpUrl).
  const liveUrl = safeHttpUrl(app.url);
  const demoUrl = safeHttpUrl(app.demo_video_url);
  const embedUrl = getEmbedUrl(demoUrl);
  const twitter = twitterUrl(app.submitter_twitter);
  const github = safeHttpUrl(app.submitter_github);
  const screenshots = (Array.isArray(app.screenshots) ? app.screenshots : [])
    .filter((src) => safeHttpUrl(src));

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <div className="pt-14 max-w-4xl mx-auto px-6 py-12">
        {/* Back */}
        <Link
          to="/gallery"
          className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
        >
          ← Back to Gallery
        </Link>

        {/* Thumbnail */}
        <div className="mt-6 relative w-full aspect-video overflow-hidden bg-[#F0F0F0] border border-[#E5E5E5]">
          <img
            src={app.image}
            alt={app.name}
            className="w-full h-full object-cover"
          />
          {app.ownership_verified && (
            <span
              title="Ownership verified by maker"
              className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E5E5E5] text-black px-3 py-1.5"
            >
              ✓ Verified
            </span>
          )}
        </div>

        {/* Header */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#E5E5E5] pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-2 py-0.5">
                {app.category}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#717171]">
                Built with {app.tool}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black uppercase text-black leading-none break-words"
              style={{ letterSpacing: "-0.04em" }}
            >
              {app.name}
            </h1>
            <p className="mt-3 text-sm text-[#717171] max-w-lg leading-relaxed">
              {app.tagline}
            </p>
            {/* Maker line */}
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              By{" "}
              <Link
                to={`/maker/${app.user_id}`}
                className="text-black hover:underline underline-offset-4"
              >
                {makerName}
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {/* Upvote */}
            <UpvoteButton appId={app.id} initialCount={app.upvotes} returnPath={appPath(app)} />
            {/* Save / bookmark */}
            <BookmarkButton appId={app.id} variant="block" />
            {/* Visit */}
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-12 px-8 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                Visit Live Site →
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">About</p>
          <p className="text-base text-black leading-relaxed max-w-2xl">{app.description}</p>
        </div>

        {/* Tag pills — link to /tag/:tag landing pages */}
        {Array.isArray(app.tags) && app.tags.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">Tags</p>
            <div className="flex flex-wrap gap-2">
              {app.tags.map((t) => (
                <Link
                  key={t}
                  to={`/tag/${encodeURIComponent(t)}`}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-3 py-1.5 hover:text-black hover:border-black transition-colors"
                >
                  #{t}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Demo video */}
        {demoUrl && (
          <div className="mt-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">Demo</p>
            {embedUrl ? (
              <div className="relative w-full aspect-video border border-[#E5E5E5] bg-black">
                <iframe
                  src={embedUrl}
                  title={`${app.name} demo video`}
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black border border-[#E5E5E5] px-4 py-2 hover:bg-black hover:text-white transition-colors"
              >
                Watch demo →
              </a>
            )}
          </div>
        )}

        {/* Screenshots */}
        {screenshots.length > 0 && (
          <div className="mt-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">Screenshots</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {screenshots.map((src, i) => (
                <a
                  key={src + i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-full aspect-video overflow-hidden bg-[#F0F0F0] border border-[#E5E5E5] group"
                >
                  <img
                    src={src}
                    alt={`${app.name} screenshot ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Maker links + other tools */}
        {(twitter || github || app.other_tools) && (
          <div className="mt-10 border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
            {app.other_tools && (
              <div className="p-5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-1">Other Tools</p>
                <p className="text-sm text-black break-words">{app.other_tools}</p>
              </div>
            )}
            {twitter && (
              <a
                href={twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors group"
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-1">Maker on X / Twitter</p>
                  <p className="text-sm font-black uppercase tracking-tight text-black break-all">
                    {app.submitter_twitter.startsWith("@") ? app.submitter_twitter : `@${app.submitter_twitter.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "")}`}
                  </p>
                </div>
                <span className="text-xs text-[#717171] group-hover:text-black shrink-0 ml-3">↗</span>
              </a>
            )}
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors group"
              >
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-1">Source on GitHub</p>
                  <p className="text-sm font-black uppercase tracking-tight text-black break-all">
                    {github.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "")}
                  </p>
                </div>
                <span className="text-xs text-[#717171] group-hover:text-black shrink-0 ml-3">↗</span>
              </a>
            )}
          </div>
        )}

        {/* Report */}
        <div className="mt-10 flex justify-end">
          <ReportDialog appId={app.id} />
        </div>

        {/* Meta row */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 border border-[#E5E5E5]">
          {[
            { label: "Category", value: app.category },
            { label: "Built With", value: app.tool },
            { label: "Upvotes", value: app.upvotes ?? 0 },
            { label: "Views", value: app.views ?? 0 },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className={`p-5 ${i < arr.length - 1 ? "border-b sm:border-b-0 sm:border-r border-[#E5E5E5]" : ""}`}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-1">{item.label}</p>
              <p className="text-sm font-black uppercase tracking-tight text-black">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}

function UpvoteButton({ appId, initialCount, returnPath }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [upvoted, setUpvoted] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  // Keep the displayed count in sync with the latest app data from the cache
  // (e.g. another tab toggled the upvote).
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!user) {
      setUpvoted(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("upvotes")
        .select("id")
        .eq("app_id", appId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setUpvoted(!error && !!data);
    })();

    return () => {
      cancelled = true;
    };
  }, [appId, user]);

  const handleUpvote = async () => {
    if (!isAuthenticated) {
      const from = returnPath || `/app/${appId}`;
      navigate(`/login?from=${encodeURIComponent(from)}`);
      return;
    }
    if (loading) return;

    // Optimistic update — flip immediately, roll back if the server rejects.
    const wasUpvoted = upvoted;
    setUpvoted(nextUpvoted(wasUpvoted));
    setCount((c) => toggleUpvoteCount(c, wasUpvoted));
    setLoading(true);

    try {
      if (wasUpvoted) {
        const { error } = await supabase
          .from("upvotes")
          .delete()
          .eq("app_id", appId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("upvotes")
          .insert({ app_id: appId, user_id: user.id });
        if (error) throw error;
      }

      // Refresh the app + gallery queries so Trending re-sorts. The detail
      // query key is ["app", id] on the legacy route but
      // ["app", "handle", username, slug] on pretty URLs — invalidating the
      // bare ["app"] prefix covers both.
      queryClient.invalidateQueries({ queryKey: ["app"] });
      queryClient.invalidateQueries({ queryKey: ["apps", "approved"] });
    } catch (err) {
      // Roll back the optimistic update.
      setUpvoted(wasUpvoted);
      setCount((c) => rollbackUpvoteCount(c, wasUpvoted));
      console.error("Upvote failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpvote}
      disabled={loading}
      className={`h-12 px-8 text-[10px] font-bold uppercase tracking-widest border transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black disabled:opacity-50 disabled:cursor-not-allowed ${
        upvoted ? "bg-black text-white border-black" : "bg-white text-black border-[#E5E5E5] hover:border-black"
      }`}
    >
      ▲ {count} {upvoted ? "Upvoted" : "Upvote"}
    </button>
  );
}
