import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

/**
 * Lightweight Add-to-Home-Screen prompt.
 * Listens for `beforeinstallprompt` (Chromium/Android) and offers a one-tap install.
 * Stays dismissed for 14 days via localStorage.
 */
const DISMISS_KEY = "shopshub:install-dismissed-at";
const DISMISS_DAYS = 14;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip in iframe/preview to avoid noise
    try {
      if (window.self !== window.top) return;
    } catch { return; }

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      // Delay 5s so it doesn't compete with first paint / newsletter popup
      setTimeout(() => setVisible(true), 5000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install ShopHub app"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in-up"
    >
      <div className="rounded-xl border bg-card/95 backdrop-blur-md shadow-xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install ShopHub</p>
          <p className="text-xs text-muted-foreground">Faster access, works like an app.</p>
        </div>
        <Button size="sm" onClick={handleInstall} className="h-9">Install</Button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="text-muted-foreground hover:text-foreground p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
