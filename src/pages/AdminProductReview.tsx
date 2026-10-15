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
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ArrowLeft, CheckCircle2, Loader2, Package, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

const db = supabase as any;
type Product = {id:string;seller_id:string;title:string;description:string;category:string;brand:string;sku:string|null;price:number;mrp:number|null;stock_quantity:number;image_urls:string[];status:string;review_notes:string|null;seller_change_summary?:string|null;created_at:string;review_history?:any[];seller?:{business_name?:string|null;store_name?:string|null;contact_name?:string|null}|null;};
const pretty=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminProductReview() {
  const {toast}=useToast();
  const client=useQueryClient();
  const [filter,setFilter]=useState("pending_review");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const {data:products=[],isLoading,isError,error,refetch,isFetching}=useQuery<Product[]>({
    queryKey:["admin-product-review"],
    queryFn:async()=>{
      const {data,error}=await db.schema("catalog").from("products").select("id,seller_id,title,description,category,brand,sku,price,mrp,stock_quantity,image_urls,status,created_at").order("created_at",{ascending:false});
      if(error) throw error;
      const rows=(data??[]) as Product[];
      const sellerIds=[...new Set(rows.map(p=>p.seller_id))];
      const [{data:noteRows,error:notesError},{data:sellers,error:sellerError},{data:historyRows,error:historyError}]=await Promise.all([
        db.schema("catalog").from("product_review_notes").select("product_id,review_notes,seller_change_summary"),
        sellerIds.length ? db.schema("seller").from("seller_profiles").select("id,business_name,store_name,contact_name").in("id",sellerIds) : Promise.resolve({data:[],error:null}),
        db.schema("catalog").from("product_submission_review_history").select("id,product_id,reviewer_id,decision,comment,reviewed_at").in("product_id",rows.map(p=>p.id)).order("reviewed_at",{ascending:false})
      ]);
      if(notesError) throw notesError;
      if(sellerError) throw sellerError;
      if(historyError) throw historyError;
      const noteMap=new Map((noteRows??[]).map((n:any)=>[n.product_id,n]));
      const sellerMap=new Map((sellers??[]).map((s:any)=>[s.id,s]));
      const historyMap=new Map<string,any[]>();
      (historyRows??[]).forEach((event:any)=>{const existing=historyMap.get(event.product_id)??[];existing.push(event);historyMap.set(event.product_id,existing);});
      return rows.map(p=>({...p,seller:sellerMap.get(p.seller_id),review_notes:noteMap.get(p.id)?.review_notes??null,seller_change_summary:noteMap.get(p.id)?.seller_change_summary??null,review_history:historyMap.get(p.id)??[]}));
    }
  });
  const {data:revisions=[],isLoading:revisionsLoading,isError:revisionsError,error:revisionsErrorValue,refetch:refetchRevisions,isFetching:revisionsFetching}=useQuery<any[]>({
    queryKey:["admin-product-revisions"],
    queryFn:async()=>{
      const {data,error}=await db.schema("catalog").from("product_revisions").select("id,product_id,seller_id,revision_number,previous_data,proposed_data,seller_change_summary,review_status,submitted_at,submitted_by,reviewed_at,reviewed_by,review_comment").order("submitted_at",{ascending:false}).limit(200);
      if(error) throw error;
      const rows=data??[];
      if(!rows.length) return [];
      const revisionIds=rows.map((r:any)=>r.id), productIds=[...new Set(rows.map((r:any)=>r.product_id))], sellerIds=[...new Set(rows.map((r:any)=>r.seller_id))];
      const [{data:events,error:eventError},{data:productsForRevision,error:productError},{data:sellers,error:sellerError}]=await Promise.all([
        db.rpc("list_product_review_events",{p_revision_ids:revisionIds}),
        db.schema("catalog").from("products").select("id,title,status").in("id",productIds),
        db.schema("seller").from("seller_profiles").select("id,store_name,business_name,contact_name").in("id",sellerIds)
      ]);
      if(eventError) throw eventError; if(productError) throw productError; if(sellerError) throw sellerError;
      const productMap=new Map((productsForRevision??[]).map((p:any)=>[p.id,p])), sellerMap=new Map((sellers??[]).map((p:any)=>[p.id,p]));
      return rows.map((r:any)=>({...r,events:(events??[]).filter((e:any)=>e.revision_id===r.id).sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),product:productMap.get(r.product_id),seller:sellerMap.get(r.seller_id)})).sort((a:any,b:any)=>{const aPending=a.review_status==="pending_review"?1:0;const bPending=b.review_status==="pending_review"?1:0;return bPending-aPending||new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime();});
    }
  });
  const revisionMutation=useMutation({
    mutationFn:async({revisionId,decision,comment}:{revisionId:string;decision:"approved"|"changes_requested"|"rejected";comment?:string})=>{
      const {data,error}=await db.rpc("review_seller_product_revision",{p_revision_id:revisionId,p_decision:decision,p_comment:comment??null});
      if(error) throw error; return data;
    },
    onSuccess:async()=>{toast({title:"Revision review saved",description:"The approved listing remains live unless this revision was approved."});await Promise.all([client.invalidateQueries({queryKey:["admin-product-revisions"]}),client.invalidateQueries({queryKey:["admin-product-review"]}),client.invalidateQueries({queryKey:["admin-seller-products"]})]);},
    onError:(e:Error)=>toast({title:"Could not save revision review",description:e.message,variant:"destructive"})
  });
  function decideRevision(revision:any,decision:"approved"|"changes_requested"|"rejected"){
    const note=(notes["revision:"+revision.id]??"").trim();
    if(decision!=="approved"&&note.length<5){toast({title:"Add a review note",description:"Provide at least five characters explaining the requested changes or rejection.",variant:"destructive"});return;}
    if(decision==="rejected"&&!window.confirm("Reject this submitted revision? The approved listing remains unchanged."))return;
    revisionMutation.mutate({revisionId:revision.id,decision,comment:note||undefined});
  }
  const mutation=useMutation({
    mutationFn:async({id,status,note}:{id:string;status:"approved"|"rejected"|"changes_requested";note?:string})=>{
      const {error}=await db.rpc("review_seller_product_submission",{p_product_id:id,p_decision:status,p_comment:note??null});
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
  return <SidebarProvider><div className="min-h-screen flex w-full bg-muted/30"><AdminSidebar activeTab="product-review" onTabChange={() => {}}/><div className="flex-1 min-w-0"><div className="h-14 flex items-center gap-4 border-b bg-background px-4"><SidebarTrigger/><h2 className="font-semibold text-sm">Product Review</h2></div><main className="min-h-screen bg-background">
    <header className="border-b border-[#f9a8c8]/60 bg-white/90"><div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#fce7f3] p-2.5"><Package className="h-6 w-6 text-primary"/></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Shopping Hub</p><h1 className="text-xl font-bold">Product review</h1></div></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4"/>Admin home</Link></Button><Button variant="outline" onClick={()=>void Promise.all([refetch(),refetchRevisions()])} disabled={isFetching||revisionsFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching||revisionsFetching?"animate-spin":""}`}/>Refresh</Button></div></div></header>
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div><h2 className="text-2xl font-bold">Product submissions</h2><p className="text-muted-foreground">Approve products before they are published to the marketplace.</p></div>
      <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Edited product revisions</h2><p className="text-sm text-muted-foreground">Compare submitted details with the approved listing. Live product data remains unchanged until approval.</p></div><Button variant="outline" onClick={()=>void refetchRevisions()}>Refresh revisions</Button></div>
        {revisionsLoading&&<p className="py-4 text-sm text-muted-foreground">Loading revision history…</p>}
        {revisionsError&&<Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">Could not load revisions: {(revisionsErrorValue as Error)?.message}</CardContent></Card>}
        {!revisionsLoading&&!revisionsError&&revisions.length===0&&<Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">No edited product revisions submitted.</CardContent></Card>}
        <div className="space-y-4">{revisions.map((r:any)=>{
          const before=r.previous_data||{},after=r.proposed_data||{};
          const fields:[string,string][]=[["title","Title"],["description","Description"],["category","Category"],["brand","Brand"],["sku","SKU"],["price","Price"],["mrp","MRP"],["image_urls","Images"]];
          const changed=fields.filter(([key])=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null));
          const value=(key:string,val:any)=>key==="price"||key==="mrp"?(val==null?"—":"₹"+Number(val).toFixed(2)):key==="image_urls"?(Array.isArray(val)?val.length+" image(s)":"—"):(val==null||val===""?"—":String(val));
          return <Card key={r.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{r.product?.title||after.title||"Product"} · Revision {r.revision_number}</CardTitle><CardDescription>{r.seller?.business_name||r.seller?.store_name||r.seller?.contact_name||"Seller"} · Submitted {new Date(r.submitted_at).toLocaleString()}</CardDescription></div><Badge variant={r.review_status==="approved"?"default":r.review_status==="rejected"?"destructive":r.review_status==="pending_review"?"secondary":"outline"}>{pretty(r.review_status)}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-sm font-semibold">Seller's change explanation</p><p className="mt-1 whitespace-pre-wrap text-sm">{r.seller_change_summary}</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Field</th><th className="p-2">Approved value</th><th className="p-2">Proposed value</th></tr></thead><tbody>{changed.map(([key,label])=><tr key={key} className="border-b last:border-0"><td className="p-2 font-medium">{label}</td><td className="max-w-[220px] whitespace-pre-wrap break-words p-2">{value(key,before[key])}</td><td className="max-w-[220px] whitespace-pre-wrap break-words p-2">{value(key,after[key])}</td></tr>)}{!changed.length&&<tr><td colSpan={3} className="p-3 text-muted-foreground">No differences detected.</td></tr>}</tbody></table></div>
              {Array.isArray(after.image_urls)&&after.image_urls.length>0&&<div className="flex flex-wrap gap-2">{after.image_urls.map((url:string,i:number)=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={"Proposed product image "+(i+1)} className="h-20 w-20 rounded-md border object-cover"/></a>)}</div>}
              {r.review_comment&&<div className="rounded-lg bg-muted p-3 text-sm"><p className="font-semibold">Latest admin comment</p><p className="mt-1 whitespace-pre-wrap">{r.review_comment}</p></div>}
              <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Audit history ({r.events?.length||0} events)</summary><div className="mt-3 space-y-3">{(r.events||[]).map((event:any)=><div key={event.id} className="border-l-2 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{pretty(event.action)} <span className="text-muted-foreground">· {event.actor_role}</span></p><time className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</time></div>{event.comment&&<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{event.comment}</p>}<p className="text-xs text-muted-foreground">{event.previous_status||"—"} → {event.new_status}</p></div>)}{!r.events?.length&&<p className="text-sm text-muted-foreground">No audit events found.</p>}</div></details>
              {r.review_status==="pending_review"&&<div className="space-y-2 border-t pt-4"><Label htmlFor={"revision-note-"+r.id}>Admin comment (required for changes or rejection)</Label><Textarea id={"revision-note-"+r.id} rows={2} maxLength={2000} value={notes["revision:"+r.id]??""} onChange={e=>setNotes(old=>({...old,["revision:"+r.id]:e.target.value}))} placeholder="Explain what needs correction…"/><div className="flex flex-wrap gap-2"><Button disabled={revisionMutation.isPending} onClick={()=>decideRevision(r,"approved")}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve revision</Button><Button variant="outline" disabled={revisionMutation.isPending} onClick={()=>decideRevision(r,"changes_requested")}><RefreshCw className="mr-2 h-4 w-4"/>Request changes</Button><Button variant="destructive" disabled={revisionMutation.isPending} onClick={()=>decideRevision(r,"rejected")}><XCircle className="mr-2 h-4 w-4"/>Reject revision</Button></div></div>}
            </CardContent></Card>;
        })}</div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{label:"Pending review",value:counts.pending},{label:"Approved",value:counts.approved},{label:"Changes requested",value:counts.changes},{label:"Rejected",value:counts.rejected}].map(c=><Card key={c.label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{c.label}</p><p className="text-2xl font-bold">{c.value}</p></CardContent></Card>)}</div>
      <Card><CardContent className="p-4"><Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending_review">Pending review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="changes_requested">Changes requested</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="draft">Drafts</SelectItem><SelectItem value="all">All products</SelectItem></SelectContent></Select></CardContent></Card>
      {isLoading&&<div className="flex justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>Loading products…</div>}
      {isError&&<Card className="border-destructive"><CardContent className="flex items-start gap-3 p-5"><ShieldAlert className="h-5 w-5 text-destructive"/><div><p className="font-semibold">Could not load products</p><p className="text-sm text-muted-foreground">{(error as Error).message}</p><Button className="mt-3" variant="outline" onClick={()=>void refetch()}>Retry</Button></div></CardContent></Card>}
      {!isLoading&&!isError&&shown.length===0&&<Card className="border-dashed"><CardContent className="py-12 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground"/><p className="mt-3 font-semibold">No products in this view</p><p className="text-sm text-muted-foreground">Seller submissions will appear here after they are sent for review.</p></CardContent></Card>}
      <div className="space-y-4">{shown.map(p=><Card key={p.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{p.title}</CardTitle><CardDescription>{p.seller?.business_name||p.seller?.store_name||p.seller?.contact_name||"Seller"} · {p.category}{p.brand?` · ${p.brand}`:""} · Added {new Date(p.created_at).toLocaleString()}</CardDescription></div><Badge variant={p.status==="approved"?"default":p.status==="rejected"?"destructive":"secondary"}>{pretty(p.status)}</Badge></div></CardHeader><CardContent className="space-y-4">
        {p.image_urls?.length>0&&<div className="flex flex-wrap gap-2">{p.image_urls.map((url,i)=><a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`${p.title} image ${i+1}`} className="h-24 w-24 rounded-md border object-cover"/></a>)}</div>}
        <p className="whitespace-pre-wrap text-sm">{p.description||"No description provided."}</p>
        <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Selling price</p><p className="font-semibold">₹{Number(p.price).toFixed(2)}</p></div><div><p className="text-xs text-muted-foreground">MRP</p><p>{p.mrp? `₹${Number(p.mrp).toFixed(2)}`:"Not provided"}</p></div><div><p className="text-xs text-muted-foreground">Stock</p><p>{p.stock_quantity}</p></div><div><p className="text-xs text-muted-foreground">SKU</p><p>{p.sku||"Not provided"}</p></div></div>
        {p.seller_change_summary&&<div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="font-semibold text-sm">Seller change summary</p><p className="mt-1 whitespace-pre-wrap text-sm">{p.seller_change_summary}</p></div>}{p.review_notes&&<div className="rounded-lg bg-muted p-3 text-sm">Latest admin note: {p.review_notes}</div>}
        {p.review_history?.length>0&&<details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Review history ({(p as any).review_history.length})</summary><div className="mt-3 space-y-3">{(p as any).review_history.map((event:any)=><div key={event.id} className="border-l-2 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{pretty(event.decision)}</p><time className="text-xs text-muted-foreground">{new Date(event.reviewed_at).toLocaleString()}</time></div>{event.comment&&<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{event.comment}</p>}</div>)}</div></details>}
        {p.status==="pending_review"&&<div className="space-y-2 border-t pt-4"><Label htmlFor={`product-note-${p.id}`}>Review note (required for changes/rejection)</Label><Textarea id={`product-note-${p.id}`} rows={2} maxLength={2000} value={notes[p.id]??""} onChange={e=>setNotes(old=>({...old,[p.id]:e.target.value}))} placeholder="Explain the changes needed…"/><div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending} onClick={()=>decide(p,"approved")}><CheckCircle2 className="mr-2 h-4 w-4"/>Approve & publish</Button><Button variant="outline" disabled={mutation.isPending} onClick={()=>decide(p,"changes_requested")}><RefreshCw className="mr-2 h-4 w-4"/>Request changes</Button><Button variant="destructive" disabled={mutation.isPending} onClick={()=>decide(p,"rejected")}><XCircle className="mr-2 h-4 w-4"/>Reject</Button></div></div>}
      </CardContent></Card>)}</div>
    </div>
  </main></div></div></SidebarProvider>;
}
