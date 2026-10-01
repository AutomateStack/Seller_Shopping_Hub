import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "shophub_exit_intent_shown";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_SESSION_MS = 15_000; // don't fire for users who just landed
const COUPON = "WELCOME10";

/**
 * Desktop-only exit-intent modal. Triggers once per 7-day window the first
 * time the user's pointer leaves the top of the viewport after spending at
 * least MIN_SESSION_MS on the page. Mobile users are left alone (no reliable
 * signal). Suppressed on cart/checkout/auth pages where it would be noise.
 */
export function ExitIntentOffer() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (/^\/(cart|checkout|auth|admin|order-confirmation)/.test(path)) return;

    // Cooldown
    try {
      const last = Number(localStorage.getItem(STORAGE_KEY) || "0");
      if (last && Date.now() - last < COOLDOWN_MS) return;
    } catch { /* ignore */ }

    // Skip touch / coarse-pointer devices
    if (window.matchMedia?.("(pointer: coarse)").matches) return;

    const startedAt = Date.now();
    let armed = false;
    const armTimer = window.setTimeout(() => { armed = true; }, MIN_SESSION_MS);

    const onLeave = (e: MouseEvent) => {
      if (!armed) return;
      // Only trigger when the pointer exits the top of the document
      if (e.clientY > 0) return;
      if (Date.now() - startedAt < MIN_SESSION_MS) return;
      setOpen(true);
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => {
      clearTimeout(armTimer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
      setCopied(true);
      toast({ title: "Code copied!", description: `${COUPON} is in your clipboard.` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: `Use code ${COUPON} at checkout.`, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-2xl">Wait — here's 10% off</DialogTitle>
          <DialogDescription className="text-center">
            Don't leave empty-handed. Use the code below for an instant discount on your first order.
          </DialogDescription>
        </DialogHeader>
        <div className="my-2 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4">
          <span className="font-mono text-2xl font-bold tracking-widest text-primary">{COUPON}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={copyCode}
            aria-label="Copy coupon code"
            className="h-9 w-9"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Maybe later</Button>
          <Button asChild onClick={() => setOpen(false)}>
            {/* Plain anchor — this component lives outside the Router */}
            <a href="/products">Shop now</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}