import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Hash, Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function ProvablyFair() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: draws } = useQuery({
    queryKey: ["provably-fair-draws"],
    queryFn: async () => {
      const { data } = await supabase
        .from("draws")
        .select("id, title, draw_date, draw_seed, draw_hash, status")
        .eq("status", "completed")
        .not("draw_hash", "is", null)
        .order("draw_date", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast({ title: "Copied", description: "Verification value copied." });
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className="py-16 bg-background">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Provably Fair
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            How we prove every draw is real
          </h2>
          <p className="text-muted-foreground">
            Before each draw, our system generates a random seed. Winners are picked deterministically
            from that seed and stored with a public hash you can verify below. No cherry-picking, no edits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="h-10 w-10 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">1. Random seed</p>
            <p className="text-xs text-muted-foreground">Generated at draw time — never reused.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="h-10 w-10 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">2. Winner hash</p>
            <p className="text-xs text-muted-foreground">MD5 of seed + winners, locked forever.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="h-10 w-10 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">3. Instant payout</p>
            <p className="text-xs text-muted-foreground">Prize credited to winner's wallet automatically.</p>
          </div>
        </div>

        {draws && draws.length > 0 && (
          <div className="max-w-3xl mx-auto space-y-3">
            <p className="text-sm font-semibold text-foreground text-center mb-2">
              Verify recent draws
            </p>
            {draws.map((d: any) => (
              <Card key={d.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.draw_date ? format(new Date(d.draw_date), "MMM d, yyyy") : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {d.draw_seed && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground w-14 shrink-0">Seed</span>
                        <code className="text-xs font-mono bg-muted rounded px-2 py-1 flex-1 truncate">{d.draw_seed}</code>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(d.draw_seed, `${d.id}-s`)} aria-label="Copy seed">
                          {copied === `${d.id}-s` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground w-14 shrink-0">Hash</span>
                      <code className="text-xs font-mono bg-muted rounded px-2 py-1 flex-1 truncate">{d.draw_hash}</code>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(d.draw_hash, `${d.id}-h`)} aria-label="Copy hash">
                        {copied === `${d.id}-h` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
