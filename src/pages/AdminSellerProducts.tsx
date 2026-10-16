import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Package, RefreshCw, Search, ShieldAlert, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;
type Product = { id:string; seller_id:string; title:string; category:string; brand:string|null; sku:string|null; price:number; stock_quantity:number; status:string; image_urls:string[]|null; created_at:string; review_notes:string|null; featured_on_home:boolean };

export default function AdminSellerProducts() {
  const toastHook = useToast();
  const toast = toastHook.toast;
  const queryClient = useQueryClient();
  const [featureBusyId,setFeatureBusyId] = useState<string | null>(null);
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState("all");
  const {data:products=[],isLoading,isError,error,refetch,isFetching} = useQuery<Product[]>({
    queryKey:["admin-seller-products"],
    queryFn:async()=>{
      // Review notes live in the related review-notes table, not catalog.products.
      const {data,error}=await db.schema("catalog").from("products").select("id,seller_id,title,category,brand,sku,price,stock_quantity,status,image_urls,created_at,featured_on_home").order("created_at",{ascending:false}).limit(500);
      if(error) throw error;
      const rows=(data??[]) as Omit<Product,"review_notes">[];
      if(!rows.length) return [];
      const {data:notes,error:notesError}=await db.schema("catalog").from("product_review_notes").select("product_id,review_notes").in("product_id",rows.map(p=>p.id));
      if(notesError) throw notesError;
      const noteMap=new Map((notes??[]).map((n:any)=>[n.product_id,n.review_notes]));
      return rows.map(p=>({...p,review_notes:noteMap.get(p.id)??null}));
    }
  });
  async function toggleHomepageFeature(product: Product) {
    setFeatureBusyId(product.id);
    const { error } = await db.rpc("set_product_home_featured", {
      p_product_id: product.id,
      p_featured: !product.featured_on_home,
    });
    if (error) {
      toast({ title: "Could not update homepage feature", description: error.message, variant: "destructive" });
    } else {
      toast({ title: product.featured_on_home ? "Removed from homepage" : "Featured on homepage", description: "Each store can feature up to two approved, in-stock products with images." });
      await queryClient.invalidateQueries({ queryKey: ["admin-seller-products"] });
      await queryClient.invalidateQueries({ queryKey: ["home-featured-seller-products"] });
    }
    setFeatureBusyId(null);
  }
  const shown=products.filter(p=>(status==="all"||p.status===status)&&(!search.trim()||[p.title,p.category,p.brand,p.sku,p.seller_id].some(v=>v?.toLowerCase().includes(search.trim().toLowerCase()))));
  const counts=[{label:"All products",value:products.length},{label:"Pending review",value:products.filter(p=>p.status==="pending_review").length},{label:"Approved",value:products.filter(p=>p.status==="approved").length},{label:"Changes requested",value:products.filter(p=>p.status==="changes_requested").length}];
  return <SidebarProvider><div className="min-h-screen flex w-full bg-muted/30"><AdminSidebar activeTab="seller-products" onTabChange={()=>{}}/><div className="flex-1 min-w-0"><header className="h-14 flex items-center gap-4 border-b bg-background px-4"><SidebarTrigger/><h2 className="font-semibold text-sm">Seller Products</h2></header><main className="space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Marketplace operations</p><h1 className="text-2xl font-bold">Seller products</h1><p className="text-muted-foreground">Browse marketplace listings across all sellers and check their review status.</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4"/>Admin home</Link></Button><Button variant="outline" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching?"animate-spin":""}`}/>Refresh</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{counts.map(c=><Card key={c.label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{c.label}</p><p className="text-2xl font-bold">{c.value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, category, SKU, seller ID…"/></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="pending_review">Pending review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="changes_requested">Changes requested</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></CardContent></Card>
    {isLoading&&<div className="flex justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>Loading seller products…</div>}
    {isError&&<Card className="border-destructive"><CardContent className="flex items-start gap-3 p-5"><ShieldAlert className="h-5 w-5 text-destructive"/><div><p className="font-semibold">Could not load seller products</p><p className="text-sm text-muted-foreground">{(error as Error).message}</p><Button className="mt-3" variant="outline" onClick={()=>void refetch()}>Try again</Button></div></CardContent></Card>}
    {!isLoading&&!isError&&shown.length===0&&<Card className="border-dashed"><CardContent className="py-12 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-semibold">No seller products found</p><p className="text-sm text-muted-foreground">Try a different search or status filter.</p></CardContent></Card>}
    <div className="space-y-3">{shown.map(p=><Card key={p.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">{p.image_urls?.[0]?<img src={p.image_urls[0]} alt={p.title} className="h-24 w-24 rounded-lg border object-cover"/>:<div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted"><Package className="h-8 w-8 text-muted-foreground"/></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{p.title}</h3><Badge variant={p.status==="approved"?"default":p.status==="rejected"?"destructive":"secondary"}>{p.status.replaceAll("_"," ")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{p.category}{p.brand?` · ${p.brand}`:""} · SKU: {p.sku||"—"}</p><p className="mt-2 text-sm">Seller ID: <span className="font-mono text-xs">{p.seller_id}</span></p><div className="mt-3"><Button size="sm" variant={p.featured_on_home?"default":"outline"} disabled={featureBusyId===p.id||(!p.featured_on_home&&(p.status!=="approved"||p.stock_quantity<1||!p.image_urls?.length))} onClick={()=>void toggleHomepageFeature(p)}><Star className={`mr-2 h-4 w-4 ${p.featured_on_home?"fill-current":""}`}/>{featureBusyId===p.id?"Saving…":p.featured_on_home?"Featured on Home Page":"Feature on Home Page"}</Button><p className="mt-1 text-xs text-muted-foreground">Super Admin only · max 2 featured products per store</p></div>{p.review_notes&&<p className="mt-2 rounded-md bg-muted p-2 text-sm">Review note: {p.review_notes}</p>}</div><div className="shrink-0 sm:text-right"><p className="font-semibold">₹{Number(p.price).toFixed(2)}</p><p className="text-sm text-muted-foreground">Stock: {p.stock_quantity}</p><p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p></div></CardContent></Card>)}</div>
  </main></div></div></SidebarProvider>;
}
