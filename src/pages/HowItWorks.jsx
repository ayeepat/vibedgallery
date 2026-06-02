import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import { useState } from "react";
import UploadModal from "../components/UploadModal";

const STEPS = [
  {
    number: "01",
    title: "Discover",
    body: "Browse a curated gallery of vibe-coded apps and websites built by developers, designers, and dreamers. Filter by tool, sort by trending, and find your next source of inspiration.",
  },
  {
    number: "02",
    title: "Submit",
    body: "Built something with an AI coding tool? Submit it to the gallery. Share your creation with the community — all it takes is a name, a URL, and a one-line tagline.",
  },
  {
    number: "03",
    title: "Upvote",
    body: "See something impressive? Upvote it. The community decides what rises to the top. The best vibe-coded software earns its place on the trending list.",
  },
  {
    number: "04",
    title: "Explore",
    body: "Jump into any app directly from the gallery. Every submission links to the live product — no screenshots, no demos. Just the real thing.",
  },
];

export default function HowItWorks() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Nav onUploadClick={() => setUploadOpen(true)} hideSearch />

      {/* Hero */}
      <section className="pt-14 border-b border-[#E5E5E5]">
        <div className="max-w-4xl mx-auto px-8 py-20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">
            How It Works
          </p>
          <h1
            className="text-[clamp(2.5rem,6vw,6rem)] font-black uppercase leading-[0.9] text-black"
            style={{ letterSpacing: "-0.04em" }}
          >
            CREATE.<br />SHARE.<br />DISCOVER.
          </h1>
          <p className="mt-8 text-sm text-[#717171] max-w-sm leading-relaxed">
            VibedGallery is a living archive of software built with intent. Submit your apps, explore the community's work, and celebrate the new wave of vibe-coded creation.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-4xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-[#E5E5E5]">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`p-10 ${i % 2 === 0 ? "border-r border-[#E5E5E5]" : ""} ${i < 2 ? "border-b border-[#E5E5E5]" : ""}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                {step.number}
              </span>
              <h2
                className="mt-3 text-2xl font-black uppercase text-black leading-none"
                style={{ letterSpacing: "-0.03em" }}
              >
                {step.title}
              </h2>
              <p className="mt-4 text-sm text-[#717171] leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#E5E5E5]">
        <div className="max-w-4xl mx-auto px-8 py-16 flex flex-col sm:flex-row gap-4">
          <Link
            to="/gallery"
            className="h-14 flex-1 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-widest">Browse the Gallery</span>
            <span className="text-xs text-[#888]">→</span>
          </Link>
          <button
            onClick={() => setUploadOpen(true)}
            className="h-14 flex-1 flex items-center justify-between px-6 bg-white text-black border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-widest">Submit Your App</span>
            <span className="text-xs text-[#717171]">→</span>
          </button>
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