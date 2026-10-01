import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Brain, ArrowRight, Sparkles, Trophy, Users, Ticket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function EngagementSection() {
  const { data: activeDraw } = useQuery({
    queryKey: ["home-active-draw"],
    queryFn: async () => {
      const { data } = await supabase
        .from("draws")
        .select("*, draw_prizes(*), draw_entries(count)")
        .in("status", ["active", "upcoming"])
        .order("draw_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: activeQuiz } = useQuery({
    queryKey: ["home-active-quiz"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!activeDraw && !activeQuiz) return null;

  const topPrize = activeDraw?.draw_prizes
    ?.sort((a: any, b: any) => a.position - b.position)?.[0];

  return (
    <section className="py-14 md:py-20">
      <div className="container px-4">
        <div className="mb-10 text-center animate-fade-in-up">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
            Win Exciting Prizes
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Play, Win & Celebrate 🎉
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {activeDraw && (
            <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <Link to="/lucky-draw" className="group block h-full">
                <div className="relative h-full rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-4 right-4 opacity-10">
                    <Gift className="h-24 w-24 text-primary animate-float-slow" />
                  </div>

                  <Badge className="mb-4 bg-destructive/10 text-destructive border-destructive/20">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Live Draw
                  </Badge>

                  <h3 className="text-2xl font-bold text-foreground mb-2">Weekly Lucky Draw</h3>
                  <p className="text-muted-foreground mb-5 max-w-sm">
                    Get a free entry, refer friends for bonus chances, and win cash prizes!
                  </p>

                  {topPrize && (
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Prize</p>
                        <p className="text-xl font-bold text-foreground">₹{topPrize.prize_amount}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span>₹1 per entry</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Free entry available</span>
                    </div>
                  </div>

                  <Button className="gap-2 bg-primary hover:bg-primary/90 group-hover:gap-3 transition-all">
                    Enter Lucky Draw
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </Link>
            </div>
          )}

          {activeQuiz && (
            <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Link to="/quiz" className="group block h-full">
                <div className="relative h-full rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-secondary/5 via-background to-primary/5 p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-4 right-4 opacity-10">
                    <Brain className="h-24 w-24 text-secondary animate-float-slow-alt" />
                  </div>

                  <Badge className="mb-4 bg-secondary/10 text-secondary border-secondary/20">
                    <Brain className="h-3 w-3 mr-1" />
                    Play & Win
                  </Badge>

                  <h3 className="text-2xl font-bold text-foreground mb-2">Quiz Challenge</h3>
                  <p className="text-muted-foreground mb-5 max-w-sm">
                    Answer {activeQuiz.questions_per_attempt} questions correctly and earn a free Lucky Draw entry!
                  </p>

                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Gift className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Reward</p>
                      <p className="text-lg font-bold text-foreground">Free Lucky Draw Entry</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-4 w-4 text-secondary" />
                      <span>{activeQuiz.questions_per_attempt} questions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-secondary" />
                      <span>Pass: {activeQuiz.passing_score}/{activeQuiz.questions_per_attempt}</span>
                    </div>
                  </div>

                  <Button className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 group-hover:gap-3 transition-all">
                    Play Quiz Now
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
