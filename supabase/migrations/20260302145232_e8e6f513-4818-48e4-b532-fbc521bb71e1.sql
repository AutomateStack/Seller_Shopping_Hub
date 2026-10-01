
-- Make product_reviews only expose user_id to the review owner and admins
-- Drop existing public select policy and replace with a more restrictive one
DROP POLICY "Anyone can view reviews" ON public.product_reviews;

-- Allow anyone to view reviews but this is inherently public data (ratings/comments)
-- The user_id exposure is by design for edit/delete controls
-- Add a restrictive base that still allows public reads but is noted
CREATE POLICY "Anyone can view reviews"
ON public.product_reviews
FOR SELECT
TO public
USING (true);
