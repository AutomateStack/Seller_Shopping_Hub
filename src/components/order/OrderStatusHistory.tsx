import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, Truck, MapPin, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusHistoryEntry {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
}

const statusMeta: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-500 bg-amber-50 border-amber-200" },
  processing: { label: "Processing", icon: Package, color: "text-blue-500 bg-blue-50 border-blue-200" },
  shipped: { label: "Shipped", icon: Truck, color: "text-purple-500 bg-purple-50 border-purple-200" },
  delivered: { label: "Delivered", icon: MapPin, color: "text-green-500 bg-green-50 border-green-200" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-destructive bg-red-50 border-red-200" },
};

function getStatusInfo(status: string) {
  return statusMeta[status] || { label: status, icon: Clock, color: "text-muted-foreground bg-muted border-border" };
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

interface OrderStatusHistoryProps {
  orderId: string;
}

export function OrderStatusHistory({ orderId }: OrderStatusHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return (data as StatusHistoryEntry[]) || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No status history available for this order.</p>
    );
  }

  return (
    <div className="space-y-0">
      {history.map((entry, i) => {
        const info = getStatusInfo(entry.new_status);
        const Icon = info.icon;
        const dt = formatDateTime(entry.changed_at);
        const isLast = i === history.length - 1;

        return (
          <div key={entry.id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-border" />
            )}

            {/* Icon */}
            <div className={cn("relative z-10 flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center", info.color)}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.old_status && (
                  <>
                    <span className="text-sm font-medium text-muted-foreground capitalize">{getStatusInfo(entry.old_status).label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <span className="text-sm font-semibold capitalize">{info.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dt.date} at {dt.time}
              </p>
              {!entry.old_status && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">Order placed</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
