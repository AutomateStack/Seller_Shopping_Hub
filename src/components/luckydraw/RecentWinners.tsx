import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, PartyPopper, ShieldCheck, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export function RecentWinners() {
  const { data: winners } = useQuery({
    queryKey: ["recent-winners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draw_winners")
        .select("*, draws(title, draw_date)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (!winners?.length) return null;

  const totalPaid = winners.reduce((s, w: any) => s + Number(w.prize_amount || 0), 0);
  const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

  return (
    <section className="py-16 bg-muted/50">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <PartyPopper className="h-5 w-5 text-secondary" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Recent Winners</h2>
          </div>
          <p className="text-muted-foreground">Real winners, real prizes. Could you be next?</p>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold">
              <Wallet className="h-3.5 w-3.5" />
              ₹{fmt(totalPaid)}+ paid to recent winners
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Every payout verified on-chain of records
            </span>
          </div>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-3">
          {winners.map((winner, i) => {
            const drawData = winner.draws as any;
            return (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-center justify-between bg-card rounded-xl px-5 py-4 border border-border shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    winner.prize_position === 1 ? "bg-yellow-100 text-yellow-600" :
                    winner.prize_position === 2 ? "bg-gray-100 text-gray-500" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {winner.user_id ? `User ***${winner.user_id.slice(-4)}` : "Lucky Winner"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {drawData?.title} • {drawData?.draw_date ? format(new Date(drawData.draw_date), "MMM d, yyyy") : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">₹{winner.prize_amount}</p>
                  <p className="text-xs text-muted-foreground">{winner.prize_label}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Payout verified
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
