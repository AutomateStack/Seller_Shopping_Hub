import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Ticket, Clock, Trophy, Plus, Minus, Sparkles, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DrawCountdown } from "./DrawCountdown";

interface ActiveDrawsProps {
  user: any;
}

export function ActiveDraws({ user }: ActiveDrawsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [buyCount, setBuyCount] = useState<Record<string, number>>({});

  const { data: draws } = useQuery({
    queryKey: ["active-draws"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*, draw_prizes(*)")
        .in("status", ["upcoming", "active"])
        .order("draw_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: userEntries } = useQuery({
    queryKey: ["user-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draw_entries")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const claimFreeEntry = useMutation({
    mutationFn: async (drawId: string) => {
      const { data, error } = await supabase.functions.invoke("claim-free-entry", {
        body: { drawId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-entries"] });
      toast({ title: "🎉 Free entry claimed!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const buyEntries = useMutation({
    mutationFn: async ({ drawId, count }: { drawId: string; count: number }) => {
      const { data, error } = await supabase.functions.invoke("wallet-buy-entries", {
        body: { drawId, count },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: (_, { drawId, count }) => {
      queryClient.invalidateQueries({ queryKey: ["user-entries"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setBuyCount(prev => ({ ...prev, [drawId]: 1 }));
      toast({ title: `🎫 ${count} entries purchased!` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getEntriesForDraw = (drawId: string) =>
    userEntries?.filter(e => e.draw_id === drawId).length || 0;

  const hasFreeEntry = (drawId: string) =>
    userEntries?.some(e => e.draw_id === drawId && e.entry_type === "free") || false;

  const getEntryBreakdown = (drawId: string) => {
    const entries = userEntries?.filter(e => e.draw_id === drawId) || [];
    return {
      free: entries.filter(e => e.entry_type === "free").length,
      paid: entries.filter(e => e.entry_type === "paid").length,
      referral: entries.filter(e => e.entry_type === "referral").length,
      quiz: entries.filter(e => e.entry_type === "quiz").length,
      total: entries.length,
    };
  };

  if (!draws?.length) {
    return (
      <section className="py-16">
        <div className="container px-4 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Active Draws</h2>
          <p className="text-muted-foreground">Check back soon for upcoming draws!</p>
        </div>
      </section>
    );
  }

  return (
    <section id="active-draws" className="py-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Active Draws</h2>
          <p className="text-muted-foreground">Enter now for a chance to win!</p>
        </motion.div>

        <div className="grid gap-6 max-w-4xl mx-auto">
          {draws.map((draw, i) => {
            const claimed = hasFreeEntry(draw.id);
            const count = buyCount[draw.id] || 1;
            const prizes = (draw.draw_prizes as any[])?.sort((a: any, b: any) => a.position - b.position) || [];
            const breakdown = getEntryBreakdown(draw.id);

            return (
              <motion.div
                key={draw.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="overflow-hidden border-2 hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={draw.status === "active" ? "default" : "secondary"} className="gap-1">
                            {draw.status === "active" ? (
                              <>
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                Live Now
                              </>
                            ) : "📅 Upcoming"}
                          </Badge>
                          {breakdown.total > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <Ticket className="h-3 w-3" />
                              {breakdown.total} {breakdown.total === 1 ? "entry" : "entries"}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{draw.title}</CardTitle>
                        {draw.description && (
                          <p className="text-sm text-muted-foreground mt-1">{draw.description}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <DrawCountdown targetDate={draw.draw_date} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Prizes - enhanced with gradient backgrounds */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {prizes.map((prize: any) => {
                        const colors = [
                          "from-yellow-50 to-yellow-100/50 border-yellow-200 dark:from-yellow-950/20 dark:to-yellow-900/10 dark:border-yellow-800/30",
                          "from-gray-50 to-gray-100/50 border-gray-200 dark:from-gray-800/20 dark:to-gray-700/10 dark:border-gray-700/30",
                          "from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-950/20 dark:to-amber-900/10 dark:border-amber-800/30",
                        ];
                        const trophyColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];
                        return (
                          <div
                            key={prize.id}
                            className={`flex items-center gap-3 bg-gradient-to-br ${colors[prize.position - 1] || colors[2]} rounded-xl px-4 py-3 border`}
                          >
                            <Trophy className={`h-5 w-5 shrink-0 ${trophyColors[prize.position - 1] || trophyColors[2]}`} />
                            <div>
                              <p className="text-xs text-muted-foreground">{prize.prize_label}</p>
                              <p className="text-lg font-bold text-foreground">₹{prize.prize_amount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Entry breakdown */}
                    {user && breakdown.total > 0 && (
                      <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">Your Entries</span>
                          <span className="font-bold text-foreground">{breakdown.total} total</span>
                        </div>
                        <Progress value={Math.min(breakdown.total * 10, 100)} className="h-2" />
                        <div className="flex flex-wrap gap-2 mt-1">
                          {breakdown.free > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Sparkles className="h-3 w-3" />
                              {breakdown.free} free
                            </Badge>
                          )}
                          {breakdown.paid > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Ticket className="h-3 w-3" />
                              {breakdown.paid} paid
                            </Badge>
                          )}
                          {breakdown.referral > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Users className="h-3 w-3" />
                              {breakdown.referral} referral
                            </Badge>
                          )}
                          {breakdown.quiz > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              🧠 {breakdown.quiz} quiz
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {!user ? (
                        <Link to="/auth">
                          <Button className="gap-2">
                            <Ticket className="h-4 w-4" />
                            Sign In to Enter
                          </Button>
                        </Link>
                      ) : (
                        <>
                          {!claimed && (
                            <Button
                              onClick={() => claimFreeEntry.mutate(draw.id)}
                              disabled={claimFreeEntry.isPending}
                              className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                              <Sparkles className="h-4 w-4" />
                              Claim Free Entry
                            </Button>
                          )}

                          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setBuyCount(prev => ({ ...prev, [draw.id]: Math.max(1, count - 1) }))}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold tabular-nums">{count}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setBuyCount(prev => ({ ...prev, [draw.id]: count + 1 }))}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            onClick={() => buyEntries.mutate({ drawId: draw.id, count })}
                            disabled={buyEntries.isPending}
                            variant="outline"
                            className="gap-2"
                          >
                            Buy {count} for ₹{(draw.entry_fee * count).toFixed(0)}
                          </Button>

                          <div className="ml-auto text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Wallet: ₹{wallet?.balance?.toFixed(2) || "0.00"}
                            <Link to="/wallet" className="text-primary ml-1 hover:underline">Add funds</Link>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
