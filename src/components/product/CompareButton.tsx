import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocalList } from "@/hooks/use-local-list";
import { toast } from "sonner";

interface Props {
  productId: string;
  className?: string;
  withLabel?: boolean;
}

const COMPARE_KEY = "shophub_compare_v1";
const MAX_COMPARE = 4;

export function CompareButton({ productId, className, withLabel = false }: Props) {
  const { items, add, remove, has } = useLocalList(COMPARE_KEY, MAX_COMPARE);
  const active = has(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) {
      remove(productId);
      toast("Removed from compare");
      return;
    }
    if (items.length >= MAX_COMPARE) {
      toast.error(`You can compare up to ${MAX_COMPARE} products`);
      return;
    }
    add(productId);
    toast.success("Added to compare", { description: "Open the compare drawer at the bottom of the screen." });
  };

  if (withLabel) {
    return (
      <Button
        type="button"
        variant={active ? "secondary" : "outline"}
        size="sm"
        onClick={handleClick}
        className={cn("gap-1.5", className)}
        aria-label={active ? "Remove from compare" : "Add to compare"}
      >
        <GitCompare aria-hidden="true" className="h-3.5 w-3.5" />
        {active ? "In compare" : "Compare"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={active ? "Remove from compare" : "Add to compare"}
      onClick={handleClick}
      className={cn(
        "h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm",
        active && "text-primary",
        className
      )}
    >
      <GitCompare aria-hidden="true" className="h-4 w-4" />
    </Button>
  );
}