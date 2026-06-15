import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import Footer from "@/components/Footer";
import { useApprovedApps } from "@/lib/useApps";
import { appPath } from "@/lib/urlHelpers";
import { usePageMeta } from "@/lib/usePageMeta";

const MARQUEE_NAMES = [
  "LET HIM COOK AI", "ST: FREELANCER", "PIXVEC", "SPORTSPOOL", "NOTENOTES", "FLUENTCODE",
  "PROMPTCRM", "SYNAPSE", "BRIEFLY", "MIRRORDB", "HOTSWAP", "ZENMAIL",
];

const doubled = [...MARQUEE_NAMES, ...MARQUEE_NAMES];

const heroLineVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Home() {
  usePageMeta({
    title: "A gallery of apps built with AI",
    description:
      "VibedGallery is a curated gallery of real apps built with AI coding tools. Browse trending apps, try them, and submit your own.",
    path: "/",
  });

  const { data: apps = [] } = useApprovedApps();
  const trending = useMemo(
    () => [...apps].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 6),
    [apps]
  );

  return (
    <div className="min-h-screen bg-white">
      <Nav hideSearch />

      {/* Hero */}
      <section className="md:h-screen flex flex-col md:flex-row border-b border-[#E5E5E5] pt-14">
        {/* Left 60% — Static hero */}
        <div className="w-full md:w-[60%] border-b md:border-b-0 md:border-r border-[#E5E5E5] flex flex-col justify-between p-6 md:p-12 gap-10 md:gap-0">
          <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0}
              variants={heroLineVariants}
              className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-6"
            >
              A gallery for apps built with AI
            </motion.p>
            <h1
              className="text-[clamp(2.5rem,5vw,5rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              {["SEE WHAT", "PEOPLE", "ARE BUILDING."].map((line, i) => (
                <motion.span
                  key={line}
                  custom={i + 1}
                  variants={heroLineVariants}
                  initial="hidden"
                  animate="visible"
                  className="block"
                >
                  {line}
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial="hidden"
              animate="visible"
              custom={4}
              variants={heroLineVariants}
              className="mt-6 text-sm text-[#717171] max-w-sm leading-relaxed"
            >
              VibedGallery is a public gallery of real apps built with AI coding
              tools. Browse what people are building, try the apps live, and
              submit your own.
            </motion.p>
          </div>

          <div className="flex flex-col gap-0 border border-[#E5E5E5]">
            <Link
              to="/gallery"
              className="h-14 flex items-center justify-between px-6 bg-black text-white hover:bg-[#222] transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Browse the Gallery</span>
              <span className="text-xs text-[#888] group-hover:text-[#bbb] transition-colors">→</span>
            </Link>
            <Link
              to="/submit"
              className="h-14 flex items-center justify-between px-6 bg-white text-black border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors group w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Submit Your App</span>
              <span className="text-xs text-[#717171] group-hover:text-black transition-colors">→</span>
            </Link>
          </div>
        </div>

        {/* Right 40% — Marquee */}
        <div className="w-full md:w-[40%] h-[40vh] md:h-auto overflow-hidden relative flex items-center">
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
        {trending.length === 0 && (
          <div className="px-8 py-10 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              No approved apps yet — be the first.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {trending.map((app, i) => (
            <motion.div
              key={app.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className={i < trending.length - 1 ? "border-r border-[#E5E5E5]" : ""}
            >
              <Link to={appPath(app)} className="block group">
                <div className="relative aspect-video overflow-hidden bg-[#F0F0F0]">
                  <img
                    src={app.image}
                    alt={app.name ? `${app.name} preview` : "App preview"}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {app.ownership_verified && (
                    <span
                      title="Ownership verified"
                      className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-white border border-[#E5E5E5] text-black px-2 py-0.5"
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>
                <div className="p-3 border-t border-[#E5E5E5]">
                  <p className="text-[11px] font-black uppercase tracking-tight text-black">{app.name}</p>
                  <p className="text-[10px] text-[#717171] mt-0.5 truncate">{app.tagline}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}