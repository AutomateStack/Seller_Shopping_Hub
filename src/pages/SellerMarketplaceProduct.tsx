import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Store, ShoppingCart } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const db = supabase as any;
const MARKETPLACE_CART_KEY = "shophub-marketplace-cart-v1";
export default function SellerMarketplaceProduct() {
  const { id } = useParams<{id:string}>();
  const {data:product,isLoading,error}=useQuery({
    queryKey:["seller-marketplace-product",id],
    queryFn:async()=>{
      const {data,error}=await db.schema("catalog").from("products").select("id,title,description,category,brand,price,mrp,stock_quantity,image_urls,sku,seller_id").eq("id",id).eq("status","approved").maybeSingle();
      if(error) throw error;
      return data;
    },
    enabled:!!id,
  });
  const {data:store}=useQuery({
    queryKey:["seller-store-for-product",product?.seller_id],
    queryFn:async()=>{
      const {data,error}=await db.schema("seller").from("seller_profiles").select("store_name,store_slug").eq("id",product.seller_id).maybeSingle();
      if(error) throw error;
      return data;
    },
    enabled:!!product?.seller_id,
  });
  const addToCart = () => { if (!product || product.stock_quantity < 1) return; let cart: any[] = []; try { cart = JSON.parse(localStorage.getItem(MARKETPLACE_CART_KEY) || "[]"); } catch { cart = []; } const existing = cart.find((item: any) => item.product_id === product.id); if (existing) existing.quantity = Math.min(99, existing.quantity + 1); else cart.push({ product_id: product.id, quantity: 1 }); localStorage.setItem(MARKETPLACE_CART_KEY, JSON.stringify(cart)); window.location.assign("/marketplace/cart"); };
  return <div className="min-h-screen bg-background"><SEOHead title={product?product.title+" | ShopHub":"Marketplace product | ShopHub"} description={product?.description||"Explore seller products on ShopHub."}/><Navbar/><main className="container mx-auto max-w-6xl px-4 py-8">
    <Button variant="ghost" asChild className="mb-5"><Link to="/products"><ArrowLeft className="mr-2 h-4 w-4"/>Back to products</Link></Button>
    {isLoading?<div className="py-20 text-center">Loading product…</div>:error?<Card><CardContent className="p-8 text-center text-destructive">Could not load this product. Please try again.</CardContent></Card>:!product?<Card><CardContent className="p-12 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><h1 className="text-xl font-bold">Product not found</h1><p className="my-3 text-muted-foreground">This listing may no longer be approved or available.</p><Button asChild><Link to="/products">Browse products</Link></Button></CardContent></Card>:<div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">{product.image_urls?.length?<><img src={product.image_urls[0]} alt={product.title} className="aspect-square w-full rounded-2xl border object-contain bg-white"/>{product.image_urls.length>1&&<div className="grid grid-cols-4 gap-2">{product.image_urls.slice(1).map((url:string,i:number)=><img key={url} src={url} alt={product.title+" photo "+(i+2)} className="aspect-square w-full rounded-lg border object-cover"/>)}</div>}</>:<div className="flex aspect-square items-center justify-center rounded-2xl bg-muted"><Package className="h-16 w-16 text-muted-foreground"/></div>}</div>
      <div className="space-y-4"><Badge variant="secondary">Approved seller listing</Badge><h1 className="text-3xl font-bold">{product.title}</h1><p className="text-muted-foreground">{product.category}{product.brand?" · "+product.brand:""}</p><div className="flex items-baseline gap-3"><span className="text-3xl font-bold text-primary">₹{Number(product.price).toFixed(2)}</span>{product.mrp&&Number(product.mrp)>Number(product.price)&&<span className="text-lg text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}</div><p className="text-sm text-muted-foreground">{product.stock_quantity>0?"In stock":"Out of stock"} · {product.stock_quantity} available</p><div className="border-t pt-4"><h2 className="mb-2 font-semibold">Product details</h2><p className="whitespace-pre-wrap leading-7">{product.description||"No description provided."}</p>{product.sku&&<p className="mt-3 text-sm text-muted-foreground">Seller SKU: {product.sku}</p>}</div><Card><CardContent className="flex items-center gap-3 p-4"><Store className="h-5 w-5 text-primary"/><div><p className="font-medium">{store?.store_name||"ShopHub marketplace seller"}</p><p className="text-sm text-muted-foreground">Seller listing</p></div></CardContent></Card><Button className="w-full" disabled={product.stock_quantity < 1} onClick={addToCart}><ShoppingCart className="mr-2 h-4 w-4"/>{product.stock_quantity > 0 ? "Add to cart" : "Out of stock"}</Button><p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Cash on Delivery is available for marketplace testing. Stock is validated again when you place your order.</p></div>
    </div>}
  </main><Footer/></div>;
}