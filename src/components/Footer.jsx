import { Link } from "react-router-dom";

// Sitewide footer. Lives at the bottom of nearly every page; provides the
// legal links the SEO/compliance flow needs (Terms + Privacy) and a tagline.
export default function Footer() {
  return (
    <footer className="border-t border-[#E5E5E5]">
      <div className="px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img
            src="/logovibed.png"
            alt="VibedGallery logo"
            width="20"
            height="20"
            className="h-5 w-5 opacity-70"
            loading="lazy"
          />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest text-black">
              VibedGallery
            </span>
            <span className="text-xs text-[#717171]">
              Apps built with AI, shared by the people who made them.
            </span>
          </div>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <Link
            to="/how-it-works"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            How It Works
          </Link>
          <Link
            to="/about"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            About
          </Link>
          <Link
            to="/gallery"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            Gallery
          </Link>
          <Link
            to="/submit"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            Submit
          </Link>
          <Link
            to="/terms"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black transition-colors"
          >
            Privacy
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#AAAAAA]">
            © {new Date().getFullYear()}
          </span>
        </nav>
      </div>
    </footer>
  );
}
