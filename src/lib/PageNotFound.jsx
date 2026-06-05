import { Link, useLocation } from "react-router-dom";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";

export default function PageNotFound() {
  const location = useLocation();
  const path = location.pathname || "/";

  usePageMeta({
    title: "Page Not Found",
    description: "The page you're looking for isn't here.",
    path,
    noindex: true,
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav hideSearch />

      <main className="flex-1 pt-14 flex flex-col">
        <div className="flex-1 flex items-center px-6 sm:px-10 py-16">
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 border border-[#E5E5E5]">
            {/* Left — big 404 */}
            <div className="p-8 sm:p-12 md:border-r border-b md:border-b-0 border-[#E5E5E5] flex flex-col justify-between gap-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                Error 404
              </p>
              <h1
                className="text-[clamp(5rem,18vw,12rem)] font-black uppercase text-black leading-none"
                style={{ letterSpacing: "-0.06em" }}
              >
                404
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                Page not found.
              </p>
            </div>

            {/* Right — message + actions */}
            <div className="p-8 sm:p-12 flex flex-col justify-between gap-10">
              <div>
                <h2
                  className="text-3xl sm:text-4xl font-black uppercase text-black leading-none"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  NOTHING<br />HERE.
                </h2>
                <p className="mt-4 text-sm text-[#717171] leading-relaxed">
                  The path{" "}
                  <span className="font-mono text-black break-all">{path}</span>{" "}
                  doesn't match anything in the gallery.
                </p>
                <p className="mt-2 text-sm text-[#717171] leading-relaxed">
                  Mistyped URL, or the app was removed.
                </p>
              </div>

              <div className="border border-[#E5E5E5]">
                <Link
                  to="/gallery"
                  className="h-12 flex items-center justify-between px-5 bg-black text-white hover:bg-[#222] transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Browse the Gallery
                  </span>
                  <span className="text-xs text-[#888] group-hover:text-[#bbb]">→</span>
                </Link>
                <Link
                  to="/"
                  className="h-12 flex items-center justify-between px-5 bg-white text-black border-t border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Back to Home
                  </span>
                  <span className="text-xs text-[#717171] group-hover:text-black">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
