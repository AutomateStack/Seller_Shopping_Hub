import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Wallet, Users, ShieldCheck } from "lucide-react";

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function LuckyDrawStats() {
  const { data } = useQuery({
    queryKey: ["lucky-draw-stats"],
    queryFn: async () => {
      const [activeDraws, prizePool, entries, winners, paidOut] = await Promise.all([
        supabase.from("draws").select("id", { count: "exact", head: true }).in("status", ["active", "upcoming"]),
        supabase.from("draw_prizes").select("prize_amount, draw_id, draws!inner(status)").in("draws.status", ["active", "upcoming"]),
        supabase.from("draw_entries").select("id", { count: "exact", head: true }),
        supabase.from("draw_winners").select("id", { count: "exact", head: true }),
        supabase.from("draw_winners").select("prize_amount"),
      ]);
      const pool = (prizePool.data ?? []).reduce((s: number, r: any) => s + Number(r.prize_amount || 0), 0);
      const paid = (paidOut.data ?? []).reduce((s: number, r: any) => s + Number(r.prize_amount || 0), 0);
      return {
        activeDraws: activeDraws.count ?? 0,
        prizePool: pool,
        entries: entries.count ?? 0,
        winners: winners.count ?? 0,
        paidOut: paid,
      };
    },
    staleTime: 60_000,
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

  return (
    <section aria-label="Lucky draw trust signals" className="py-8 border-y border-border bg-muted/30">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
          <StatCard
            icon={Wallet}
            value={`₹${fmt(data?.prizePool ?? 0)}`}
            label="Live prize pool"
          />
          <StatCard
            icon={Ticket}
            value={fmt(data?.entries ?? 0)}
            label="Entries so far"
          />
          <StatCard
            icon={Users}
            value={fmt(data?.winners ?? 0)}
            label="Real winners paid"
          />
          <StatCard
            icon={ShieldCheck}
            value={`₹${fmt(data?.paidOut ?? 0)}`}
            label="Total payout to date"
          />
        </div>
      </div>
    </section>
  );
}
