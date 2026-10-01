import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary slot (e.g. a Link button). Rendered next to the action button. */
  secondary?: ReactNode;
  className?: string;
}

/**
 * Consistent empty-state block used across listing pages
 * (orders, wishlist, search, etc). Accessible (role="status").
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className ?? ""}`}
    >
      {Icon && (
        <div
          className="mb-4 h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center"
          aria-hidden="true"
        >
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-5">{description}</p>
      )}
      {(actionLabel || secondary) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button onClick={onAction} className="min-h-[44px]">
              {actionLabel}
            </Button>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
}