import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ArrowRight, Brain, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { QuizTimer } from "@/components/quiz/QuizTimer";

export default function PlayQuiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [finished, setFinished] = useState(false);
  const [revealedCorrect, setRevealedCorrect] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  // Track user's selection per question id so we can send them to server-side scoring
  const selectedOptionsByQ = useRef<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth?redirect=/quiz"); return; }
      setUser(session.user);
    });
  }, [navigate]);

  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingAttempt } = useQuery({
    queryKey: ["quiz-attempt", quizId, user?.id],
    enabled: !!user && !!quizId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quizId!)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: allQuestions } = useQuery({
    queryKey: ["quiz-questions", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, quiz_id, question, options, created_at")
        .eq("quiz_id", quizId!);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (allQuestions && allQuestions.length > 0 && quizQuestions.length === 0) {
      const limit = quiz?.questions_per_attempt || 5;
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, limit);
      setQuizQuestions(shuffled);
    }
  }, [allQuestions, quiz, quizQuestions.length]);

  useEffect(() => {
    if (existingAttempt) {
      navigate(`/quiz/${quizId}/result`, { replace: true });
    }
  }, [existingAttempt, navigate, quizId]);

  const submitAttempt = useMutation({
    mutationFn: async (_finalScore: number) => {
      // Server-side scoring: send the answered question IDs and the user's selections;
      // the edge function recomputes the score against stored correct answers.
      const answers = answeredQuestionIds.map((qid, idx) => ({
        questionId: qid,
        selectedOption: selectedOptionsByQ.current[qid] ?? -1,
      }));
      const { data, error } = await supabase.functions.invoke("submit-quiz-attempt", {
        body: { quizId: quizId!, answers },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      navigate(`/quiz/${quizId}/result`, { replace: true });
    },
    onError: (err: any) => {
      toast({ title: "Error submitting quiz", description: err.message, variant: "destructive" });
    },
  });

  const handleSelectOption = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
  };

  const handleConfirm = useCallback(async () => {
    if (selectedOption === null && !answered) return;
    const currentQ = quizQuestions[currentIndex];
    setGrading(true);
    const { data, error } = await supabase.functions.invoke("grade-quiz-answer", {
      body: { questionId: currentQ.id, selectedOption: selectedOption ?? -1 },
    });
    setGrading(false);
    if (error) {
      toast({ title: "Error grading answer", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as any;
    if (result?.is_correct) setScore(prev => prev + 1);
    // Only reveal whether the user's choice was correct — never reveal the
    // correct option itself, otherwise the grader becomes an answer oracle.
    setRevealedCorrect(result?.is_correct ? (selectedOption ?? null) : null);
    selectedOptionsByQ.current[currentQ.id] = selectedOption ?? -1;
    setAnsweredQuestionIds(prev => [...prev, currentQ.id]);
    setAnswered(true);
  }, [selectedOption, answered, quizQuestions, currentIndex, toast]);

  const handleTimeUp = useCallback(async () => {
    if (!answered) {
      const currentQ = quizQuestions[currentIndex];
      await supabase.functions.invoke("grade-quiz-answer", {
        body: { questionId: currentQ.id, selectedOption: -1 },
      });
      setRevealedCorrect(null);
      selectedOptionsByQ.current[currentQ.id] = -1;
      setAnsweredQuestionIds(prev => [...prev, currentQ.id]);
      setAnswered(true);
    }
  }, [answered, quizQuestions, currentIndex]);

  const handleNext = () => {
    if (currentIndex + 1 >= quizQuestions.length) {
      setFinished(true);
      submitAttempt.mutate(score);
      return;
    }
    setCurrentIndex(prev => prev + 1);
    setSelectedOption(null);
    setAnswered(false);
    setRevealedCorrect(null);
  };

  if (!quiz || quizQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const currentQ = quizQuestions[currentIndex];
  const options = (currentQ.options as string[]) || [];
  const progress = ((currentIndex + (answered ? 1 : 0)) / quizQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`Playing: ${quiz.title} | ShopHub`} description="Answer quiz questions to win prizes" canonical={`/quiz/${quizId}/play`} />
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Brain className="h-3 w-3" />
              Question {currentIndex + 1} of {quizQuestions.length}
            </Badge>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Score: {score}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <QuizTimer
            duration={30}
            onTimeUp={handleTimeUp}
            isPaused={answered}
            questionIndex={currentIndex}
          />
        </div>

        {/* Question with animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6 overflow-hidden">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-xl leading-relaxed">{currentQ.question}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {options.map((option: string, idx: number) => {
                  const isCorrect = idx === revealedCorrect;
                  const isSelected = idx === selectedOption;
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={answered}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
                        !answered && isSelected && "border-primary bg-accent shadow-md scale-[1.01]",
                        !answered && !isSelected && "border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm",
                        answered && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/20 shadow-md",
                        answered && isSelected && !isCorrect && "border-destructive bg-red-50 dark:bg-red-950/20",
                        answered && !isCorrect && !isSelected && "opacity-40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-colors",
                            !answered && isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
                            answered && isCorrect && "bg-green-500 text-white border-green-500",
                            answered && isSelected && !isCorrect && "bg-destructive text-white border-destructive"
                          )}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="font-medium">{option}</span>
                        </div>
                        {answered && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
                        {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                      </div>
                    </motion.button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {!answered ? (
            <Button onClick={handleConfirm} disabled={selectedOption === null || grading} variant="hero" size="lg" className="gap-2">
              {grading ? "Checking..." : "Confirm Answer"}
            </Button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button onClick={handleNext} disabled={finished || submitAttempt.isPending} size="lg" className="gap-2">
                {currentIndex + 1 >= quizQuestions.length ? "See Results" : "Next Question"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
