import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Brain, X, Users } from "lucide-react";
import { QuizParticipants } from "./QuizParticipants";

interface QuestionForm {
  question: string;
  options: string[];
  correct_option: number;
}

export function AdminQuizzes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [participantsQuiz, setParticipantsQuiz] = useState<{ id: string; title: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState("3");
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { question: "", options: ["", "", "", ""], correct_option: 0 },
  ]);

  const { data: quizzes } = useQuery({
    queryKey: ["admin-quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch participant counts per quiz
  const { data: participantCounts } = useQuery({
    queryKey: ["quiz-participant-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_attempts").select("quiz_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(a => { counts[a.quiz_id] = (counts[a.quiz_id] || 0) + 1; });
      return counts;
    },
  });

  const resetForm = () => {
    setEditingQuiz(null);
    setTitle("");
    setDescription("");
    setPassingScore("3");
    setPassingScore("3");
    setIsActive(true);
    setQuestions([{ question: "", options: ["", "", "", ""], correct_option: 0 }]);
  };

  const handleEdit = async (quiz: any) => {
    setEditingQuiz(quiz);
    setTitle(quiz.title);
    setDescription(quiz.description || "");
    setPassingScore(quiz.passing_score?.toString() || "3");
    setIsActive(quiz.is_active);

    const { data: resp } = await supabase.functions.invoke("admin-get-quiz-questions", {
      body: { quizId: quiz.id },
    });
    const qs = (resp as any)?.questions as Array<any> | undefined;
    if (qs && qs.length > 0) {
      setQuestions(qs.map((q: any) => ({
        question: q.question,
        options: q.options as string[],
        correct_option: q.correct_option,
      })));
    } else {
      setQuestions([{ question: "", options: ["", "", "", ""], correct_option: 0 }]);
    }
    setIsDialogOpen(true);
  };

  const saveQuiz = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      const validQuestions = questions.filter(q => q.question.trim() && q.options.every(o => o.trim()));
      const incompleteCount = questions.length - validQuestions.length;
      if (validQuestions.length < 5) {
        if (incompleteCount > 0) {
          throw new Error(`Only ${validQuestions.length} complete questions found. ${incompleteCount} question(s) have empty fields. Please fill all question texts and options, then ensure you have at least 5 complete questions.`);
        }
        throw new Error(`At least 5 questions are required. You currently have ${validQuestions.length}.`);
      }

      let quizId: string;
      const quizData = {
        title,
        description,
        prize_description: "Lucky Draw Entry",
        prize_amount: 0,
        passing_score: parseInt(passingScore) || 3,
        is_active: isActive,
        questions_per_attempt: 5,
      };

      if (editingQuiz) {
        const { error } = await supabase.from("quizzes").update(quizData).eq("id", editingQuiz.id);
        if (error) throw error;
        quizId = editingQuiz.id;
        await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);
      } else {
        const { data, error } = await supabase.from("quizzes").insert(quizData).select("id").single();
        if (error) throw error;
        quizId = data.id;
      }

      const { error: qError } = await supabase.from("quiz_questions").insert(
        validQuestions.map(q => ({
          quiz_id: quizId,
          question: q.question,
          options: q.options,
          correct_option: q.correct_option,
        }))
      );
      if (qError) throw qError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
      toast({ title: editingQuiz ? "Quiz updated" : "Quiz created" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("quizzes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
      toast({ title: "Quiz status updated" });
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
      toast({ title: "Quiz deleted" });
    },
  });

  const addQuestion = () => {
    setQuestions(prev => [...prev, { question: "", options: ["", "", "", ""], correct_option: 0 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quiz Management</h1>
          <p className="text-muted-foreground">Create and manage quizzes with prizes.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" />Create Quiz</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuiz ? "Edit Quiz" : "Create New Quiz"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz title" /></div>
                <div><Label>Passing Score (out of 5)</Label><Input type="number" min="1" max="5" value={passingScore} onChange={e => setPassingScore(e.target.value)} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Quiz description" /></div>
              <div className="p-3 rounded-lg bg-accent/50 border border-accent">
                <p className="text-sm text-muted-foreground">🎟️ <strong>Reward:</strong> Users who pass this quiz will earn a free entry into the current active Lucky Draw.</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Active</Label>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Questions ({questions.length})</Label>
                  <Button variant="outline" size="sm" onClick={addQuestion}><Plus className="h-3 w-3 mr-1" />Add Question</Button>
                </div>
                <div className="space-y-6">
                  {questions.map((q, qIdx) => (
                    <Card key={qIdx}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <Label className="font-semibold">Q{qIdx + 1}</Label>
                          {questions.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeQuestion(qIdx)}><X className="h-4 w-4" /></Button>
                          )}
                        </div>
                        <Input value={q.question} onChange={e => updateQuestion(qIdx, "question", e.target.value)} placeholder="Enter question" />
                        <div className="grid sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={q.correct_option === oIdx}
                                onChange={() => updateQuestion(qIdx, "correct_option", oIdx)}
                                className="accent-primary"
                              />
                              <Input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="flex-1" />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Button onClick={() => saveQuiz.mutate()} disabled={saveQuiz.isPending} className="w-full">
                {saveQuiz.isPending ? "Saving..." : editingQuiz ? "Update Quiz" : "Create Quiz"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quiz List */}
      <div className="space-y-4">
        {quizzes?.map(quiz => (
          <Card key={quiz.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">{quiz.title}</h3>
                  <p className="text-sm text-muted-foreground">{quiz.description}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant={quiz.is_active ? "default" : "secondary"}>
                        {quiz.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">🎟️ Lucky Draw Entry</Badge>
                      <Badge variant="outline">Pass: {quiz.passing_score}/5</Badge>
                      <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => setParticipantsQuiz({ id: quiz.id, title: quiz.title })}>
                        <Users className="h-3 w-3" /> {participantCounts?.[quiz.id] || 0} Participants
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={quiz.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: quiz.id, is_active: checked })}
                  />
                  <Button variant="outline" size="sm" onClick={() => setParticipantsQuiz({ id: quiz.id, title: quiz.title })}>
                    <Users className="h-4 w-4 mr-1" /> View
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(quiz)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteQuiz.mutate(quiz.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!quizzes || quizzes.length === 0) && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No quizzes yet. Create your first quiz!</p>
            </Card>
          )}
        </div>

        {/* Participants Dialog */}
        {participantsQuiz && (
          <QuizParticipants
            quizId={participantsQuiz.id}
            quizTitle={participantsQuiz.title}
            open={!!participantsQuiz}
            onOpenChange={(open) => !open && setParticipantsQuiz(null)}
          />
        )}
      </div>
    );
  }
