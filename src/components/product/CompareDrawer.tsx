import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocalList } from "@/hooks/use-local-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GitCompare, X, Check, Minus } from "lucide-react";
import { Link } from "react-router-dom";

const COMPARE_KEY = "shophub_compare_v1";

export function CompareDrawer() {
  const { items, remove, clear } = useLocalList(COMPARE_KEY, 4);
  const [open, setOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["compare-products", items],
    enabled: items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock, category, description")
        .in("id", items);
      if (error) throw error;
      // preserve user-selected order
      return items.map((id) => data?.find((p) => p.id === id)).filter(Boolean) as any[];
    },
  });

  if (items.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-4 z-40 bg-primary text-primary-foreground rounded-full shadow-lg px-4 h-11 flex items-center gap-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          aria-label={`Compare ${items.length} products`}
        >
          <GitCompare className="h-4 w-4" aria-hidden="true" />
          Compare ({items.length})
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] max-h-[700px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Compare Products</span>
            <Button size="sm" variant="ghost" onClick={() => { clear(); setOpen(false); }}>Clear all</Button>
          </SheetTitle>
        </SheetHeader>

        {!products || products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2 sticky left-0 bg-background">Attribute</th>
                  {products.map((p) => (
                    <th key={p.id} className="p-2 align-top min-w-[150px]">
                      <div className="relative">
                        <button
                          onClick={() => remove(p.id)}
                          className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                          aria-label={`Remove ${p.name} from compare`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <Link to={`/products/${p.id}`} onClick={() => setOpen(false)}>
                          <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-2">
                            <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-sm font-semibold line-clamp-2 hover:text-primary text-left">{p.name}</p>
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t">
                  <td className="p-2 font-medium text-muted-foreground sticky left-0 bg-background">Price</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-2 font-bold text-primary">₹{Number(p.price).toFixed(0)}</td>
                  ))}
                </tr>
                <tr className="border-t">
                  <td className="p-2 font-medium text-muted-foreground sticky left-0 bg-background">Category</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-2">{p.category || "—"}</td>
                  ))}
                </tr>
                <tr className="border-t">
                  <td className="p-2 font-medium text-muted-foreground sticky left-0 bg-background">In stock</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-2">
                      {(p.stock ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" /> Yes ({p.stock})</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive"><Minus className="h-3.5 w-3.5" /> No</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t align-top">
                  <td className="p-2 font-medium text-muted-foreground sticky left-0 bg-background">Description</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-2 text-xs text-muted-foreground line-clamp-4">{p.description || "—"}</td>
                  ))}
                </tr>
                <tr className="border-t">
                  <td className="p-2 sticky left-0 bg-background"></td>
                  {products.map((p) => (
                    <td key={p.id} className="p-2">
                      <Link to={`/products/${p.id}`} onClick={() => setOpen(false)}>
                        <Button size="sm" className="w-full">View</Button>
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}