import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DrawCountdownProps {
  targetDate: string;
  variant?: "default" | "hero";
}

function AnimatedDigit({ value }: { value: string }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="inline-block"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export function DrawCountdown({ targetDate, variant = "default" }: DrawCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calcTime = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = Math.max(0, target - now);
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };
    setTimeLeft(calcTime());
    const timer = setInterval(() => setTimeLeft(calcTime()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const isHero = variant === "hero";
  const blocks = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins", value: timeLeft.minutes },
    { label: "Secs", value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-2">
      {blocks.map((block, i) => (
        <div key={block.label} className="flex items-center gap-2">
          <div className="text-center">
            <div
              className={`
                rounded-xl font-bold tabular-nums flex items-center justify-center
                ${isHero
                  ? "bg-white/10 backdrop-blur-md border border-white/20 text-primary-foreground px-3 py-2.5 text-2xl md:text-3xl min-w-[56px] shadow-lg"
                  : "bg-foreground/5 border border-border px-2.5 py-1.5 text-lg min-w-[44px]"
                }
              `}
            >
              <AnimatedDigit value={String(block.value).padStart(2, "0")} />
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider mt-1 block font-medium ${
                isHero ? "text-primary-foreground/60" : "text-muted-foreground"
              }`}
            >
              {block.label}
            </span>
          </div>
          {i < 3 && (
            <span
              className={`font-bold -mt-4 ${
                isHero ? "text-primary-foreground/40 text-xl" : "text-muted-foreground text-lg"
              }`}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
