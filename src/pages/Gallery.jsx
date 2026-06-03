import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import UploadModal from "../components/UploadModal";
import { APPS } from "../data/apps";

const FILTERS = ["Trending", "Newest", "Cursor", "Windsurf", "Lovable", "Base44"];

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("Trending");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const filtered = useMemo(() => {
    let list = activeFilter === "Trending" || activeFilter === "Newest"
      ? [...APPS]
      : APPS.filter(app => app.tool === activeFilter);

    if (activeFilter === "Trending") list.sort((a, b) => b.upvotes - a.upvotes);
    if (activeFilter === "Newest") list.sort((a, b) => b.id - a.id);

    return list;
  }, [activeFilter]);

  return (
    <div className="min-h-screen bg-white">
      <Nav onUploadClick={() => setUploadOpen(true)} />

      {/* Filter bar */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-6 h-10">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`h-full px-5 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${
              i < FILTERS.length - 1 ? "border-r border-[#E5E5E5]" : ""
            } ${activeFilter === f ? "bg-black text-white" : "text-[#717171] hover:text-black"}`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA] pr-2">
          {filtered.length} Apps
        </div>
      </div>

      {/* Grid */}
      <div className="pt-[96px] px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
          {filtered.map((app) => (
            <Link
              key={app.id}
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
          ))}
        </div>
      </div>

      <footer className="px-8 py-6 flex items-center justify-between border-t border-[#E5E5E5]">
        <span className="text-xs font-black uppercase tracking-widest text-black">VibedGallery</span>
        <span className="text-xs text-[#717171]">Apps built with AI, shared by their makers.</span>
      </footer>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}