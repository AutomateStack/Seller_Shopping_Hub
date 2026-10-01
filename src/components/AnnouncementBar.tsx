import { useState } from "react";
import { X, Gift, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(() => {
    return sessionStorage.getItem("shophub_bar_dismissed") !== "1";
  });

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground text-sm overflow-hidden animate-fade-in">
      <div className="container px-4 py-2 flex items-center justify-center gap-3 relative">
        <Gift className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
        <span className="text-center">
          🎉 Join our <strong>Weekly Lucky Draw</strong> — Free entry + win up to ₹5,000!
        </span>
        <Link
          to="/lucky-draw"
          className="hidden sm:inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap"
        >
          Enter Now <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          onClick={() => {
            setVisible(false);
            sessionStorage.setItem("shophub_bar_dismissed", "1");
          }}
          className="absolute right-4 p-1 hover:bg-primary-foreground/10 rounded transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
