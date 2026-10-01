import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Share2, MessageCircle, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuizResult() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
    });
  }, [navigate]);

  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: attempt } = useQuery({
    queryKey: ["quiz-result", quizId, user?.id],
    enabled: !!user && !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quizId!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const shareUrl = `${window.location.origin}/quiz`;
  const shareText = attempt?.prize_won
    ? `🎉 I just won a prize on ShopHub Quiz! Can you beat my score of ${attempt?.score}/${attempt?.total_questions}? Play now:`
    : `🧠 I scored ${attempt?.score}/${attempt?.total_questions} on ShopHub Quiz! Can you do better? Play now:`;

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText + " " + shareUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "ShopHub Quiz", text: shareText, url: shareUrl });
    } else {
      handleCopyLink();
    }
  };

  if (!attempt || !quiz) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const percentage = Math.round((attempt.score / attempt.total_questions) * 100);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`Quiz Result | ShopHub`} description="Your quiz results" canonical={`/quiz/${quizId}/result`} />
      <Navbar />

      <div className="container mx-auto px-4 py-12 max-w-lg">
        {/* Result Card */}
        <Card className="text-center mb-8">
          <CardHeader>
            <div className="mx-auto mb-4">
              {attempt.prize_won ? (
                <div className="h-20 w-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
                  <Trophy className="h-10 w-10 text-secondary" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <span className="text-3xl">🎯</span>
                </div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {attempt.prize_won ? "🎟️ Lucky Draw Entry Earned!" : "Good Try!"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {attempt.prize_won
                ? "🎟️ You've earned a free entry into the Lucky Draw! Check the Lucky Draw page for details."
                : `You scored ${attempt.score} out of ${attempt.total_questions}. Better luck next time!`}
            </p>

            {/* Score circle */}
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                <circle
                  cx="60" cy="60" r="50"
                  stroke={attempt.prize_won ? "hsl(var(--secondary))" : "hsl(var(--primary))"}
                  strokeWidth="10" fill="none"
                  strokeDasharray={`${percentage * 3.14} ${314 - percentage * 3.14}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{attempt.score}/{attempt.total_questions}</span>
              </div>
            </div>

            <Badge variant={attempt.prize_won ? "default" : "secondary"} className="text-sm">
              {percentage}% correct
            </Badge>
          </CardContent>
        </Card>

        {/* Share Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Share with Friends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Challenge your friends! Share this quiz on WhatsApp or other groups.
            </p>
            <Button onClick={handleWhatsAppShare} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="h-4 w-4 mr-2" /> Share on WhatsApp
            </Button>
            <Button onClick={handleNativeShare} variant="outline" className="w-full">
              <Share2 className="h-4 w-4 mr-2" /> Share via Other Apps
            </Button>
            <Button onClick={handleCopyLink} variant="ghost" className="w-full">
              {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/quiz")}>
            More Quizzes
          </Button>
          <Button className="flex-1" onClick={() => navigate("/lucky-draw")}>
            View Lucky Draw
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
