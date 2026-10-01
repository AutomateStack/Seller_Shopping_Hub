import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Package,
  ShoppingCart,
  Heart,
  Ticket,
  Brain,
  Wallet,
  User,
  Home,
  Search,
} from "lucide-react";

const PAGES = [
  { label: "Home", to: "/", icon: Home },
  { label: "All Products", to: "/products", icon: Package },
  { label: "Cart", to: "/cart", icon: ShoppingCart },
  { label: "Wishlist", to: "/wishlist", icon: Heart },
  { label: "Lucky Draw", to: "/lucky-draw", icon: Ticket },
  { label: "Quiz", to: "/quiz", icon: Brain },
  { label: "Wallet", to: "/wallet", icon: Wallet },
  { label: "My Orders", to: "/orders", icon: User },
];

/** Global ⌘K / Ctrl+K quick search across pages and products. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["command-products", term],
    enabled: open && term.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .ilike("name", `%${term.trim()}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const go = (to: string) => {
    setOpen(false);
    setTerm("");
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search products or jump to a page..."
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {products.length > 0 && (
          <>
            <CommandGroup heading="Products">
              {products.map((p: any) => (
                <CommandItem key={p.id} value={p.name} onSelect={() => go(`/products/${p.id}`)}>
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs font-medium text-primary">₹{Number(p.price).toFixed(0)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Go to">
          {PAGES.map((p) => (
            <CommandItem key={p.to} value={p.label} onSelect={() => go(p.to)}>
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}