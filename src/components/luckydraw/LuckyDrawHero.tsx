import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Users, Trophy, Brain, Ticket, Share2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DrawCountdown } from "./DrawCountdown";
import { useToast } from "@/hooks/use-toast";

interface LuckyDrawHeroProps {
  user?: any;
}

export function LuckyDrawHero({ user }: LuckyDrawHeroProps) {
  const { toast } = useToast();
  const { data: activeDraw } = useQuery({
    queryKey: ["hero-draw"],
    queryFn: async () => {
      const { data } = await supabase
        .from("draws")
        .select("*, draw_prizes(*)")
        .in("status", ["active", "upcoming"])
        .order("draw_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: myReferral } = useQuery({
    queryKey: ["hero-ref-code", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.code ?? null;
    },
  });

  const shareUrl = (() => {
    const base = `${window.location.origin}/lucky-draw`;
    return myReferral ? `${base}?ref=${myReferral}` : base;
  })();

  const topPrizeAmount = activeDraw?.draw_prizes
    ?.sort((a: any, b: any) => a.position - b.position)?.[0]?.prize_amount;

  const shareOnWhatsApp = () => {
    const prizeLine = topPrizeAmount ? `🏆 Top prize: ₹${topPrizeAmount}\n` : "";
    const referralLine = myReferral
      ? `\nUse my referral link so I get a bonus entry too:\n${shareUrl}`
      : `\nJoin here: ${shareUrl}`;
    const message =
      `🎁 *ShopHub Weekly Lucky Draw*\n` +
      `${prizeLine}✅ Free entry every week\n` +
      `✅ Provably fair (public seed + hash)\n` +
      `✅ Instant wallet payout` +
      referralLine;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Paste it into any chat to invite friends." });
    } catch {
      toast({ title: "Copy failed", description: "Long-press the link to copy manually.", variant: "destructive" });
    }
  };

  const topPrize = activeDraw?.draw_prizes
    ?.sort((a: any, b: any) => a.position - b.position)?.[0];

  return (
    <section className="relative overflow-hidden bg-gradient-hero py-20 md:py-28">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-secondary/20 blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.08, 0.05] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-primary-foreground/10 blur-[80px]"
        />
        {/* Floating icons */}
        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[15%] opacity-20"
        >
          <Gift className="h-8 w-8 text-secondary" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 12, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-32 right-[10%] opacity-20"
        >
          <Trophy className="h-10 w-10 text-secondary" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-24 right-[25%] opacity-15"
        >
          <Ticket className="h-7 w-7 text-primary-foreground" />
        </motion.div>
      </div>
      
      <div className="container px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/10">
            <Sparkles className="h-4 w-4 text-secondary" />
            <span className="text-sm font-medium text-primary-foreground/90">Promotional Reward Program</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6" style={{ lineHeight: '1.1' }}>
            Join the Weekly
            <br />
            <span className="bg-gradient-to-r from-secondary to-secondary/80 bg-clip-text text-transparent">
              Lucky Draw
            </span>{" "}
            🎁
          </h1>
          
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto" style={{ textWrap: 'balance' as any }}>
            Get a free entry every week. Refer friends to earn bonus chances. 
            Win cash prizes up to ₹5,000. Transparent draws, instant payouts.
          </p>

          {/* Live countdown */}
          {activeDraw && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2 mb-8"
            >
              <p className="text-sm text-primary-foreground/60 uppercase tracking-wider font-medium">
                Next draw in
              </p>
              <DrawCountdown targetDate={activeDraw.draw_date} variant="hero" />
              {topPrize && (
                <p className="text-primary-foreground/70 text-sm mt-2">
                  Top prize: <span className="font-bold text-secondary">₹{topPrize.prize_amount}</span>
                </p>
              )}
            </motion.div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            {user ? (
              <a href="#active-draws">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2 px-8 text-base shadow-xl">
                  <Gift className="h-5 w-5" />
                  Claim Free Entry
                </Button>
              </a>
            ) : (
              <Link to={`/auth${sessionStorage.getItem("shophub_ref") ? `?ref=${sessionStorage.getItem("shophub_ref")}` : ""}`}>
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2 px-8 text-base shadow-xl">
                  <Gift className="h-5 w-5" />
                  Claim Free Entry
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              onClick={shareOnWhatsApp}
              className="gap-2 px-8 text-base bg-[#25D366] text-white hover:bg-[#1ebe5a] shadow-xl"
            >
              <Share2 className="h-5 w-5" />
              Share on WhatsApp
            </Button>
            <Link to="/quiz">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 px-8 text-base bg-primary-foreground/10 backdrop-blur-sm border-2 border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground hover:text-primary shadow-lg"
              >
                <Brain className="h-5 w-5" />
                Play Quiz
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6 text-xs text-primary-foreground/70">
            <button
              type="button"
              onClick={copyLink}
              className="underline underline-offset-4 hover:text-primary-foreground"
            >
              Copy invite link
            </button>
            <span className="h-3 w-px bg-primary-foreground/20" />
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
              Provably fair · Public seed &amp; hash
            </span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/70 text-sm">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-secondary" />
              <span className="font-semibold text-primary-foreground">Free</span> entry option
            </div>
            <div className="h-4 w-px bg-primary-foreground/20" />
            <div className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-secondary" />
              <span className="font-semibold text-primary-foreground">₹1</span> per extra entry
            </div>
            <div className="h-4 w-px bg-primary-foreground/20" />
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-secondary" />
              <span className="font-semibold text-primary-foreground">Refer</span> for bonus
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
