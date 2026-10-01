import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BackInStockNotifyProps {
  productId: string;
}

export function BackInStockNotify({ productId }: BackInStockNotifyProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("stock_notifications" as any).insert({
        product_id: productId,
        email,
        user_id: session?.user?.id || null,
      } as any);

      if (error) throw error;

      setSubscribed(true);
      toast({ title: "You're on the list!", description: "We'll email you when this product is back in stock." });
    } catch {
      toast({ title: "Error", description: "Could not subscribe. Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-400">We'll notify you when this is back in stock!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Bell className="h-4 w-4 text-primary" />
        Get notified when back in stock
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={loading} className="shrink-0">
          {loading ? "..." : "Notify Me"}
        </Button>
      </div>
    </form>
  );
}
