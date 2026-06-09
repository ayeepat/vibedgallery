import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { appPath } from "@/lib/urlHelpers";

// Columns + embedded maker handle needed to build a pretty /<username>/<slug>
// link straight from a search result.
const SEARCH_COLUMNS =
  "id, title, tagline, category, primary_tool, thumbnail_url, slug, " +
  "maker:public_profiles(username)";

export default function SearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(() => urlQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  // Distinguishes a value the user typed (→ live typeahead + dropdown) from one
  // mirrored in from the URL ?q= (→ just populate the box, no dropdown/fetch).
  const userTypedRef = useRef(false);

  // Keep the box in sync with the gallery's ?q= so a shared /gallery?q=… link,
  // or clearing the gallery search chip, is reflected here without opening the
  // dropdown.
  useEffect(() => {
    userTypedRef.current = false;
    setQuery(urlQuery);
  }, [urlQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Global Escape: close dropdown and restore focus to the input.
  // Document-level listener catches Escape even if focus has wandered off
  // the input (e.g. after the user moused over a result).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlighted(-1);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    // A value mirrored in from the URL just populates the box — don't fire the
    // typeahead or pop the dropdown open on page load.
    if (!userTypedRef.current) return;

    // Clear previous timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Wait 200ms before searching
    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      try {
        // Strip characters that break PostgREST's `or()` filter syntax
        // (commas, parens, colons, asterisks) and SQL LIKE wildcards
        // (%, _, \). Anything left is safe to interpolate into the pattern.
        const term = query.trim().replace(/[,()*:%_\\]/g, "");
        if (!term) {
          setResults([]);
          setOpen(false);
          setLoading(false);
          return;
        }
        const pattern = `%${term}%`;

        // One round trip across title / tagline / category / primary_tool.
        const { data: textData, error: textError } = await supabase
          .from("apps")
          .select(SEARCH_COLUMNS)
          .eq("status", "approved")
          .or(
            [
              `title.ilike.${pattern}`,
              `tagline.ilike.${pattern}`,
              `category.ilike.${pattern}`,
              `primary_tool.ilike.${pattern}`,
            ].join(",")
          )
          .limit(6);

        if (textError) throw textError;

        const merged = textData ?? [];

        // Tags is a text[] column — `ilike` doesn't apply. Use array-contains.
        if (merged.length < 6) {
          const { data: tagData } = await supabase
            .from("apps")
            .select(SEARCH_COLUMNS)
            .eq("status", "approved")
            .contains("tags", [term.toLowerCase()])
            .limit(6 - merged.length);

          if (tagData) {
            const seen = new Set(merged.map((d) => d.id));
            for (const r of tagData) {
              if (!seen.has(r.id)) merged.push(r);
            }
          }
        }

        setResults(merged);
        setOpen(merged.length > 0);
        setHighlighted(-1);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    // Escape should always work, even if the dropdown is closed or empty.
    if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h < results.length - 1 ? h + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h > 0 ? h - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0) {
        goToApp(results[highlighted]);
      } else if (query.trim()) {
        // No item highlighted → search the whole gallery for the typed term.
        runGallerySearch(query.trim());
      }
    }
  };

  const goToApp = (app) => {
    setQuery("");
    setOpen(false);
    navigate(appPath({ id: app.id, slug: app.slug, username: app.maker?.username }));
  };

  // Run a full gallery search for the term (the /gallery?q= filter), instead of
  // jumping to one app. Makes the typeahead a real search box.
  const runGallerySearch = (term) => {
    const t = term.trim();
    if (!t) return;
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/gallery?q=${encodeURIComponent(t)}`);
  };

  // Highlight matching text
  const highlightMatch = (text) => {
    const term = query.trim();
    if (!term) return text;
    // Escape regex special chars so user input like "(" doesn't crash here.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Split keeps the captured matches as alternating parts. The case-insensitive
    // test below decides which parts to bold — no `g` flag, since `RegExp.test`
    // with `g` is stateful via lastIndex and produces flaky results across calls.
    const splitRegex = new RegExp(`(${escaped})`, "gi");
    const matchRegex = new RegExp(`^${escaped}$`, "i");
    const parts = text.split(splitRegex);
    return parts.map((part, i) =>
      matchRegex.test(part) ? (
        <span key={i} className="text-black font-black">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-md mx-auto">

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { userTypedRef.current = true; setQuery(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search artifacts..."
          className="w-full h-8 px-4 pr-8 text-xs bg-[#F5F5F5] border border-[#E5E5E5] rounded-full placeholder:text-[#AAAAAA] text-black focus:outline-none focus:border-black transition-colors"
        />

        {/* Loading spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-[#E5E5E5] border-t-black rounded-full animate-spin" />
          </div>
        )}

        {/* Clear button */}
        {query && !loading && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-black text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#E5E5E5] shadow-lg z-50 max-h-80 overflow-y-auto">

          {/* Results */}
          {results.map((app, i) => (
            <button
              key={app.id}
              onClick={() => goToApp(app)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E5] last:border-0 transition-colors ${
                highlighted === i
                  ? "bg-[#F5F5F5]"
                  : "bg-white hover:bg-[#F5F5F5]"
              }`}
            >
              {/* Thumbnail */}
              {app.thumbnail_url ? (
                <div className="w-10 h-10 shrink-0 border border-[#E5E5E5] overflow-hidden">
                  <img
                    src={app.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 shrink-0 bg-[#F5F5F5] border border-[#E5E5E5]" />
              )}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-tight text-[#717171] truncate">
                  {highlightMatch(app.title)}
                </p>
                <p className="text-[10px] text-[#AAAAAA] truncate mt-0.5">
                  {app.tagline}
                </p>
              </div>

              {/* Category badge */}
              <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest text-[#717171] border border-[#E5E5E5] px-2 py-0.5">
                {app.category}
              </span>
            </button>
          ))}

          {/* Search the whole gallery for this term */}
          <button
            onClick={() => runGallerySearch(query)}
            className="w-full text-left px-4 py-3 border-t border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] transition-colors text-[10px] font-bold uppercase tracking-widest text-black flex items-center justify-between"
          >
            <span className="truncate">Search gallery for “{query.trim()}”</span>
            <span className="shrink-0 text-[#717171]">→</span>
          </button>

          {/* Footer */}
          <div className="px-4 py-2 bg-[#F5F5F5]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              {results.length} result{results.length !== 1 ? "s" : ""} · ↑↓ Navigate · Enter to search
            </span>
          </div>
        </div>
      )}

      {/* No results */}
      {open && query.trim() && results.length === 0 && !loading && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#E5E5E5] shadow-lg z-50">
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171]">
              No apps found for "{query}"
            </p>
          </div>
          <button
            onClick={() => runGallerySearch(query)}
            className="w-full text-left px-4 py-3 border-t border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] transition-colors text-[10px] font-bold uppercase tracking-widest text-black flex items-center justify-between"
          >
            <span className="truncate">Search gallery for “{query.trim()}”</span>
            <span className="shrink-0 text-[#717171]">→</span>
          </button>
        </div>
      )}

    </div>
  );
}