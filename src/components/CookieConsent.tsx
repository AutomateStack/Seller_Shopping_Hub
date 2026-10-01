import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("shophub_cookie_consent");
    if (consent) return;
    // Defer until browser is idle to keep main thread free for LCP/TTI
    const show = () => setVisible(true);
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(show, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(show, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("shophub_cookie_consent", "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("shophub_cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 md:p-6 animate-slide-up">
      <div className="container max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-xl p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium mb-1">🍪 We use cookies</p>
          <p className="text-xs text-muted-foreground">
            We use cookies to enhance your browsing experience and analyze site traffic. 
            By clicking "Accept", you consent to our use of cookies.{" "}
            <a href="/terms" className="underline hover:text-primary" aria-label="Learn more about our cookie policy in Terms & Conditions">Learn more about our cookie policy</a>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDecline} className="h-8 w-8" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
