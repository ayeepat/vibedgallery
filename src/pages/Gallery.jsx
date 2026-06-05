import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Nav from "../components/Nav";
import Footer from "@/components/Footer";
import { useApprovedApps } from "@/lib/useApps";
import { GalleryCardSkeleton } from "@/components/Skeleton";
import { usePageMeta } from "@/lib/usePageMeta";

const SORTS = ["Newest", "Trending"];
// Mirrors CATEGORIES in src/pages/Submit.jsx so the dropdown can never offer
// something nobody could possibly submit.
const CATEGORIES = [
  "Productivity", "Creative", "Developer Tool", "Game",
  "AI", "Education", "Finance", "Health", "Social", "Other",
];
const ALL_CATEGORIES = "All Categories";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.03, 0.4), duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function Gallery() {
  usePageMeta({
    title: "Gallery — Apps built with AI",
    description:
      "Browse a curated collection of real apps built with AI coding tools. Filter by category, sort by trending or newest, and discover what people are shipping.",
    path: "/gallery",
  });

  const [sort, setSort] = useState("Newest");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [hoveredId, setHoveredId] = useState(null);

  const { data: apps = [], isLoading } = useApprovedApps();

  const filtered = useMemo(() => {
    let list =
      category === ALL_CATEGORIES
        ? [...apps]
        : apps.filter((a) => (a.category || "").toLowerCase() === category.toLowerCase());

    if (sort === "Trending") list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    if (sort === "Newest") {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [sort, category, apps]);

  // Single key for AnimatePresence so the grid restarts its stagger animation
  // whenever either dimension changes.
  const filterKey = `${sort}::${category}`;

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Filter bar */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-6 h-10">
        {/* Sort */}
        {SORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`h-full px-5 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-black border-r border-[#E5E5E5] ${
              sort === s ? "bg-black text-white" : "text-[#717171] hover:text-black"
            }`}
          >
            {s}
          </button>
        ))}

        {/* Category dropdown — native <select> styled to match the bar */}
        <div className="relative h-full">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className={`h-full pl-5 pr-9 text-[10px] font-bold uppercase tracking-widest bg-white border-r border-[#E5E5E5] appearance-none cursor-pointer focus:outline focus:outline-2 focus:outline-black ${
              category === ALL_CATEGORIES ? "text-[#717171] hover:text-black" : "text-black"
            }`}
          >
            <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#717171]"
            strokeWidth={2}
          />
        </div>

        {/* Clear filter — only visible when something is filtered */}
        {category !== ALL_CATEGORIES && (
          <button
            onClick={() => setCategory(ALL_CATEGORIES)}
            className="h-full px-4 text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] hover:text-black transition-colors border-r border-[#E5E5E5]"
          >
            Clear ×
          </button>
        )}

        <div className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] pr-2">
          {filtered.length} Apps
        </div>
      </div>

      {/* Grid */}
      <div className="pt-[96px] px-6 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <GalleryCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#E5E5E5] px-10 py-16 flex flex-col items-center text-center max-w-2xl mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">Empty</p>
            <h2
              className="mt-3 text-3xl font-black uppercase text-black leading-none"
              style={{ letterSpacing: "-0.03em" }}
            >
              {apps.length === 0 ? "No Apps Yet" : "No Apps Match"}
            </h2>
            <p className="mt-4 text-sm text-[#717171] max-w-sm leading-relaxed">
              {apps.length === 0
                ? "Be the first to share something you vibed into existence."
                : "Try a different filter."}
            </p>
            {apps.length === 0 && (
              <Link
                to="/submit"
                className="mt-8 h-12 px-8 flex items-center justify-between gap-6 bg-black text-white hover:bg-[#222] transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">Submit Your App</span>
                <span className="text-xs text-[#888]">→</span>
              </Link>
            )}
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={filterKey}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8"
          >
            {filtered.map((app, i) => (
              <motion.div
                key={app.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Link
                  to={`/app/${app.id}`}
                  className="block group focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                  onMouseEnter={() => setHoveredId(app.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* 16:9 thumbnail */}
                  <div className="relative w-full aspect-video overflow-hidden bg-[#F0F0F0]">
                    <img
                      src={app.image}
                      alt={app.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Verified ownership badge */}
                    {app.ownership_verified && (
                      <span
                        title="Ownership verified"
                        className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-white border border-[#E5E5E5] text-black px-2 py-1 flex items-center gap-1"
                      >
                        <span className="text-black">✓</span> Verified
                      </span>
                    )}
                    {/* Hover description overlay */}
                    <div
                      className="absolute inset-0 bg-black/80 flex flex-col justify-end p-4 transition-opacity duration-200"
                      style={{ opacity: hoveredId === app.id ? 1 : 0 }}
                    >
                      <p className="text-[11px] text-white leading-snug">{app.tagline}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/50 border border-white/20 px-1.5 py-0.5">
                          {app.category}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                          {app.tool}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Below thumbnail — YouTube style */}
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-tight text-black leading-snug group-hover:underline underline-offset-2">
                        {app.name}
                      </h3>
                      <p className="text-[10px] text-[#717171] mt-0.5">{app.category} · {app.tool}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#AAAAAA] whitespace-nowrap mt-0.5">
                      ▲ {app.upvotes}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
        )}
      </div>

      <Footer />
    </div>
  );
}