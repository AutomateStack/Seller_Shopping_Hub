import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package, Store, ShoppingCart, ChevronLeft, ChevronRight, X, Star, Loader2, ZoomIn, Minus, Plus, Truck, ShieldCheck } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const db = supabase as any;
const MARKETPLACE_CART_KEY = "shophub-marketplace-cart-v1";

function Stars({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (rating: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role={interactive ? "radiogroup" : "img"} aria-label={interactive ? "Choose a rating" : `${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(value)}
          onMouseEnter={() => interactive && setHover(value)}
          onMouseLeave={() => interactive && setHover(0)}
          onFocus={() => interactive && setHover(value)}
          onBlur={() => interactive && setHover(0)}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          aria-checked={interactive ? rating === value : undefined}
          role={interactive ? "radio" : undefined}
          className={interactive ? "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "cursor-default"}
        >
          <Star className={`h-5 w-5 ${value <= (interactive ? hover || rating : Math.round(rating)) ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

export default function SellerMarketplaceProduct() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["seller-marketplace-product", id],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").from("products")
        .select("id,title,description,category,brand,price,mrp,stock_quantity,image_urls,sku,seller_id")
        .eq("id", id).eq("status", "approved").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: store } = useQuery({
    queryKey: ["seller-store-for-product", product?.seller_id],
    queryFn: async () => {
      const { data, error } = await db.schema("seller").from("seller_profiles")
        .select("id,store_name,business_name,contact_name,profile_photo_url")
        .eq("id", product.seller_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!product?.seller_id,
  });

  const images: string[] = (product?.image_urls || []).filter((url: unknown): url is string => typeof url === "string" && !!url.trim());
  const descriptionLines = String(product?.description || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  useEffect(() => {
    setSelectedImageIndex(0);
    setLightboxOpen(false);
    setQuantity(1);
  }, [id]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft" && images.length > 1) setSelectedImageIndex((index) => (index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight" && images.length > 1) setSelectedImageIndex((index) => (index + 1) % images.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, images.length]);

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["marketplace-product-reviews", id],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").from("marketplace_product_reviews")
        .select("id,rating,comment,reviewer_name,created_at")
        .eq("product_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: canReview = false, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["marketplace-product-review-eligibility", id, user?.id],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").rpc("can_review_marketplace_product", { p_product_id: id });
      if (error) throw error;
      return data === true;
    },
    enabled: !!id && !!user,
  });

  const { data: ownReview } = useQuery({
    queryKey: ["marketplace-product-own-review", id, user?.id],
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").from("marketplace_product_reviews")
        .select("id,rating,comment,created_at").eq("product_id", id).eq("buyer_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to submit a review.");
      const { error } = await db.schema("catalog").rpc("submit_marketplace_product_review", {
        p_product_id: id,
        p_rating: newRating,
        p_comment: newComment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNewComment("");
      setNewRating(5);
      toast({ title: "Review submitted", description: "Thank you for sharing your experience." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-reviews", id] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-review-eligibility", id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-product-own-review", id, user?.id] }),
      ]);
    },
    onError: (submitError: any) => toast({
      title: "Could not submit review",
      description: submitError?.message || "Please try again.",
      variant: "destructive",
    }),
  });

  const addToCart = () => {
    if (!product || product.stock_quantity < 1) return;
    let cart: any[] = [];
    try { cart = JSON.parse(localStorage.getItem(MARKETPLACE_CART_KEY) || "[]"); } catch { cart = []; }
    const existing = cart.find((item: any) => item.product_id === product.id);
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else cart.push({ product_id: product.id, quantity });
    localStorage.setItem(MARKETPLACE_CART_KEY, JSON.stringify(cart));
    window.location.assign("/marketplace/cart");
  };

  const averageRating = reviews.length ? reviews.reduce((sum: number, review: any) => sum + Number(review.rating), 0) / reviews.length : 0;
  const savings = product?.mrp && Number(product.mrp) > Number(product.price) ? Number(product.mrp) - Number(product.price) : 0;
  const savingsPercent = savings > 0 ? Math.round((savings / Number(product.mrp)) * 100) : 0;
  const previousImage = () => setSelectedImageIndex((index) => (index - 1 + images.length) % images.length);
  const nextImage = () => setSelectedImageIndex((index) => (index + 1) % images.length);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={product ? product.title + " | ShopHub" : "Marketplace product | ShopHub"} description={product?.description || "Explore seller products on ShopHub."} />
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <Button variant="ghost" asChild className="mb-5"><Link to="/products"><ArrowLeft className="mr-2 h-4 w-4" />Back to products</Link></Button>
        {isLoading ? <div className="py-20 text-center">Loading product…</div> :
          error ? <Card><CardContent className="p-8 text-center text-destructive">Could not load this product. Please try again.</CardContent></Card> :
          !product ? <Card><CardContent className="p-12 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-bold">Product not found</h1><p className="my-3 text-muted-foreground">This listing may no longer be approved or available.</p><Button asChild><Link to="/products">Browse products</Link></Button></CardContent></Card> :
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="space-y-3 lg:sticky lg:top-24">
              {images.length ? <>
                <div className="group relative overflow-hidden rounded-2xl border bg-white">
                  <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`View ${product.title} image full size`}>
                    <img src={images[selectedImageIndex]} alt={product.title + " photo " + (selectedImageIndex + 1)} className="aspect-square w-full object-contain p-2 sm:p-4" />
                  </button>
                  <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1.5 text-xs text-foreground shadow-sm"><ZoomIn className="mr-1 inline h-3.5 w-3.5" />Click to enlarge</div>
                  {images.length > 1 && <>
                    <Badge className="absolute left-3 top-3">{selectedImageIndex + 1} / {images.length}</Badge>
                    <button type="button" onClick={previousImage} aria-label="Previous image" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background"><ChevronLeft className="h-5 w-5" /></button>
                    <button type="button" onClick={nextImage} aria-label="Next image" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background"><ChevronRight className="h-5 w-5" /></button>
                  </>}
                </div>
                {images.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, index) => <button key={url + index} type="button" onClick={() => setSelectedImageIndex(index)} aria-label={`Show product image ${index + 1}`} aria-pressed={selectedImageIndex === index} className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${selectedImageIndex === index ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                    <img src={url} alt={product.title + " thumbnail " + (index + 1)} className="h-full w-full object-cover" />
                  </button>)}
                </div>}
              </> : <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted"><Package className="h-16 w-16 text-muted-foreground" /></div>}
            </div>
            <div className="space-y-4">
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{product.title}</h1>
              <p className="text-sm text-muted-foreground">{product.brand ? "Brand: " + product.brand : ""}{product.brand && product.category ? " · " : ""}{product.category || ""}</p>
              <a href="#marketplace-reviews-heading" className="inline-flex flex-wrap items-center gap-2 text-sm hover:underline">
                {reviews.length > 0 ? <><span className="font-semibold">{averageRating.toFixed(1)}</span><Stars rating={averageRating} /><span className="text-primary">{reviews.length} review{reviews.length === 1 ? "" : "s"}</span></> : <><Stars rating={0} /><span className="text-primary">Be the first to review</span></>}
              </a>
              <Card className="border-border shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">₹{Number(product.price).toFixed(2)}</span>{savings > 0 && <span className="text-base text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}{savingsPercent > 0 && <Badge className="bg-emerald-600 hover:bg-emerald-600">{savingsPercent}% off</Badge>}</div>
                  {savings > 0 && <p className="mt-1 text-sm font-medium text-emerald-700">You save ₹{savings.toFixed(2)}</p>}
                  <p className={`mt-3 flex items-center gap-2 text-sm font-medium ${product.stock_quantity > 0 ? "text-emerald-700" : "text-destructive"}`}><span className={`h-2 w-2 rounded-full ${product.stock_quantity > 0 ? "bg-emerald-500" : "bg-destructive"}`} />{product.stock_quantity > 0 ? "In stock" : "Currently unavailable"}{product.stock_quantity > 0 && <span className="font-normal text-muted-foreground">({product.stock_quantity} available)</span>}</p>
                </div>
                <div className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2"><div className="flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Delivery</p><p className="text-muted-foreground">Options confirmed at checkout</p></div></div><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Secure ordering</p><p className="text-muted-foreground">Stock is checked again at checkout</p></div></div></div>
              
              <Link to={product.seller_id ? `/store/${product.seller_id}` : "/products"} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Card className="transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-3 p-4">{store?.profile_photo_url ? <img src={store.profile_photo_url} alt="" className="h-12 w-12 rounded-full border object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="truncate font-medium">{store?.business_name || store?.store_name || store?.contact_name || "Seller shop"}</p><p className="text-sm text-muted-foreground">Seller · View shop and products</p></div><span className="shrink-0 text-xs font-medium text-primary">View shop</span></CardContent></Card>
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="marketplace-product-quantity" className="text-sm font-medium">Quantity</label>
                <div className="flex h-10 items-center rounded-md border">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus className="h-4 w-4" /></Button>
                  <input id="marketplace-product-quantity" type="number" min={1} max={Math.min(99, product.stock_quantity)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(Math.min(99, product.stock_quantity || 1), Number(event.target.value) || 1)))} className="h-9 w-12 border-x bg-transparent text-center text-sm [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Increase quantity" disabled={quantity >= Math.min(99, product.stock_quantity)} onClick={() => setQuantity((current) => Math.min(Math.min(99, product.stock_quantity), current + 1))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <Button className="w-full" size="lg" disabled={product.stock_quantity < 1} onClick={addToCart}><ShoppingCart className="mr-2 h-4 w-4" />{product.stock_quantity > 0 ? "Add to cart" : "Out of stock"}</Button>
              <p className="text-center text-xs text-muted-foreground">Cash on Delivery is available for marketplace testing. Final stock is validated at checkout.</p>
              </CardContent></Card>
              <div className="border-t pt-4"><h2 className="mb-3 font-semibold">Product details</h2>{descriptionLines.length ? <div className="space-y-2 text-sm leading-6 text-foreground">{descriptionLines.map((line, index) => { const bullet = line.match(/^([-*•▪]|\d+[.)])\s+(.+)$/); return bullet ? <div key={index} className="flex items-start gap-2"><span className="mt-0.5 text-primary" aria-hidden="true">•</span><p>{bullet[2]}</p></div> : <p key={index}>{line}</p>; })}</div> : <p className="text-sm text-muted-foreground">The seller has not added a product description yet.</p>}<dl className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">{product.category && <div><dt className="text-muted-foreground">Category</dt><dd className="font-medium">{product.category}</dd></div>}{product.brand && <div><dt className="text-muted-foreground">Brand</dt><dd className="font-medium">{product.brand}</dd></div>}{product.sku && <div><dt className="text-muted-foreground">Seller SKU</dt><dd className="font-medium">{product.sku}</dd></div>}<div><dt className="text-muted-foreground">Availability</dt><dd className="font-medium">{product.stock_quantity > 0 ? "In stock" : "Out of stock"}</dd></div></dl></div>
            </div>
          </div>
        }

        {product && !error && <section className="mt-14 border-t pt-8" aria-labelledby="marketplace-reviews-heading">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="marketplace-reviews-heading" className="text-2xl font-bold">Ratings &amp; reviews</h2>
              <p className="mt-1 text-sm text-muted-foreground">Reviews are available to customers after their order is delivered.</p>
              {reviews.length > 0 && <div className="mt-2 flex items-center gap-2"><Stars rating={averageRating} /><span className="text-sm text-muted-foreground">{averageRating.toFixed(1)} out of 5 ({reviews.length} review{reviews.length === 1 ? "" : "s"})</span></div>}
            </div>
            {!user ? <Button variant="outline" asChild><Link to="/auth">Sign in to review</Link></Button> :
              ownReview ? <Badge variant="secondary">You reviewed this product</Badge> :
              canReview ? <Badge variant="secondary">Verified purchase eligible</Badge> : null}
          </div>

          {user && canReview && !ownReview && <Card className="mb-6"><CardContent className="space-y-4 p-4">
            <div><p className="mb-2 text-sm font-medium">Your rating</p><Stars rating={newRating} interactive onChange={setNewRating} /><p className="mt-1 text-xs text-muted-foreground">{newRating} out of 5 stars</p></div>
            <div><label htmlFor="marketplace-review-comment" className="mb-1.5 block text-sm font-medium">Your review (optional)</label><Textarea id="marketplace-review-comment" value={newComment} onChange={(event) => setNewComment(event.target.value)} maxLength={2000} rows={4} placeholder="How was the product? Share your experience…" /></div>
            <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending || eligibilityLoading}>{submitReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit review</Button>
          </CardContent></Card>}

          {user && !ownReview && !canReview && !eligibilityLoading && <p className="mb-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">You can leave a review after this product has been delivered to you.</p>}
          {ownReview && <Card className="mb-6"><CardContent className="p-4"><p className="font-medium">Your review</p><div className="mt-2"><Stars rating={ownReview.rating} /></div>{ownReview.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ownReview.comment}</p>}</CardContent></Card>}

          {reviewsLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Loading reviews…</div> :
            reviews.length ? <div className="space-y-3">{reviews.map((review: any) => <Card key={review.id}><CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{review.reviewer_name || "Customer"}</p><div className="mt-1 flex items-center gap-2"><Stars rating={Number(review.rating)} /><Badge variant="outline">Verified purchase</Badge></div></div><time className="text-xs text-muted-foreground" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time></div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{review.comment}</p>}
            </CardContent></Card>)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No reviews yet. Once customers receive this product, they can share a rating and review.</p>}
        </section>}
      </main>
      <Footer />

      {lightboxOpen && images.length > 0 && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={product?.title + " image viewer"} onClick={() => setLightboxOpen(false)}>
        <button type="button" onClick={() => setLightboxOpen(false)} aria-label="Close image viewer" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><X className="h-6 w-6" /></button>
        {images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); previousImage(); }} aria-label="Previous image" className="absolute left-3 sm:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronLeft className="h-6 w-6" /></button>}
        <img src={images[selectedImageIndex]} alt={product?.title + " photo " + (selectedImageIndex + 1)} className="max-h-[88vh] max-w-[88vw] select-none object-contain" onClick={(event) => event.stopPropagation()} />
        {images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); nextImage(); }} aria-label="Next image" className="absolute right-3 sm:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronRight className="h-6 w-6" /></button>}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{selectedImageIndex + 1} / {images.length} · Use ← → to browse, Esc to close</div>
      </div>}
    </div>
  );
}
