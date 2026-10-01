import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Gift, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "shophub_newsletter_popup_shown";
const SCROLL_THRESHOLD = 0.4; // 40% scroll depth

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const handleScroll = () => {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight > 0 && scrollTop / scrollHeight >= SCROLL_THRESHOLD) {
        setOpen(true);
        window.removeEventListener("scroll", handleScroll);
      }
    };

    // Exit-intent: trigger when mouse leaves toward top of viewport (desktop only)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && window.innerWidth >= 768) {
        setOpen(true);
        document.removeEventListener("mouseleave", handleMouseLeave);
      }
    };

    // Defer scroll listener registration until idle to keep startup fast
    const w = window as any;
    let idleId: any;
    const register = () => {
      window.addEventListener("scroll", handleScroll, { passive: true });
      document.addEventListener("mouseleave", handleMouseLeave);
    };
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(register, { timeout: 3000 });
    } else {
      idleId = setTimeout(register, 1500);
    }

    // Fallback for non-scrolling visits
    const timer = setTimeout(() => {
      setOpen(true);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mouseleave", handleMouseLeave);
    }, 45000);

    return () => {
      clearTimeout(timer);
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase() });
    setLoading(false);

    if (error?.code === "23505") {
      toast({ title: "Already subscribed!", description: "You're already on our list." });
    } else if (error) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      return;
    } else {
      toast({ title: "Welcome! 🎉", description: "You'll receive our best deals & updates." });
    }

    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">Get 10% Off Your First Order!</DialogTitle>
          </div>
          <DialogDescription>
            Subscribe to our newsletter for exclusive deals, new arrivals, and shopping tips delivered straight to your inbox.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              required
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Subscribing..." : "Subscribe & Get 10% Off"}
          </Button>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            No thanks, I'll pay full price
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
