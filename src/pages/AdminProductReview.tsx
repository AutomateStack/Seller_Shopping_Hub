import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Loader2, Package, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

const db = supabase as any;
type Product = {id:string;seller_id:string;title:string;description:string;category:string;brand:string;sku:string|null;price:number;mrp:number|null;stock_quantity:number;image_urls:string[];status:string;review_notes:string|null;created_at:string;};
const pretty=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminProductReview() {
  const {toast}=useToast();
  const client=useQueryClient();
  const [filter,setFilter]=useState("pending_review");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const {data:products=[],isLoading,isError,error,refetch,isFetching}=useQuery<Product[]>({
    queryKey:["admin-product-review"],
    queryFn:async()=>{
      const {data,error}=await db.schema("catalog").from("products").select("*").order("created_at",{ascending:false});
      if(error) throw error;
      return (data??[]) as Product[];
    }
  });
  const mutation=useMutation({
    mutationFn:async({id,status,note}:{id:string;status:"approved"|"rejected"|"changes_requested";note?:string})=>{
      const {error}=await db.schema("catalog").from("products").update({status,review_notes:note??null,reviewed_at:new Date().toISOString()}).eq("id",id);
      if(error) throw error;
    },
    onSuccess:async()=>{toast({title:"Product review saved",description:"The seller can see the updated status in My Products."});await client.invalidateQueries({queryKey:["admin-product-review"]});},
    onError:(e:Error)=>toast({title:"Could not save review",description:e.message,variant:"destructive"})
  });
  const counts=useMemo(()=>({pending:products.filter(p=>p.status==="pending_review").length,approved:products.filter(p=>p.status==="approved").length,changes:products.filter(p=>p.status==="changes_requested").length,rejected:products.filter(p=>p.status==="rejected").length}),[products]);
  const shown=products.filter(p=>filter==="all"||p.status===filter);
  function decide(p:Product,status:"approved"|"rejected"|"changes_requested"){
    const note=(notes[p.id]??"").trim();
    if(status!=="approved"&&note.length<5){toast({title:"Add a review note",description:"Provide at least five characters explaining the requested changes or rejection.",variant:"destructive"});return;}
    if(status==="rejected"&&!window.confirm(`Reject "${p.title}"? The seller will see the review note.`))return;
    mutation.mutate({id:p.id,status,note:note||undefined});
  }
  return <main className="min-h-screen bg-background">
    <header className="border-b border-[#f9a8c8]/60 bg-white/90"><div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#fce7f3] p-2.5"><Package className="h-6 w-6 text-primary"/></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Shopping Hub</p><h1 className="text-xl font-bold">Product review</h1></div></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4"/>Admin home</Link></Button><Button variant="outline" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching?"animate-spin":""}`}/>Refresh</Button></div></div></header>
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div><h2 className="text-2xl font-bold">Product submissions</h2><p className="text-muted-foreground">Approve products before they are published to the marketplace.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{label:"Pending review",value:counts.pending},{label:"Approved",value:counts.approved},{label:"Changes requested",value:counts.changes},{label:"Rejected",value:counts.rejected}].map(c=><Card key={c.label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{c.label}</p><p className="text-2xl font-bold">{c.value}</p></CardContent></Card>)}</div>
      <Card><CardContent className="p-4"><Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending_review">Pending review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="changes_requested">Changes requested</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="draft">Drafts</SelectItem><SelectItem value="all">All products</SelectItem></SelectContent></Select></CardContent></Card>
      {isLoading&&<div className="flex justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>Loading products…</div>}
      {isError&&<Card className="border-destructive"><CardContent className="flex items-start gap-3 p-5"><ShieldAlert className="h-5 w-5 text-destructive"/><div><p className="font-semibold">Could not load products</p><p className="text-sm text-muted-foreground">{(error as Error).message}</p><Button className="mt-3" variant="outline" onClick={()=>void refetch()}>Retry</Button></div></CardContent></Card>}
      {!isLoading&&!isError&&shown.length===0&&<Card className="border-dashed"><CardContent className="py-12 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-semibold">No products in this view</p><p className="text-sm text-muted-foreground">Seller submissions will appear here after they are sent for review.</p></CardContent></Card>}
      <div className="space-y-4">{shown.map(p=><Card key={p.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{p.title}</CardTitle><CardDescription>{p.category}{p.brand?` · ${p.brand}`:""} · Added {new Date(p.created_at).toLocaleString()}</CardDescription></div><Badge variant={p.status==="approved"?"default":p.status==="rejected"?"destructive":"secondary"}>{pretty(p.status)}</Badge></div></CardHeader><CardContent className="space-y-4">
        {p.image_urls?.length>0&&<div className="flex flex-wrap gap-2">{p.image_urls.map((url,i)=><a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`${p.title} image ${i+1}`} className="h-24 w-24 rounded-md border object-cover"/></a>)}</div>}
        <p className="whitespace-pre-wrap text-sm">{p.description||"No description provided."}</p>
        <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Selling price</p><p className="font-semibold">₹{Number(p.price).toFixed(2)}</p></div><div><p className="text-xs text-muted-foreground">MRP</p><p>{p.mrp? `₹${Number(p.mrp).toFixed(2)}`:"Not provided"}</p></div><div><p className="text-xs text-muted-foreground">Stock</p><p>{p.stock_quantity}</p></div><div><p className="text-xs text-muted-foreground">SKU</p><p>{p.sku||"Not provided"}</p></div></div>
        {p.review_notes&&<div className="rounded-lg bg-muted p-3 text-sm">Previous note: {p.review_notes}</div>}
        {p.status==="pending_review"&&<div className="space-y-2 border-t pt-4"><Label htmlFor={`product-note-${p.id}`}>Review note (required for changes/rejection)</Label><Textarea id={`product-note-${p.id}`} rows={2} maxLength={2000} value={notes[p.id]??""} onChange={e=>setNotes(old=>({...old,[p.id]:e.target.value}))} placeholder="Explain the changes needed…"/><div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending} onClick={()=>decide(p,"approved")}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve & publish</Button><Button variant="outline" disabled={mutation.isPending} onClick={()=>decide(p,"changes_requested")}><RefreshCw className="mr-2 h-4 w-4"/>Request changes</Button><Button variant="destructive" disabled={mutation.isPending} onClick={()=>decide(p,"rejected")}><XCircle className="mr-2 h-4 w-4"/>Reject</Button></div></div>}
      </CardContent></Card>)}</div>
    </div>
  </main>;
}
