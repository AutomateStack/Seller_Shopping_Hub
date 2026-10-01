import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2 } from "lucide-react";

export function AdminStockNotifications() {
  const { data: notifications } = useQuery({
    queryKey: ["admin-stock-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_notifications" as any)
        .select("id, email, notified, created_at, products:product_id(id, name, image_url, stock)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { product: any; pending: any[]; notified: any[] }>();
    for (const n of notifications || []) {
      if (!n.products) continue;
      const key = n.products.id;
      if (!map.has(key)) map.set(key, { product: n.products, pending: [], notified: [] });
      const bucket = map.get(key)!;
      if (n.notified) bucket.notified.push(n);
      else bucket.pending.push(n);
    }
    return Array.from(map.values()).sort((a, b) => b.pending.length - a.pending.length);
  }, [notifications]);

  const totalPending = grouped.reduce((sum, g) => sum + g.pending.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Stock Alert Subscribers
        </h1>
        <p className="text-muted-foreground">
          {totalPending} customers waiting · auto-notified when products restock
        </p>
      </div>

      <div className="grid gap-3">
        {grouped.map(({ product, pending, notified }) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-3">
                {product.image_url && (
                  <img src={product.image_url} alt="" className="h-14 w-14 rounded-lg object-cover border border-border" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                      {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                    </Badge>
                    {pending.length > 0 && (
                      <Badge variant="secondary"><Bell className="h-3 w-3 mr-1" />{pending.length} waiting</Badge>
                    )}
                    {notified.length > 0 && (
                      <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />{notified.length} notified</Badge>
                    )}
                  </div>
                </div>
              </div>
              {pending.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View pending subscribers ({pending.length})
                  </summary>
                  <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto pl-4">
                    {pending.map((p) => (
                      <div key={p.id} className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>{p.email}</span>
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
        {grouped.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No stock alert subscribers yet.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}