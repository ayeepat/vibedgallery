import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import SearchBar from "@/components/SearchBar";

export default function Nav({ hideSearch = false }) {
  const { isAuthenticated, user, profile, logout, isAdmin } = useAuth();
  const displayLabel =
    profile?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const navLinkClass = (path) => {
    const isActive =
      path === "/" ? pathname === "/" : pathname.startsWith(path);
    return `text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
      isActive ? "text-black underline underline-offset-4" : "text-[#717171] hover:text-black"
    }`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E5E5] flex items-center px-6 gap-4">

      {/* Logo */}
      <Link
        to="/"
        className="text-xs font-black uppercase tracking-widest text-black whitespace-nowrap"
      >
        VibedGallery
      </Link>

      {/* Desktop layout — `md:contents` lets these children participate directly
          in the nav's flex row so the desktop layout is unchanged, while they
          collapse to the hamburger menu below md. */}
      <div className="hidden md:contents">
        <Link to="/gallery" className={navLinkClass("/gallery")}>
          Gallery
        </Link>

        <Link to="/how-it-works" className={navLinkClass("/how-it-works")}>
          How It Works
        </Link>

        {/* Search — now a real component */}
        {!hideSearch && <SearchBar />}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-0">

          {/* Submit App — on the Submit page itself, this button doubles as the
              form's submit trigger (form="submit-app-form" associates it with
              the page's <form id="submit-app-form">). Elsewhere it's a normal
              link to /submit. */}
          {pathname === "/submit" ? (
            <button
              type="submit"
              form="submit-app-form"
              className="h-8 px-5 flex items-center bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors whitespace-nowrap"
            >
              Submit App for Review
            </button>
          ) : (
            <Link
              to="/submit"
              className="h-8 px-5 flex items-center bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors whitespace-nowrap"
            >
              Submit App
            </Link>
          )}

          {isAuthenticated ? (
            <>
              {/* Admin link */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="h-8 px-4 flex items-center border-t border-b border-r border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
                >
                  Admin
                </Link>
              )}

              {/* Username */}
              <Link
                to="/profile"
                className={`h-8 px-4 flex items-center border-t border-b border-r border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                  pathname.startsWith("/profile")
                    ? "bg-black text-white"
                    : "text-[#717171] hover:text-black hover:bg-[#F5F5F5]"
                }`}
              >
                {displayLabel}
              </Link>

              {/* Sign Out */}
              <button
                onClick={() => logout()}
                className="h-8 px-4 border-t border-b border-r border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              {/* Sign In */}
              <Link
                to="/login"
                className="h-8 px-4 flex items-center border border-l-0 border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>

              {/* Register */}
              <Link
                to="/register"
                className="h-8 px-4 flex items-center bg-[#222] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors whitespace-nowrap"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="ml-auto md:hidden h-8 w-8 -mr-1 flex items-center justify-center text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile dropdown panel */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden fixed top-14 left-0 right-0 z-40 bg-white border-b border-[#E5E5E5] max-h-[calc(100vh-3.5rem)] overflow-y-auto"
        >
          {!hideSearch && (
            <div className="px-4 py-3 border-b border-[#E5E5E5]">
              <SearchBar />
            </div>
          )}

          <Link
            to="/gallery"
            className="h-12 px-6 flex items-center border-b border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-black hover:bg-[#F5F5F5] transition-colors"
          >
            Gallery
          </Link>
          <Link
            to="/how-it-works"
            className="h-12 px-6 flex items-center border-b border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-black hover:bg-[#F5F5F5] transition-colors"
          >
            How It Works
          </Link>
          {pathname === "/submit" ? (
            <button
              type="submit"
              form="submit-app-form"
              onClick={() => setOpen(false)}
              className="w-full h-12 px-6 flex items-center justify-between bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors text-left"
            >
              <span>Submit App for Review</span>
              <span className="text-[#888]">→</span>
            </button>
          ) : (
            <Link
              to="/submit"
              className="h-12 px-6 flex items-center justify-between bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors"
            >
              <span>Submit App</span>
              <span className="text-[#888]">→</span>
            </Link>
          )}

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="h-12 px-6 flex items-center border-t border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
                >
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="h-12 px-6 flex items-center border-t border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-black hover:bg-[#F5F5F5] transition-colors"
              >
                {displayLabel}
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="w-full h-12 px-6 flex items-center border-t border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors text-left"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="h-12 px-6 flex items-center border-t border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="h-12 px-6 flex items-center bg-[#222] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}

    </nav>
  );
}
