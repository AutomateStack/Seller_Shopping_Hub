import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Trophy, Brain, Clock, Gift, Star } from "lucide-react";
import { useState, useEffect } from "react";

export default function Quiz() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["my-quiz-attempts"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const getAttemptForQuiz = (quizId: string) => {
    return attempts?.find(a => a.quiz_id === quizId);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Play Quiz & Enter Lucky Draw | ShopHub"
        description="Test your knowledge, play exciting quizzes and earn free Lucky Draw entries. Share with friends for more chances to win!"
        canonical="/quiz"
      />
      <Navbar />

      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-4 bg-secondary text-secondary-foreground px-4 py-1.5 text-sm">
            <Brain className="h-4 w-4 mr-1" /> Quiz & Win
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
            Play Quiz & Enter Lucky Draw 🎯
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-6">
            Answer questions correctly to earn a free entry into the Lucky Draw! Share with friends to spread the fun!
          </p>
          <div className="flex justify-center gap-8 text-primary-foreground/70">
            <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><span>5 Questions</span></div>
            <div className="flex items-center gap-2"><Trophy className="h-5 w-5" /><span>Lucky Draw Entry</span></div>
            <div className="flex items-center gap-2"><Gift className="h-5 w-5" /><span>Share & Earn</span></div>
          </div>
        </div>
      </section>

      {/* Quiz List */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Available Quizzes</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : quizzes && quizzes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => {
              const attempt = getAttemptForQuiz(quiz.id);
              return (
                <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <CardDescription className="mt-1">{quiz.description}</CardDescription>
                      </div>
                      <Brain className="h-8 w-8 text-primary shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 text-secondary" />
                      <span>🎟️ Win a free Lucky Draw entry!</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{quiz.questions_per_attempt} questions • Pass: {quiz.passing_score}/{quiz.questions_per_attempt}</span>
                    </div>
                    {attempt ? (
                      <div className="space-y-2">
                        <Badge variant={attempt.prize_won ? "default" : "secondary"}>
                          {attempt.prize_won ? "🎟️ Lucky Draw Entry Earned!" : `Score: ${attempt.score}/${attempt.total_questions}`}
                        </Badge>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => navigate(`/quiz/${quiz.id}/result`)}
                        >
                          View Results
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        variant="hero"
                        onClick={() => {
                          if (!user) {
                            navigate("/auth?redirect=/quiz");
                            return;
                          }
                          navigate(`/quiz/${quiz.id}/play`);
                        }}
                      >
                        Play Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No quizzes available right now. Check back soon!</p>
          </Card>
        )}
      </section>
      <Footer />
    </div>
  );
}
