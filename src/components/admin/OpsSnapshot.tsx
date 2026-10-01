import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, PackageX, Banknote, BellRing } from "lucide-react";

interface OpsSnapshotProps {
  orders: any[] | undefined;
  products: any[] | undefined;
}

/** "Needs action today" strip — the things an operator must clear before closing the day. */
export function OpsSnapshot({ orders, products }: OpsSnapshotProps) {
  const { data: extra } = useQuery({
    queryKey: ["admin-ops-snapshot"],
    queryFn: async () => {
      const [withdrawals, notifications] = await Promise.all([
        supabase.from("withdrawal_requests").select("id").eq("status", "pending"),
        supabase.from("stock_notifications").select("id").eq("notified", false),
      ]);
      return {
        pendingWithdrawals: withdrawals.data?.length ?? 0,
        pendingNotifications: notifications.data?.length ?? 0,
      };
    },
  });

  const pendingOrders = orders?.filter((o) => o.status === "pending").length ?? 0;
  const unpaidOrders = orders?.filter((o) => o.payment_status === "pending").length ?? 0;
  const outOfStock = products?.filter((p) => (p.stock ?? 0) <= 0).length ?? 0;

  const items = [
    { label: "Orders to process", value: pendingOrders, icon: Clock },
    { label: "Payments unconfirmed", value: unpaidOrders, icon: AlertTriangle },
    { label: "Products out of stock", value: outOfStock, icon: PackageX },
    { label: "Withdrawals to approve", value: extra?.pendingWithdrawals ?? 0, icon: Banknote },
    { label: "Restock alerts queued", value: extra?.pendingNotifications ?? 0, icon: BellRing },
  ];

  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <Card className="surface-elevated">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Needs action today
          </h2>
          <span className="text-xs text-muted-foreground">
            {total === 0 ? "All clear" : `${total} open item${total > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {items.map((i) => (
            <div
              key={i.label}
              className={`rounded-xl border p-3 transition-colors ${
                i.value > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-muted/40"
              }`}
            >
              <i.icon
                className={`h-4 w-4 mb-1.5 ${i.value > 0 ? "text-destructive" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <p className="text-xl font-bold leading-none">{i.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{i.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}