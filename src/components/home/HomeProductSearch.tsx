import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeProductSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  return (
    <section className="relative z-20 -mt-2 pb-10 md:pb-14" aria-label="Search products">
      <div className="container px-4">
        <form onSubmit={submitSearch} role="search" aria-label="Find products" className="mx-auto w-full max-w-4xl rounded-2xl border border-[#f9a8c8]/70 bg-card p-4 shadow-lg shadow-pink-900/10 md:p-6">
          <label htmlFor="home-product-search" className="mb-3 block text-base font-semibold text-foreground md:text-lg">What are you looking for today?</label>
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#f9a8c8] bg-background p-2 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
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
          <p className="mt-2 text-sm text-muted-foreground">Find your next favourite from ShopHub and our seller marketplace.</p>
        </form>
      </div>
    </section>
  );
}
