import { useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import UploadModal from "../components/UploadModal";
import { APPS, MARQUEE_NAMES } from "../data/apps";

const doubled = [...MARQUEE_NAMES, ...MARQUEE_NAMES];

export default function Home() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const trending = APPS.slice(0, 6);

  return (
    <div className="min-h-screen bg-white">
      <Nav onUploadClick={() => setUploadOpen(true)} hideSearch />

      {/* Hero */}
      <section className="h-screen flex border-b border-[#E5E5E5] pt-14">
        {/* Left 60% — Static hero */}
        <div className="w-[60%] border-r border-[#E5E5E5] flex flex-col justify-between p-12">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-6">
              The Gallery of Vibe-Coded Software
            </p>
            <h1
              className="text-[clamp(2.5rem,5vw,5rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              THE<br />GALLERY<br />OF INTENT.
            </h1>
            <p className="mt-6 text-sm text-[#717171] max-w-xs leading-relaxed">
              A curated collection of the most compelling vibe-coded applications. Discover, admire, and contribute to the digital avant-garde.
            </p>
          </div>

          <div className="flex flex-col gap-0 border border-[#E5E5E5]">
            <Link
              to="/gallery"
              className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Browse the Gallery</span>
              <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
            </Link>
            <button
              onClick={() => setUploadOpen(true)}
              className="h-14 flex items-center justify-between px-6 bg-white text-black border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors group w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Submit Your App</span>
              <span className="text-xs text-[#717171] group-hover:text-black transition-colors">→</span>
            </button>
          </div>
        </div>

        {/* Right 40% — Marquee */}
        <div className="w-[40%] overflow-hidden relative flex items-center">
          <div className="animate-marquee-up flex flex-col w-full">
            {doubled.map((name, i) => (
              <div key={i} className="py-3 px-8 border-b border-[#E5E5E5]">
                <span
                  className="text-[clamp(2rem,4vw,4rem)] font-black uppercase leading-none"
                  style={{
                    WebkitTextStroke: i % 3 === 0 ? "2px #000" : "0px",
                    color: i % 3 === 0 ? "transparent" : "#000",
                    letterSpacing: "-0.04em",
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="border-b border-[#E5E5E5]">
        <div className="border-b border-[#E5E5E5] px-8 py-5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">Trending Now</span>
          <Link
            to="/gallery"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {trending.map((app, i) => (
            <Link
              key={app.id}
              to={`/app/${app.id}`}
              className={`block group ${i < trending.length - 1 ? "border-r border-[#E5E5E5]" : ""}`}
            >
              <div className="aspect-video overflow-hidden bg-[#F0F0F0]">
                <img
                  src={app.image}
                  alt={app.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 border-t border-[#E5E5E5]">
                <p className="text-[11px] font-black uppercase tracking-tight text-black">{app.name}</p>
                <p className="text-[10px] text-[#717171] mt-0.5 truncate">{app.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="px-8 py-6 flex items-center justify-between border-t border-[#E5E5E5]">
        <span className="text-xs font-black uppercase tracking-widest text-black">VibedGallery</span>
        <span className="text-xs text-[#717171]">A museum of the digital avant-garde.</span>
      </footer>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}