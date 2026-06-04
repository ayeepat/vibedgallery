import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

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

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Clear previous timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Wait 200ms before searching
    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      try {
        const term = query.trim();
        const pattern = `%${term}%`;

        // One round trip across title / tagline / category / primary_tool.
        const { data: textData, error: textError } = await supabase
          .from("apps")
          .select("id, title, tagline, category, primary_tool, thumbnail_url")
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
            .select("id, title, tagline, category, primary_tool, thumbnail_url")
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
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h < results.length - 1 ? h + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h > 0 ? h - 1 : results.length - 1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      goToApp(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const goToApp = (app) => {
    setQuery("");
    setOpen(false);
    navigate(`/app/${app.id}`);
  };

  // Highlight matching text
  const highlightMatch = (text) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.trim()})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
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
          onChange={(e) => setQuery(e.target.value)}
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

          {/* Footer */}
          <div className="px-4 py-2 bg-[#F5F5F5]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#AAAAAA]">
              {results.length} result{results.length !== 1 ? "s" : ""} · ↑↓ Navigate · Enter to select
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
        </div>
      )}

    </div>
  );
}