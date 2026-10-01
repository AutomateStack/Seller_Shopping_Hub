import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircleQuestion, CheckCircle2, Loader2 } from "lucide-react";

export function ProductQA({ productId }: { productId: string }) {
  const [question, setQuestion] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["product-questions", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_questions")
        .select("id, asker_name, question, answer, answered_at, created_at")
        .eq("product_id", productId)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to ask a question.");
      const { error } = await supabase.from("product_questions").insert({
        product_id: productId,
        user_id: user.id,
        asker_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Customer",
        question: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["product-questions", productId] });
      toast({ title: "Question submitted", description: "We'll answer it shortly and publish it here." });
    },
    onError: (e: Error) => toast({ title: "Could not submit", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <label htmlFor="product-question" className="text-sm font-medium flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" aria-hidden="true" />
          Ask about this product
        </label>
        <Textarea
          id="product-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Is this suitable for daily use? What is in the box?"
          maxLength={500}
          rows={3}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{question.length}/500 · Answered by our team, usually within a day.</p>
          <Button
            size="sm"
            disabled={question.trim().length < 5 || ask.isPending}
            onClick={() => ask.mutate(question)}
            className="min-h-11"
          >
            {ask.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Submit question
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading questions…</p>}

      {!isLoading && questions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No questions yet. Be the first to ask — your answer helps every other shopper too.
        </p>
      )}

      <ul className="space-y-4">
        {questions.map((q) => (
          <li key={q.id} className="rounded-xl border border-border p-4">
            <p className="font-medium text-sm">Q. {q.question}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Asked by {q.asker_name} · {new Date(q.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </p>
            {q.answer && (
              <div className="mt-3 pl-3 border-l-2 border-primary/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Seller answer
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{q.answer}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
