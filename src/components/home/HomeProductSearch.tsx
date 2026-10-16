import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeProductSearch({ placement = "row" }: { placement?: "row" | "hero" }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  return (
    <section className={placement === "hero" ? "w-full" : "relative z-20 border-b border-border/50 bg-background py-3 md:py-4"} aria-label="Search products">
      <div className="container px-4">
        <form onSubmit={submitSearch} role="search" aria-label="Find products" className={placement === "hero" ? "w-full rounded-2xl border border-[#f9a8c8]/80 bg-[#fff0f6]/90 p-3 shadow-lg shadow-pink-900/10 backdrop-blur-sm md:p-4" : "mx-auto w-full max-w-5xl rounded-2xl border border-[#f9a8c8]/70 bg-card p-3 shadow-md shadow-pink-900/5 md:flex md:items-center md:gap-5 md:p-4"}>
          <label htmlFor="home-product-search" className={placement === "hero" ? "mb-2 block text-sm font-semibold text-[#6b304b] md:text-base" : "mb-2 block text-sm font-semibold text-foreground md:mb-0 md:w-52 md:shrink-0 md:text-base"}>What are you looking for today?</label>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-[#f9a8c8] bg-white/90 p-1.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 md:p-2">
            <Search className="ml-2 h-5 w-5 shrink-0 text-primary md:ml-3 md:h-6 md:w-6" aria-hidden="true" />
            <input
              id="home-product-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search for products, brands and more"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 md:h-12 md:text-lg"
            />
            <Button type="submit" size="lg" className="h-11 shrink-0 rounded-xl px-4 font-semibold shadow-sm md:h-12 md:px-7" disabled={!searchQuery.trim()}>
              Search
            </Button>
          </div>
          <p className={placement === "hero" ? "mt-2 text-xs text-[#6b4b59]" : "mt-2 text-xs text-muted-foreground md:mt-0 md:w-48 md:shrink-0"}>Search ShopHub and seller marketplace products.</p>
        </form>
      </div>
    </section>
  );
}
