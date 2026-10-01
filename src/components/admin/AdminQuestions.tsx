import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Search, MessageCircleQuestion } from "lucide-react";

type Row = {
  id: string;
  product_id: string;
  asker_name: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  is_published: boolean;
  created_at: string;
  products?: { name: string } | null;
};

export function AdminQuestions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"unanswered" | "answered" | "all">("unanswered");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-product-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_questions")
        .select("id, product_id, asker_name, question, answer, answered_at, is_published, created_at, products:product_id(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-product-questions"] });
    qc.invalidateQueries({ queryKey: ["product-questions"] });
  };

  const answer = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase
        .from("product_questions")
        .update({ answer: text.trim(), answered_at: new Date().toISOString(), is_published: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      setDrafts((p) => ({ ...p, [v.id]: "" }));
      invalidate();
      toast({ title: "Answer published", description: "It is now visible on the product page." });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("product_questions").update({ is_published: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Question deleted" });
    },
    onError: (e: Error) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => {
    const byFilter =
      filter === "all" ? true : filter === "answered" ? !!r.answer : !r.answer;
    const bySearch =
      !q ||
      r.question.toLowerCase().includes(q) ||
      r.asker_name.toLowerCase().includes(q) ||
      (r.products?.name || "").toLowerCase().includes(q);
    return byFilter && bySearch;
  });

  const unansweredCount = rows.filter((r) => !r.answer).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Q&amp;A</h1>
        <p className="text-muted-foreground">
          Answer shopper questions — published answers appear on the product page.
          {unansweredCount > 0 && ` ${unansweredCount} waiting.`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
            <TabsTrigger value="answered">Answered</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question, product or shopper"
            className="pl-9"
            aria-label="Search questions"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading questions…</p>}

      {!isLoading && visible.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <MessageCircleQuestion className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nothing here right now.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visible.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">Q. {r.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.products?.name || "Product"} · {r.asker_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={r.answer ? "secondary" : "outline"}>{r.answer ? "Answered" : "Pending"}</Badge>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Published
                    <Switch
                      checked={r.is_published}
                      onCheckedChange={(v) => togglePublish.mutate({ id: r.id, value: v })}
                      aria-label="Toggle published"
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label="Delete question"
                    onClick={() => remove.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={drafts[r.id] ?? r.answer ?? ""}
                onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                placeholder="Write a clear, helpful answer…"
                rows={3}
                maxLength={1000}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="min-h-11"
                  disabled={(drafts[r.id] ?? r.answer ?? "").trim().length < 3 || answer.isPending}
                  onClick={() => answer.mutate({ id: r.id, text: drafts[r.id] ?? r.answer ?? "" })}
                >
                  {answer.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {r.answer ? "Update answer" : "Publish answer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
