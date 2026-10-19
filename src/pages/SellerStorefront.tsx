import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Search, Store, SlidersHorizontal } from "lucide-react";

const db = supabase as any;
type StoreProduct = { id:string; title:string; description:string; category:string; brand:string; price:number; mrp:number|null; stock_quantity:number; image_urls:string[] };

export default function SellerStorefront() {
  const { storeId } = useParams<{storeId:string}>();
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("all");
  const [minPrice,setMinPrice] = useState("");
  const [maxPrice,setMaxPrice] = useState("");
  const [sort,setSort] = useState("newest");
  const {data:store,isLoading:storeLoading,error:storeError} = useQuery({
    queryKey:["public-seller-store",storeId],
    queryFn:async()=>{
      const {data,error}=await db.schema("seller").from("public_seller_profiles")
        .select("id,store_name,business_name,profile_photo_url")
        .eq("id",storeId).maybeSingle();
      if(error) throw error;
      return data;
    },
    enabled:!!storeId,
  });
  const {data:products=[],isLoading:productsLoading,error:productsError} = useQuery<StoreProduct[]>({
    queryKey:["public-seller-store-products",storeId],
    queryFn:async()=>{
      const {data,error}=await db.schema("catalog").from("products")
        .select("id,title,description,category,brand,price,mrp,stock_quantity,image_urls")
        .eq("seller_id",storeId).eq("status","approved").order("created_at",{ascending:false});
      if(error) throw error;
      return (data??[]) as StoreProduct[];
    },
    enabled:!!storeId,
  });
  const categories = useMemo(()=>Array.from(new Set(products.map(p=>p.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[products]);
  const filtered = useMemo(()=>{
    const term=search.trim().toLocaleLowerCase();
    const low=minPrice.trim()===""?null:Number(minPrice);
    const high=maxPrice.trim()===""?null:Number(maxPrice);
    return products.filter(p=>{
      const matchesTerm=!term||[p.title,p.description,p.brand,p.category].some(v=>(v||"").toLocaleLowerCase().includes(term));
      const matchesCategory=category==="all"||p.category===category;
      const price=Number(p.price);
      return matchesTerm&&matchesCategory&&(low===null||price>=low)&&(high===null||price<=high);
    }).sort((a,b)=>sort==="price-low"?Number(a.price)-Number(b.price):sort==="price-high"?Number(b.price)-Number(a.price):sort==="name"?a.title.localeCompare(b.title):0);
  },[products,search,category,minPrice,maxPrice,sort]);
  const storeName=store?.business_name||store?.store_name||store?.contact_name||"Seller shop";
  const loading=storeLoading||productsLoading;
  const error=storeError||productsError;
  return <div className="min-h-screen bg-background"><SEOHead title={storeName+" | ShopHub"} description={"Browse approved products from "+storeName+" on ShopHub."}/><Navbar/><main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
    <Button variant="ghost" asChild><Link to="/products"><ArrowLeft className="mr-2 h-4 w-4"/>Back to marketplace</Link></Button>
    {loading?<div className="py-20 text-center text-muted-foreground">Loading shop…</div>:error?<Card><CardContent className="p-8 text-center text-destructive">Could not load this shop. Please try again.</CardContent></Card>:!store?<Card><CardContent className="p-12 text-center"><Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><h1 className="text-xl font-bold">Shop unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This seller shop is not currently available.</p><Button className="mt-4" asChild><Link to="/products">Browse products</Link></Button></CardContent></Card>:<>
      <Card><CardContent className="flex flex-wrap items-center gap-4 p-6"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">{store.profile_photo_url?<img src={store.profile_photo_url} alt={storeName+" profile"} className="h-full w-full object-cover"/>:<Store className="h-7 w-7"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{storeName}</h1></div><p className="mt-1 text-sm text-muted-foreground">Browse this seller’s approved marketplace products.</p></div><div className="text-sm text-muted-foreground">{products.length} {products.length===1?"product":"products"}</div></CardContent></Card>
      <section className="space-y-4"><div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">Shop products</h2></div>
        <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 lg:col-span-2"><Label htmlFor="store-search">Search products</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input id="store-search" className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, brand or details"/></div></div>
          <div className="space-y-2"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="All categories"/></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="store-min-price">Min price (₹)</Label><Input id="store-min-price" type="number" min="0" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="No minimum"/></div>
          <div className="space-y-2"><Label>Sort by</Label><Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="price-low">Price: low to high</SelectItem><SelectItem value="price-high">Price: high to low</SelectItem><SelectItem value="name">Product name</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 lg:col-start-4"><Label htmlFor="store-max-price">Max price (₹)</Label><Input id="store-max-price" type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="No maximum"/></div>
          <div className="flex items-end"><Button className="w-full" variant="outline" onClick={()=>{setSearch("");setCategory("all");setMinPrice("");setMaxPrice("");setSort("newest");}}>Clear filters</Button></div>
        </CardContent></Card>
        <p className="text-sm text-muted-foreground">Showing {filtered.length} of {products.length} products</p>
        {filtered.length===0?<Card><CardContent className="py-12 text-center"><Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><h3 className="font-semibold">No matching products</h3><p className="mt-1 text-sm text-muted-foreground">Try changing your search or filters.</p></CardContent></Card>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(p=><Link key={p.id} to={"/marketplace/products/"+p.id} className="group"><Card className="h-full overflow-hidden transition-shadow hover:shadow-md"><div className="flex aspect-square items-center justify-center bg-muted">{p.image_urls?.[0]?<img src={p.image_urls[0]} alt={p.title} loading="lazy" className="h-full w-full object-contain bg-white"/>:<Package className="h-12 w-12 text-muted-foreground"/>}</div><CardContent className="space-y-2 p-4"><p className="line-clamp-2 min-h-10 font-semibold group-hover:text-primary">{p.title}</p><p className="text-xs text-muted-foreground">{p.category}{p.brand?" · "+p.brand:""}</p><div className="flex items-baseline gap-2"><span className="text-lg font-bold text-primary">₹{Number(p.price).toFixed(2)}</span>{p.mrp&&Number(p.mrp)>Number(p.price)&&<span className="text-sm text-muted-foreground line-through">₹{Number(p.mrp).toFixed(2)}</span>}</div><p className="text-xs text-muted-foreground">{p.stock_quantity>0?"In stock · "+p.stock_quantity+" available":"Currently out of stock"}</p></CardContent></Card></Link>)}</div>}
      </section>
    </>}
  </main><Footer/></div>;
}
