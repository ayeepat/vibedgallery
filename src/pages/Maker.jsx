import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useMaker, useApprovedAppsByMaker } from "@/lib/useApps";
import { appPath } from "@/lib/urlHelpers";
import { GalleryCardSkeleton } from "@/components/Skeleton";
import { Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import AppImage from "@/components/AppImage";

const heroVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Maker() {
  const { userId } = useParams();
  const { data: maker, isLoading: makerLoading } = useMaker(userId);
  const { data: apps = [], isLoading: appsLoading } = useApprovedAppsByMaker(userId);

  usePageMeta({
    title: maker?.name ? `${maker.name} — Maker` : "Maker",
    description: maker?.name
      ? `Apps built and submitted by ${maker.name} on VibedGallery.`
      : "Apps built and submitted by makers on VibedGallery.",
    path: `/maker/${userId || ""}`,
    type: "profile",
  });

  if (makerLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-6 h-6 animate-spin text-[#AAAAAA]" />
        </div>
      </div>
    );
  }

  if (!maker) {
    return (
      <div className="min-h-screen bg-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
            Maker not found.
          </p>
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

  const totalUpvotes = apps.reduce((sum, a) => sum + (a.upvotes || 0), 0);
  const memberSince = maker.created_at
    ? new Date(maker.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : "Unknown";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav />

      <main className="flex-1 pt-14">
        {/* Header */}
        <section className="border-b border-[#E5E5E5]">
          <div className="max-w-5xl mx-auto px-8 py-16 overflow-hidden">
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0}
              variants={heroVariants}
              className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4"
            >
              Maker
            </motion.p>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={1}
              variants={heroVariants}
              className="text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.9] text-black break-words"
              style={{ letterSpacing: "-0.04em" }}
            >
              {maker.name || "Anonymous"}
            </motion.h1>

            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3">
              {[
                { label: "Apps Submitted", value: apps.length },
                { label: "Total Upvotes", value: totalUpvotes },
                { label: "Member Since", value: memberSince },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial="hidden"
                  animate="visible"
                  custom={i + 2}
                  variants={heroVariants}
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                    {item.label}
                  </p>
                  <p className="text-xs text-black mt-1">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Apps grid */}
        <section className="max-w-5xl mx-auto px-8 py-12">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black mb-6">
            Apps
          </p>

          {appsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <GalleryCardSkeleton key={i} />
              ))}
            </div>
          ) : apps.length === 0 ? (
            <div className="border border-[#E5E5E5] px-10 py-16 flex flex-col items-center text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                No Apps Yet
              </p>
              <h2
                className="mt-3 text-2xl font-black uppercase text-black leading-none"
                style={{ letterSpacing: "-0.03em" }}
              >
                Nothing to show
              </h2>
              <p className="mt-4 text-sm text-[#717171] max-w-sm leading-relaxed">
                This maker hasn't had any submissions approved yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
              {apps.map((app, i) => (
                <motion.div
                  key={app.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Link to={appPath(app)} className="block group">
                    <div className="relative w-full aspect-video overflow-hidden bg-[#F0F0F0]">
                      <AppImage
                        src={app.image}
                        name={app.name}
                        alt={app.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {app.ownership_verified && (
                        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-white border border-[#E5E5E5] text-black px-2 py-1">
                          ✓ Verified
                        </span>
                      )}
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
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
