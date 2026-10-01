import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase() });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already subscribed!", description: "This email is already on our list." });
      } else {
        toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
      }
      return;
    }

    setSubscribed(true);
    setEmail("");
    toast({ title: "Subscribed! 🎉", description: "You'll receive our best deals and updates." });
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
        <CheckCircle className="h-4 w-4" />
        <span>Thanks for subscribing!</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pl-9 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50"
        />
      </div>
      <Button type="submit" disabled={loading} className="bg-white text-primary hover:bg-white/90 shrink-0">
        {loading ? "..." : "Subscribe"}
      </Button>
    </form>
  );
}
