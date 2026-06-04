import { useParams, Link, useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "@/components/Footer";
import { useApp, useMaker } from "@/lib/useApps";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

export default function AppDetail() {
  const { id } = useParams();
  const { data: app, isLoading, error } = useApp(id);
  const { data: maker } = useMaker(app?.user_id);

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
      url: `https://vibedgallery.com/app/${app.id}`,
      datePublished: app.created_at,
      author: maker?.name
        ? { "@type": "Person", name: maker.name }
        : { "@type": "Organization", name: "VibedGallery Maker" },
      genre: app.category,
      keywords: [app.category, app.tool, ...(app.tags || [])]
        .filter(Boolean)
        .join(", "),
      aggregateRating:
        typeof app.upvotes === "number" && app.upvotes > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: 5,
              ratingCount: app.upvotes,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
    };
  }, [app, maker]);

  usePageMeta({
    title: app ? `${app.name} — ${app.tagline || app.category}` : "App",
    description: app
      ? (app.description || app.tagline || `${app.name} — built with ${app.tool}.`).slice(0, 200)
      : "App details on VibedGallery.",
    path: `/app/${id || ""}`,
    image: app?.image,
    type: "article",
    structuredData,
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
            <UpvoteButton appId={app.id} initialCount={app.upvotes} />
            {/* Visit */}
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-8 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Visit Live Site →
            </a>
          </div>
        </div>

        {/* Description */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] mb-3">About</p>
          <p className="text-base text-black leading-relaxed max-w-2xl">{app.description}</p>
        </div>

        {/* Meta row */}
        <div className="mt-10 grid grid-cols-3 border border-[#E5E5E5]">
          {[
            { label: "Category", value: app.category },
            { label: "Built With", value: app.tool },
            { label: "Upvotes", value: app.upvotes },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`p-5 ${i < 2 ? "border-r border-[#E5E5E5]" : ""}`}
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

function UpvoteButton({ appId, initialCount }) {
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
      const from = `/app/${appId}`;
      navigate(`/login?from=${encodeURIComponent(from)}`);
      return;
    }
    if (loading) return;

    // Optimistic update — flip immediately, roll back if the server rejects.
    const wasUpvoted = upvoted;
    setUpvoted(!wasUpvoted);
    setCount((c) => (wasUpvoted ? Math.max(c - 1, 0) : c + 1));
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

      // Refresh the app + gallery queries so Trending re-sorts.
      queryClient.invalidateQueries({ queryKey: ["app", appId] });
      queryClient.invalidateQueries({ queryKey: ["apps", "approved"] });
    } catch (err) {
      // Roll back the optimistic update.
      setUpvoted(wasUpvoted);
      setCount((c) => (wasUpvoted ? c + 1 : Math.max(c - 1, 0)));
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
