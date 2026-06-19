import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAppsByTag } from "@/lib/useApps";
import { appPath } from "@/lib/urlHelpers";
import { usePageMeta } from "@/lib/usePageMeta";
import { GalleryCardSkeleton } from "@/components/Skeleton";
import BookmarkButton from "@/components/BookmarkButton";
import AppImage from "@/components/AppImage";

// Tag-based landing page. URL is /tag/:tag — the tag arrives URL-encoded so we
// decode it once and use the canonical form throughout (page title, hook, link
// echoes). Renders the same grid silhouette as /gallery for consistency.

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.03, 0.4), duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Tag() {
  const params = useParams();
  // useParams keeps it URL-encoded; React Router 6 decodes pathname segments
  // already, but we re-normalize defensively so legacy double-encoded links
  // still resolve.
  const rawTag = params.tag || "";
  const tag = useMemo(() => {
    try {
      return decodeURIComponent(rawTag).trim();
    } catch {
      return rawTag.trim();
    }
  }, [rawTag]);

  const { data, isLoading, isError } = useAppsByTag(tag);
  const apps = data || [];
  // Soft-404 noindex when there are no matching apps so we don't pollute the
  // index with empty tag pages. Real, populated tags get full indexing.
  const empty = !isLoading && !isError && apps.length === 0;

  usePageMeta({
    title: tag ? `#${tag} apps` : "Tag",
    description: tag
      ? `Apps tagged #${tag} on VibedGallery — built with AI coding tools.`
      : "Browse apps by tag on VibedGallery.",
    path: `/tag/${encodeURIComponent(tag)}`,
    noindex: empty,
  });

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <div className="pt-14">
        <div className="border-b border-[#E5E5E5] px-6 py-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-2">
            Tag
          </p>
          <h1
            className="text-3xl sm:text-5xl font-black uppercase leading-none break-words"
            style={{ letterSpacing: "-0.04em" }}
          >
            #{tag}
          </h1>
          <p className="mt-3 text-sm text-[#717171]">
            {isLoading ? "Loading…" : `${apps.length} app${apps.length === 1 ? "" : "s"} tagged #${tag}`}
          </p>
        </div>

        <div className="px-6 py-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <GalleryCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="border border-[#E5E5E5] px-10 py-16 flex flex-col items-center text-center max-w-2xl mx-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Failed to load</p>
              <p className="mt-4 text-sm text-[#717171]">Try refreshing.</p>
            </div>
          ) : apps.length === 0 ? (
            <div className="border border-[#E5E5E5] px-10 py-16 flex flex-col items-center text-center max-w-2xl mx-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">Empty</p>
              <h2
                className="mt-3 text-3xl font-black uppercase text-black leading-none"
                style={{ letterSpacing: "-0.03em" }}
              >
                No Apps Tagged
              </h2>
              <p className="mt-4 text-sm text-[#717171] max-w-sm leading-relaxed">
                Nothing in the gallery uses <span className="font-bold text-black">#{tag}</span> yet.
              </p>
              <Link
                to="/gallery"
                className="mt-8 h-12 px-8 flex items-center gap-3 bg-black text-white hover:bg-[#222] transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">Back to Gallery</span>
                <span className="text-xs text-[#888]">→</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
              {apps.map((app, i) => (
                <motion.div
                  key={app.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className="relative"
                >
                  <Link
                    to={appPath(app)}
                    className="block group focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                  >
                    <div className="relative w-full aspect-video overflow-hidden bg-[#F0F0F0]">
                      <AppImage
                        src={app.image}
                        name={app.name}
                        alt={app.name ? `${app.name} preview` : "App preview"}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black uppercase tracking-tight text-black leading-snug group-hover:underline underline-offset-2">
                          {app.name}
                        </h3>
                        <p className="text-[10px] text-[#717171] mt-0.5">
                          {app.category} · {app.tool}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-[#AAAAAA] whitespace-nowrap mt-0.5">
                        ▲ {app.upvotes}
                      </span>
                    </div>
                  </Link>
                  {/* Sibling of the Link — <button> can't legally nest inside <a>. */}
                  <div className="absolute top-2 right-2 z-10">
                    <BookmarkButton appId={app.id} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
