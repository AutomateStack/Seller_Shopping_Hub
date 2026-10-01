import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Star, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ProductReviewsProps {
  productId: string;
}

function StarRating({
  rating,
  onChange,
  interactive = false,
}: {
  rating: number;
  onChange?: (r: number) => void;
  interactive?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 transition-colors ${
            star <= (interactive ? hover || rating : rating)
              ? "fill-secondary text-secondary"
              : "text-muted-foreground/30"
          } ${interactive ? "cursor-pointer" : ""}`}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
        />
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, product_id, rating, comment, reviewer_name, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      const name =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: user.id,
        reviewer_name: name,
        rating: newRating,
        comment: newComment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      setNewComment("");
      setNewRating(5);
      setShowForm(false);
      toast({ title: "Review submitted!" });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Customer Reviews</h2>
          {reviews && reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} out of 5 · {reviews.length} review
                {reviews.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        {user && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Write a Review
          </Button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Your Rating
              </label>
              <StarRating
                rating={newRating}
                onChange={setNewRating}
                interactive
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Comment (optional)
              </label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Review
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : reviews && reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {review.reviewer_name}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(review.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No reviews yet.{" "}
          {user
            ? "Be the first to review this product!"
            : "Log in to write a review."}
        </p>
      )}
    </section>
  );
}
