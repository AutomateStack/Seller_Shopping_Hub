import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Trophy, Gem } from "lucide-react";
import { formatINR } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

interface Props { userId: string }

const TIERS = [
  { name: "Bronze", min: 0,    next: 5000,  icon: Sparkles, color: "text-amber-700",  bg: "bg-amber-50 dark:bg-amber-950/30", perk: "1× points" },
  { name: "Silver", min: 5000, next: 15000, icon: Trophy,   color: "text-slate-500",  bg: "bg-slate-50 dark:bg-slate-900/40", perk: "1.5× points · free shipping ₹499+" },
  { name: "Gold",   min: 15000,next: 50000, icon: Crown,    color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", perk: "2× points · priority support" },
  { name: "Platinum", min: 50000, next: Infinity, icon: Gem, color: "text-primary", bg: "bg-primary/10", perk: "3× points · early access drops" },
];

function getTier(spent: number) {
  let t = TIERS[0];
  for (const tier of TIERS) if (spent >= tier.min) t = tier;
  return t;
}

export function LoyaltyCard({ userId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["loyalty", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, status")
        .eq("user_id", userId)
        .neq("status", "cancelled");
      const totalSpent = (orders || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const orderCount = (orders || []).length;
      // 1 point per ₹10 spent
      const points = Math.floor(totalSpent / 10);
      return { totalSpent, orderCount, points };
    },
  });

  const totalSpent = data?.totalSpent ?? 0;
  const tier = getTier(totalSpent);
  const Icon = tier.icon;
  const next = isFinite(tier.next) ? tier.next : tier.min;
  const progress = isFinite(tier.next) ? Math.min(100, Math.round(((totalSpent - tier.min) / (tier.next - tier.min)) * 100)) : 100;
  const remaining = isFinite(tier.next) ? Math.max(0, tier.next - totalSpent) : 0;

  return (
    <Card className="overflow-hidden">
      <div className={`${tier.bg} px-6 py-5 border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-background/80 flex items-center justify-center shadow-sm">
              <Icon className={`h-6 w-6 ${tier.color}`} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Loyalty Tier</p>
              <h2 className="text-xl font-bold text-foreground">{tier.name} Member</h2>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">{tier.perk}</Badge>
        </div>
      </div>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="h-20 bg-muted animate-pulse rounded-md" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div>
                <p className="text-xs text-muted-foreground">Lifetime Spent</p>
                <p className="text-lg font-bold text-foreground">{formatINR(totalSpent, { compact: true })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-lg font-bold text-foreground">{data?.orderCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reward Points</p>
                <p className="text-lg font-bold text-primary">{data?.points ?? 0}</p>
              </div>
            </div>
            {isFinite(tier.next) ? (
              <>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Progress to next tier</span>
                  <span className="font-medium text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Spend <strong className="text-foreground">{formatINR(remaining, { compact: true })}</strong> more to unlock the next tier.
                </p>
              </>
            ) : (
              <p className="text-sm text-primary font-medium">🎉 You've reached the top tier — enjoy all premium perks!</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 sm:hidden">{tier.perk}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
