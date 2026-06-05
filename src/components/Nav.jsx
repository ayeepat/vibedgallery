import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import SearchBar from "@/components/SearchBar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Nav({ hideSearch = false }) {
  const { isAuthenticated, user, profile, logout, isAdmin } = useAuth();
  const displayLabel =
    profile?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const navLinkClass = (path) => {
    const isActive =
      path === "/" ? pathname === "/" : pathname.startsWith(path);
    return `text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
      isActive ? "text-black underline underline-offset-4" : "text-[#717171] hover:text-black"
    }`;
  };

  const mobileRowClass = (path) => {
    const isActive =
      path === "/" ? pathname === "/" : pathname.startsWith(path);
    return `h-14 px-6 flex items-center justify-between border-b border-[#E5E5E5] text-xs font-bold uppercase tracking-widest transition-colors ${
      isActive ? "bg-[#F5F5F5] text-black" : "text-[#222] hover:bg-[#F5F5F5]"
    }`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E5E5]">
      {/* Desktop bar */}
      <div className="hidden md:flex h-full items-center px-6 gap-4">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-widest text-black whitespace-nowrap"
        >
          VibedGallery
        </Link>

        <Link to="/gallery" className={navLinkClass("/gallery")}>
          Gallery
        </Link>

        <Link to="/how-it-works" className={navLinkClass("/how-it-works")}>
          How It Works
        </Link>

        {!hideSearch && <SearchBar />}

        <div className="ml-auto flex items-center gap-0">
          <Link
            to="/submit"
            className="h-8 px-5 flex items-center bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors whitespace-nowrap"
          >
            Submit App
          </Link>

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="h-8 px-4 flex items-center border-t border-b border-r border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
                >
                  Admin
                </Link>
              )}

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

              <button
                onClick={() => logout()}
                className="h-8 px-4 border-t border-b border-r border-[#E5E5E5] text-[9px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="h-8 px-4 flex items-center border border-l-0 border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#717171] hover:text-black hover:bg-[#F5F5F5] transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>

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

      {/* Mobile bar */}
      <div className="md:hidden h-full flex items-center justify-between px-5">
        <Link
          to="/"
          className="text-xs font-black uppercase tracking-widest text-black whitespace-nowrap"
        >
          VibedGallery
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="h-9 w-9 flex items-center justify-center border border-[#E5E5E5] text-black hover:bg-[#F5F5F5] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <Menu className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-[88%] sm:w-80 p-0 bg-white border-l border-[#E5E5E5]"
          >
            <SheetTitle className="sr-only">Site menu</SheetTitle>

            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="h-14 border-b border-[#E5E5E5] flex items-center px-6">
                <span className="text-xs font-black uppercase tracking-widest text-black">
                  Menu
                </span>
              </div>

              {/* Primary links */}
              <div className="flex flex-col">
                <SheetClose asChild>
                  <Link to="/gallery" className={mobileRowClass("/gallery")}>
                    <span>Gallery</span>
                    <span className="text-[#888]">→</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/how-it-works" className={mobileRowClass("/how-it-works")}>
                    <span>How It Works</span>
                    <span className="text-[#888]">→</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/about" className={mobileRowClass("/about")}>
                    <span>About</span>
                    <span className="text-[#888]">→</span>
                  </Link>
                </SheetClose>
              </div>

              {/* CTA */}
              <SheetClose asChild>
                <Link
                  to="/submit"
                  className="h-14 px-6 flex items-center justify-between bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-[#222] transition-colors"
                >
                  <span>Submit Your App</span>
                  <span className="text-[#888]">→</span>
                </Link>
              </SheetClose>

              {/* Account section at bottom */}
              <div className="mt-auto border-t border-[#E5E5E5]">
                {isAuthenticated ? (
                  <>
                    <div className="px-6 py-3 border-b border-[#E5E5E5]">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
                        Signed in as
                      </p>
                      <p className="text-xs font-black uppercase tracking-widest text-black mt-1 truncate">
                        {displayLabel}
                      </p>
                    </div>
                    <SheetClose asChild>
                      <Link to="/profile" className={mobileRowClass("/profile")}>
                        <span>My Profile</span>
                        <span className="text-[#888]">→</span>
                      </Link>
                    </SheetClose>
                    {isAdmin && (
                      <SheetClose asChild>
                        <Link to="/admin" className={mobileRowClass("/admin")}>
                          <span>Admin</span>
                          <span className="text-[#888]">→</span>
                        </Link>
                      </SheetClose>
                    )}
                    <button
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                      className="w-full h-14 px-6 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#717171] hover:bg-[#F5F5F5] hover:text-black transition-colors"
                    >
                      <span>Sign Out</span>
                      <span className="text-[#888]">→</span>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col">
                    <SheetClose asChild>
                      <Link to="/login" className={mobileRowClass("/login")}>
                        <span>Sign In</span>
                        <span className="text-[#888]">→</span>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/register"
                        className="h-14 px-6 flex items-center justify-between bg-[#222] text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
                      >
                        <span>Create Account</span>
                        <span className="text-[#888]">→</span>
                      </Link>
                    </SheetClose>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
