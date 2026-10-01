import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LOW_STOCK_THRESHOLD = 5;

export function LowStockAlerts() {
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ["admin-low-stock", LOW_STOCK_THRESHOLD],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, image_url, price")
        .lte("stock", LOW_STOCK_THRESHOLD)
        .order("stock", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Low Stock Alerts
          {lowStock && lowStock.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{lowStock.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Checking inventory...</p>
        ) : !lowStock || lowStock.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Package className="h-8 w-8 opacity-40" />
            <span>All products are well stocked.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lowStock.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <div className="w-9 h-9 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">₹{Number(p.price).toFixed(0)}</p>
                </div>
                <Badge
                  variant={p.stock === 0 ? "destructive" : "outline"}
                  className={p.stock === 0 ? "" : "border-orange-300 text-orange-600"}
                >
                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}