import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Trophy, Share2, Sparkles } from "lucide-react";

interface MyEntriesPanelProps {
  user: any;
}

const LABELS: Record<string, string> = {
  free: "Free entry",
  paid: "Purchased",
  quiz: "Quiz win",
  referral: "Referral bonus",
};

/** Personal summary of a signed-in player's entries, wins and next best action. */
export function MyEntriesPanel({ user }: MyEntriesPanelProps) {
  const { data } = useQuery({
    queryKey: ["my-draw-summary", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [entriesRes, winsRes, codeRes] = await Promise.all([
        supabase.from("draw_entries").select("entry_type, draw_id").eq("user_id", user.id),
        supabase.from("draw_winners").select("prize_amount, prize_label").eq("user_id", user.id),
        supabase.from("referral_codes").select("code, total_referrals").eq("user_id", user.id).maybeSingle(),
      ]);
      const entries = entriesRes.data ?? [];
      const byType = entries.reduce<Record<string, number>>((acc, e: any) => {
        acc[e.entry_type] = (acc[e.entry_type] || 0) + 1;
        return acc;
      }, {});
      const wins = winsRes.data ?? [];
      return {
        total: entries.length,
        draws: new Set(entries.map((e: any) => e.draw_id)).size,
        byType,
        wins: wins.length,
        won: wins.reduce((s: number, w: any) => s + Number(w.prize_amount || 0), 0),
        code: codeRes.data?.code as string | undefined,
        referrals: codeRes.data?.total_referrals ?? 0,
      };
    },
  });

  if (!user || !data) return null;

  const shareUrl = data.code
    ? `${window.location.origin}/lucky-draw?ref=${data.code}`
    : `${window.location.origin}/lucky-draw`;

  const share = () => {
    const text = `I'm in this week's ShopHub Lucky Draw — free entry, provably fair, real cash prizes. Join with my link: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="container mx-auto px-4 py-8">
      <Card className="surface-elevated overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-secondary" />
            Your draw dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total entries", value: data.total, icon: Ticket },
              { label: "Draws joined", value: data.draws, icon: Ticket },
              { label: "Prizes won", value: data.wins, icon: Trophy },
              { label: "Total winnings", value: `₹${data.won.toFixed(0)}`, icon: Trophy },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-muted/40 p-3">
                <s.icon className="h-4 w-4 text-primary mb-1.5" aria-hidden="true" />
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {Object.keys(data.byType).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.byType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {LABELS[type] ?? type}: {count}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/60 p-3">
            <p className="text-sm text-accent-foreground">
              {data.referrals > 0
                ? `${data.referrals} friend${data.referrals > 1 ? "s" : ""} joined through you — each one adds a bonus entry.`
                : "Invite a friend and you both get a bonus entry in the next draw."}
            </p>
            <Button size="sm" onClick={share} className="gap-2 sheen">
              <Share2 className="h-4 w-4" />
              Share on WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}