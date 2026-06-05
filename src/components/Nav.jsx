import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import SearchBar from "@/components/SearchBar";

export default function Nav({ hideSearch = false }) {
  const { isAuthenticated, user, profile, logout, isAdmin } = useAuth();
  const displayLabel =
    profile?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";
  const { pathname } = useLocation();

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

      {/* Nav links */}
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

        {/* Submit App */}
        <Link
          to="/submit"
          className="h-8 px-5 flex items-center bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors whitespace-nowrap"
        >
          Submit App
        </Link>

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

    </nav>
  );
}