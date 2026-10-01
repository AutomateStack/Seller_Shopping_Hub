import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

interface QuizTimerProps {
  duration: number; // seconds per question
  onTimeUp: () => void;
  isPaused: boolean;
  questionIndex: number;
}

export function QuizTimer({ duration, onTimeUp, isPaused, questionIndex }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [questionIndex, duration]);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, timeLeft, onTimeUp]);

  const progress = (timeLeft / duration) * 100;
  const isLow = timeLeft <= 5;

  return (
    <div className="flex items-center gap-2">
      <Timer className={`h-4 w-4 ${isLow ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isLow ? "bg-destructive" : progress > 50 ? "bg-primary" : "bg-secondary"
          }`}
          initial={{ width: "100%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span
        className={`text-sm font-bold tabular-nums min-w-[28px] text-right ${
          isLow ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {timeLeft}s
      </span>
    </div>
  );
}
