import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

function RatingStars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="flex items-center gap-1" role="radiogroup" aria-label="Choose product rating">
    {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => onChange(star)} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Star className={`h-6 w-6 ${star <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"}`} />
    </button>)}
  </div>;
}

export function MarketplaceOrderItemActions({ productId, orderStatus, productTitle }: { productId: string | null; orderStatus: string; productTitle: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const { data: canReview = false, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["marketplace-product-review-eligibility", productId, userId],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").rpc("can_review_marketplace_product", { p_product_id: productId });
      if (error) throw error;
      return data === true;
    },
    enabled: !!productId && !!userId && orderStatus === "delivered",
  });

  const { data: ownReview, isLoading: ownReviewLoading } = useQuery({
    queryKey: ["marketplace-product-own-review", productId, userId],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").from("marketplace_product_reviews")
        .select("id,rating,comment,created_at").eq("product_id", productId).eq("buyer_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!userId && orderStatus === "delivered",
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const { error } = await db.schema("catalog").rpc("submit_marketplace_product_review", {
        p_product_id: productId, p_rating: rating, p_comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setFormOpen(false);
      setComment("");
      toast({ title: "Review submitted", description: "Thank you for reviewing this product." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-review-eligibility", productId, userId] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-own-review", productId, userId] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-reviews", productId] }),
      ]);
    },
    onError: (error: any) => toast({ title: "Could not submit review", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  if (!productId) return <span className="text-xs text-muted-foreground">Product listing unavailable</span>;

  return <div className="mt-2 flex flex-wrap items-center gap-2">
    {orderStatus === "delivered" && userId && !eligibilityLoading && !ownReviewLoading && ownReview &&
      <Badge variant="secondary">Rated {ownReview.rating}/5 <Star className="ml-1 h-3 w-3 fill-amber-400 text-amber-500" /></Badge>}
    {orderStatus === "delivered" && userId && !eligibilityLoading && !ownReviewLoading && canReview && !ownReview &&
      <Button size="sm" variant="outline" onClick={() => setFormOpen((open) => !open)}>{formOpen ? "Cancel review" : "Rate & review"}</Button>}
    {orderStatus === "delivered" && userId && !eligibilityLoading && !ownReviewLoading && !canReview && !ownReview &&
      <span className="text-xs text-muted-foreground">Review already submitted or purchase not eligible</span>}
    {!userId && orderStatus === "delivered" && <Button size="sm" variant="link" asChild className="h-auto p-0"><Link to="/auth">Sign in to review</Link></Button>}
    {formOpen && canReview && !ownReview && <Card className="mt-2 w-full"><CardContent className="space-y-3 p-3">
      <p className="text-sm font-semibold">Rate {productTitle}</p>
      <div><RatingStars value={rating} onChange={setRating} /><p className="mt-1 text-xs text-muted-foreground">{rating} out of 5 stars</p></div>
      <Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} placeholder="Share your experience (optional)" aria-label={`Review for ${productTitle}`} />
      <Button size="sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>{submitReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit review</Button>
    </CardContent></Card>}
  </div>;
}
