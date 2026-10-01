import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const RECENT_KEY = "shophub_recent_searches";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  const t = term.trim();
  if (!t) return;
  const list = loadRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
  list.unshift(t);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

export function NavbarSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load recents + a small set of trending categories on mount
  useEffect(() => {
    setRecent(loadRecent());
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("name")
        .order("display_order", { ascending: true })
        .limit(6);
      setTrending((data || []).map((c) => c.name).filter(Boolean));
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, category")
        .or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(6);
      setResults(data || []);
      setOpen(true);
      setLoading(false);
    }, 300);
  }, [query]);

  const handleSelect = (productId: string) => {
    pushRecent(query);
    setRecent(loadRecent());
    setQuery("");
    setOpen(false);
    navigate(`/products/${productId}`);
  };

  const submitTerm = (term: string) => {
    const t = term.trim();
    if (!t) return;
    pushRecent(t);
    setRecent(loadRecent());
    setQuery("");
    setOpen(false);
    navigate(`/products?search=${encodeURIComponent(t)}`);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  const showSuggestions = open && !query.trim();
  const showResults = open && !!query.trim();

  return (
    <div ref={wrapperRef} className="relative hidden md:block w-64 lg:w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search products..."
          aria-label="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) submitTerm(query);
          }}
          className="pl-9 pr-8 h-9 bg-muted/50 border-none focus-visible:ring-1"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-0 p-1" aria-label="Clear search">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden" role="listbox" aria-label="Search results">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No products found</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">N/A</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
                  </div>
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">₹{product.price}</span>
                </button>
              ))}
              <button
                onClick={() => submitTerm(query)}
                className="w-full p-2.5 text-sm text-primary hover:bg-accent text-center border-t"
              >
                View all results for "{query}"
              </button>
            </div>
          )}
        </div>
      )}

      {showSuggestions && (recent.length > 0 || trending.length > 0) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden" role="listbox" aria-label="Search suggestions">
          {recent.length > 0 && (
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" /> Recent
                </p>
                <button onClick={clearRecent} className="text-[11px] text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((term) => (
                  <button
                    key={term}
                    onClick={() => submitTerm(term)}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {trending.length > 0 && (
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3 w-3" aria-hidden="true" /> Trending categories
              </p>
              <div className="flex flex-wrap gap-1.5">
                {trending.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => submitTerm(cat)}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
