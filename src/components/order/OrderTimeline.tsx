import { Check, Clock, Package, Truck, MapPin, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ORDER_STEPS = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
];

const statusOrder = ["pending", "processing", "shipped", "delivered"];

interface OrderTimelineProps {
  status: string;
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-destructive py-4">
        <XCircle className="h-5 w-5" />
        <span className="font-medium text-sm">Order Cancelled</span>
      </div>
    );
  }

  const currentIndex = statusOrder.indexOf(status);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIndex / (ORDER_STEPS.length - 1)) * 100)}%`, maxWidth: "calc(100% - 40px)" }}
        />

        {ORDER_STEPS.map((step, i) => {
          const isComplete = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const StepIcon = isComplete && !isCurrent ? Check : step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isComplete
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-background border-muted-foreground/30 text-muted-foreground"
                )}
              >
                <StepIcon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium text-center whitespace-nowrap",
                  isComplete ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
