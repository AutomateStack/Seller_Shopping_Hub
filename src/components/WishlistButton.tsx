import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/use-wishlist";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface WishlistButtonProps {
  productId: string;
  size?: "sm" | "default";
  className?: string;
}

export function WishlistButton({ productId, size = "sm", className }: WishlistButtonProps) {
  const { toggle, isInWishlist, isLoggedIn } = useWishlist();
  const navigate = useNavigate();
  const { toast } = useToast();
  const active = isInWishlist(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      toast({ title: "Sign in required", description: "Please sign in to save items to your wishlist." });
      navigate("/auth");
      return;
    }
    toggle(productId);
    toast({
      title: active ? "Removed from wishlist" : "Added to wishlist",
      description: active ? "Item removed from your saved items." : "Item saved for later!",
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm",
        className
      )}
      onClick={handleClick}
    >
      <Heart
        aria-hidden="true"
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "fill-destructive text-destructive" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
