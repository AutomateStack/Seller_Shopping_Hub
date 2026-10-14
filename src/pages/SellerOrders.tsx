import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Package, ShoppingBag, AlertTriangle, Loader2, Search, RefreshCw, Truck, CheckCircle2, Clock3, Banknote } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { SellerPortalLayout } from "@/components/seller/SellerPortalLayout";

const db = supabase as any;
export default function SellerOrders() {
  const navigate = useNavigate();
  const [sellerId, setSellerId] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [updating, setUpdating] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [returnReviewDraft, setReturnReviewDraft] = useState<{id:string;status:"approved"|"rejected"}|null>(null);
  const [returnReviewNote, setReturnReviewNote] = useState("");
  const [refundEditorOrder, setRefundEditorOrder] = useState<string|null>(null);
  const [refundAmountDraft, setRefundAmountDraft] = useState("");
  const [refundStatusDraft, setRefundStatusDraft] = useState<"pending"|"refunded">("pending");
  const selectedOrderHistory = Array.isArray(selectedOrder?.marketplace_order_history) ? selectedOrder.marketplace_order_history : [];
  const selectedOrderStatusHistory = selectedOrderHistory.filter((event: any) => event.event_type === "order_status");
  const load = async (id: string) => {
    const { data, error } = await db.schema("orders").from("marketplace_orders")
      .select("id,order_number,status,payment_method,payment_status,refund_status,refund_amount,refunded_at,cod_collected_at,total_amount,created_at,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_state,shipping_postal_code,marketplace_order_items(id,product_title,quantity,unit_price,line_total,image_url),marketplace_order_history(event_type,old_value,new_value,changed_at)")
      .eq("seller_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) setError(error.message); else setOrders(data || []);
    const { data: requests, error: requestError } = await db.schema("orders").from("marketplace_return_requests").select("id,order_id,buyer_id,reason,status,seller_note,created_at,restocked_at,marketplace_orders(order_number,total_amount,status,shipping_name)").eq("seller_id", id).order("created_at", { ascending: false });
    if (requestError) setError(requestError.message); else setReturnRequests(requests || []);
    setLoading(false);
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth?next=/seller/orders", { replace: true }); return; }
      const { data, error } = await db.schema("seller").from("seller_profiles")
        .select("id,onboarding_status,account_status").eq("user_id", session.user.id).maybeSingle();
      if (!alive) return;
      if (error || !data) { setError(error?.message || "Seller profile not found."); setLoading(false); return; }
      if (data.onboarding_status !== "approved" || data.account_status !== "active") { navigate("/seller/onboarding", { replace: true }); return; }
      setSellerId(data.id); await load(data.id);
    })();
    return () => { alive = false; };
  }, [navigate]);
  const actions = (status: string) => ({ placed:["confirmed","cancelled"], confirmed:["processing","cancelled"], processing:["shipped"], shipped:["delivered"] } as Record<string,string[]>)[status] || [];
  const changeStatus = async (orderId: string, status: string) => {
    setUpdating(orderId); setError("");
    const { error } = await db.rpc("update_marketplace_order_status", { p_order_id: orderId, p_status: status });
    if (error) setError(error.message);
    else {
      setCancelTarget(null);
      setSelectedOrder((current: any) => current?.id === orderId ? null : current);
      await load(sellerId);
    }
    setUpdating("");
  };
  const recordCodCollection = async (orderId: string) => {
    setUpdating(orderId); setError("");
    const { error } = await db.rpc("record_marketplace_cod_collection", { p_order_id: orderId });
    if (error) setError(error.message); else await load(sellerId);
    setUpdating("");
  };
  const filtered = orders.filter(o => {
    const matchesPeriod = period === "all" || new Date(o.created_at) >= new Date(Date.now() - (period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);
    const matchesTab = tab === "all" || (tab === "pending" && ["placed","confirmed"].includes(o.status)) || (tab === "ready" && o.status === "processing") || (tab === "shipped" && o.status === "shipped") || (tab === "delivered" && o.status === "delivered") || (tab === "returned" && o.status === "returned");
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || String(o.order_number || "").toLowerCase().includes(term) || (o.marketplace_order_items || []).some((item: any) => String(item.product_title || "").toLowerCase().includes(term));
    return matchesPeriod && matchesTab && matchesSearch;
  });
  const pendingPayment = orders.filter(o => o.payment_status !== "paid" && !["cancelled","returned"].includes(o.status)).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const refreshOrders = async () => { if (!sellerId) return; setRefreshing(true); await load(sellerId); setRefreshing(false); };
  const tabs = [{id:"pending",label:"Pending",count:orders.filter(o=>["placed","confirmed"].includes(o.status)).length},{id:"ready",label:"Ready to dispatch",count:orders.filter(o=>o.status==="processing").length},{id:"shipped",label:"Shipped",count:orders.filter(o=>o.status==="shipped").length},{id:"delivered",label:"Delivered",count:orders.filter(o=>o.status==="delivered").length},{id:"returned",label:"Returned",count:orders.filter(o=>o.status==="returned").length},{id:"all",label:"All orders",count:orders.length}];
  return <SellerPortalLayout><main className="min-h-screen bg-background"><SEOHead title="Seller Orders | Seller Shopping Hub" description="Manage seller orders." noindex/><div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Button variant="ghost" size="sm" asChild><Link to="/seller/dashboard"><ArrowLeft className="mr-2 h-4 w-4"/>Seller dashboard</Link></Button><h1 className="mt-2 text-3xl font-bold">Orders</h1><p className="text-sm text-muted-foreground">Manage orders from confirmation through delivery.</p></div><Badge variant="outline">{orders.length} total orders</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><ShoppingBag className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Total orders</p><p className="text-2xl font-bold">{orders.length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><Clock3 className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Awaiting action</p><p className="text-2xl font-bold">{orders.filter(o=>["placed","confirmed","processing","shipped"].includes(o.status)).length}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><Banknote className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Payment outstanding</p><p className="text-2xl font-bold">₹{pendingPayment.toFixed(2)}</p></div></CardContent></Card>
    </div>
    {returnRequests.some((r:any)=>r.status==="requested") && (
      <Card>
        <CardHeader><CardTitle>Return requests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {returnRequests.filter((r:any)=>r.status==="requested").map((r:any)=>(
            <div key={r.id} className="rounded-lg border p-3 space-y-3">
              <div>
                <p className="font-semibold">{r.marketplace_orders?.order_number || "Order"} · ₹{Number(r.marketplace_orders?.total_amount||0).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{r.marketplace_orders?.shipping_name} · {new Date(r.created_at).toLocaleString()}</p>
                <p className="mt-2 text-sm">{r.reason}</p>
              </div>
              {returnReviewDraft?.id===r.id ? (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <p className="text-sm font-medium">{returnReviewDraft.status==="approved"?"Approve return request":"Reject return request"}</p>
                  <p className="text-xs text-muted-foreground">{returnReviewDraft.status==="approved"?"Optional note for the buyer.":"Please explain why this request is being rejected."}</p>
                  <Textarea rows={2} value={returnReviewNote} onChange={(e)=>setReturnReviewNote(e.target.value)} placeholder={returnReviewDraft.status==="approved"?"Optional note…":"Reason for rejection…"} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={updating===r.order_id || (returnReviewDraft.status==="rejected" && returnReviewNote.trim().length<5)} onClick={async()=>{
                      const draft=returnReviewDraft;
                      if(!draft) return;
                      setUpdating(r.order_id);
                      const {error}=await db.rpc("review_marketplace_return",{p_request_id:r.id,p_status:draft.status,p_note:returnReviewNote.trim()||null});
                      setUpdating("");
                      if(error){setError(error.message);return;}
                      setReturnReviewDraft(null);setReturnReviewNote("");await load(sellerId);
                    }}>{updating===r.order_id?"Saving…":"Confirm decision"}</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setReturnReviewDraft(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={()=>{setReturnReviewDraft({id:r.id,status:"approved"});setReturnReviewNote("");}}>Approve return</Button>
                  <Button size="sm" variant="outline" onClick={()=>{setReturnReviewDraft({id:r.id,status:"rejected"});setReturnReviewNote("");}}>Reject</Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    )}
    {returnRequests.some((r:any)=>r.status==="approved"&&!r.restocked_at) && (
      <Card>
        <CardHeader><CardTitle>Approved returns awaiting inspection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {returnRequests.filter((r:any)=>r.status==="approved"&&!r.restocked_at).map((r:any)=>(
            <div key={r.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{r.marketplace_orders?.order_number || "Order"} · {r.marketplace_orders?.shipping_name || "Buyer"}</p>
                <p className="text-sm text-muted-foreground">Return approved · {new Date(r.created_at).toLocaleString()}</p>
                <p className="mt-1 text-sm">{r.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Confirm the item has physically arrived and passed inspection before restocking.</p>
              </div>
              <Button size="sm" disabled={updating===r.order_id} onClick={async()=>{
                const confirmed=window.confirm("Confirm the returned item has been received and inspected? This will add the ordered quantity back to inventory once.");
                if(!confirmed)return;
                setUpdating(r.order_id);setError("");
                const {error}=await db.rpc("restock_marketplace_return",{p_request_id:r.id});
                if(error)setError(error.message);
                else { await load(sellerId); }
                setUpdating("");
              }}>{updating===r.order_id?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Package className="mr-2 h-4 w-4"/>}Mark received & restock</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    )}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2" role="group" aria-label="Order date range">{[{id:"7d",label:"Last 7 days"},{id:"30d",label:"Last 30 days"},{id:"all",label:"All time"}].map(p=><Button key={p.id} variant={period===p.id?"default":"outline"} size="sm" onClick={()=>setPeriod(p.id as "7d"|"30d"|"all")}>{p.label}</Button>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">{tabs.map(t=><Button key={t.id} variant={tab===t.id?"default":"outline"} size="sm" onClick={()=>setTab(t.id)}>{t.label}<span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{t.count}</span></Button>)}</div>
      <Button variant="outline" size="sm" onClick={()=>void refreshOrders()} disabled={refreshing}>{refreshing?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<RefreshCw className="mr-2 h-4 w-4"/>}Refresh</Button>
    </div></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input aria-label="Search orders" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by order number or product…" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"/></div>
    {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Orders</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin"/></div> : filtered.length === 0 ? <Card><CardContent className="p-10 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No orders in this section</p><p className="text-sm text-muted-foreground">Orders will appear here as buyers place them.</p></CardContent></Card> : filtered.map(order=><Card key={order.id}><CardContent className="space-y-3 p-3 sm:p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button type="button" className="text-left text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={()=>setSelectedOrder(order)}>{order.order_number}</button><Badge className="capitalize">{order.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()} · <button type="button" className="underline underline-offset-2" onClick={()=>setSelectedOrder(order)}>View details</button></p></div><div className="flex flex-wrap items-center gap-2 md:justify-end"><Badge variant="outline">{String(order.payment_method || "cod").toUpperCase()}</Badge><Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>{order.payment_status === "paid" ? "Paid / collected" : order.payment_status === "cod_due" ? "COD due" : order.payment_status}</Badge><span className="min-w-[84px] text-sm font-semibold md:text-right">₹{Number(order.total_amount).toFixed(2)}</span></div></div>{order.status === "returned" && <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm"><span>Refund: <strong className="capitalize">{String(order.refund_status||"not_applicable").replaceAll("_"," ")}</strong></span><span>Collected: <strong>₹{Number(order.total_amount).toFixed(2)}</strong></span>{Number(order.refund_amount)>0&&<span>Refund amount: <strong>₹{Number(order.refund_amount).toFixed(2)}</strong></span>}<Button size="sm" variant="outline" disabled={updating===order.id} onClick={()=>{setRefundEditorOrder(order.id);setRefundAmountDraft(String(Number(order.refund_amount)>0?order.refund_amount:order.total_amount));setRefundStatusDraft(order.refund_status==="refunded"?"refunded":"pending");}}>Manage refund</Button>{refundEditorOrder===order.id&&<div className="mt-3 w-full space-y-3 rounded-md border bg-muted/20 p-3"><p className="font-medium">Manage buyer refund</p><p className="text-xs text-muted-foreground">Enter the amount and select its status. Choose Refunded only after you have actually sent the money to the buyer. This form records the refund; it does not transfer money.</p><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Refund amount (₹)</Label><Input type="number" min="0.01" max={Number(order.total_amount)} step="0.01" value={refundAmountDraft} onChange={e=>setRefundAmountDraft(e.target.value)} /></div><div className="space-y-1"><Label>Refund status</Label><Select value={refundStatusDraft} onValueChange={(v:"pending"|"refunded")=>setRefundStatusDraft(v)}><SelectTrigger><SelectValue placeholder="Choose status"/></SelectTrigger><SelectContent><SelectItem value="pending">Pending — not yet issued</SelectItem><SelectItem value="refunded">Refunded — money sent</SelectItem></SelectContent></Select></div></div><div className="flex gap-2"><Button size="sm" disabled={updating===order.id||!Number.isFinite(Number(refundAmountDraft))||Number(refundAmountDraft)<=0||Number(refundAmountDraft)>Number(order.total_amount)} onClick={async()=>{if(refundStatusDraft==="refunded"&&!window.confirm("Confirm you have already issued ₹"+Number(refundAmountDraft).toFixed(2)+" to the buyer. Continue?"))return;setUpdating(order.id);const {error}=await db.rpc("update_marketplace_refund_status",{p_order_id:order.id,p_refund_status:refundStatusDraft,p_refund_amount:Number(refundAmountDraft)});setUpdating("");if(error){setError(error.message);return;}setRefundEditorOrder(null);await load(sellerId);}}>Save refund</Button><Button size="sm" variant="ghost" onClick={()=>setRefundEditorOrder(null)}>Cancel</Button></div></div>}</div>}{order.status === "returned" && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs"><span>Refund: <strong className="capitalize">{String(order.refund_status || "not_applicable").replaceAll("_"," ")}</strong></span>{order.payment_status === "paid" && <span>Collected: <strong>₹{Number(order.total_amount).toFixed(2)}</strong></span>}{order.refund_status === "refunded" && <><span>Refunded: <strong>₹{Number(order.refund_amount).toFixed(2)}</strong></span><span>Net: <strong>₹{Math.max(0,Number(order.total_amount)-Number(order.refund_amount)).toFixed(2)}</strong></span></>}</div>}<div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 flex-wrap gap-3">{(order.marketplace_order_items||[]).map((item:any)=><div key={item.id} className="flex min-w-0 items-center gap-2"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">{item.image_url?<img src={item.image_url} alt={item.product_title} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground"/></div>}</div><div className="min-w-0"><p className="max-w-[260px] truncate text-sm font-medium">{item.product_title}</p><p className="text-xs text-muted-foreground">Qty {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p></div></div>)}</div><div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions(order.status).map(next=><Button key={next} size="sm" variant={next==="cancelled"?"destructive":"outline"} disabled={updating===order.id} onClick={()=>next==="cancelled"?setCancelTarget(order):void changeStatus(order.id,next)}>{updating===order.id?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:null}{next}</Button>)}{order.status === "delivered" && order.payment_method === "cod" && order.payment_status === "cod_due" && <Button size="sm" disabled={updating===order.id} onClick={()=>void recordCodCollection(order.id)}>{updating===order.id?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:null}Mark COD collected</Button>}</div></div>{order.cod_collected_at && <p className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-emerald-600"/>Collected {new Date(order.cod_collected_at).toLocaleString()}</p>}</CardContent></Card>)}
    <AlertDialog open={!!cancelTarget} onOpenChange={open=>{if(!open && !updating) setCancelTarget(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            {cancelTarget ? `Order ${cancelTarget.order_number} will be cancelled. The order status and inventory will be updated by the server. This action cannot be undone from this page.` : "This action cannot be undone from this page."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!updating}>Keep order</AlertDialogCancel>
          <AlertDialogAction disabled={!!updating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event=>{event.preventDefault(); if(cancelTarget) void changeStatus(cancelTarget.id,"cancelled");}}>
            {cancelTarget && updating===cancelTarget.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Confirm cancellation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!selectedOrder} onOpenChange={open=>{if(!open) setSelectedOrder(null);}}>
      <AlertDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Order details</AlertDialogTitle>
          <AlertDialogDescription>{selectedOrder?.order_number} · Placed {selectedOrder ? new Date(selectedOrder.created_at).toLocaleString() : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        {selectedOrder && <div className="space-y-5">
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Order status</p><Badge className="mt-1 capitalize">{selectedOrder.status}</Badge></div>
            <div><p className="text-xs text-muted-foreground">Payment</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{String(selectedOrder.payment_method || "cod").toUpperCase()}</Badge><Badge variant={selectedOrder.payment_status === "paid" ? "default" : "secondary"}>{selectedOrder.payment_status === "paid" ? "Paid / collected" : selectedOrder.payment_status === "cod_due" ? "COD due" : selectedOrder.payment_status}</Badge></div>{selectedOrder.status === "returned" && <div className="mt-2 space-y-1 text-xs text-muted-foreground"><p>Refund status: <span className="font-medium capitalize text-foreground">{String(selectedOrder.refund_status || "not_applicable").replaceAll("_"," ")}</span></p>{selectedOrder.payment_status === "paid" && <p>Payment collected: <span className="font-medium text-foreground">₹{Number(selectedOrder.total_amount).toFixed(2)}</span></p>}{selectedOrder.refund_status === "refunded" && <><p>Refund issued: <span className="font-medium text-foreground">₹{Number(selectedOrder.refund_amount).toFixed(2)}</span></p><p>Net amount after refund: <span className="font-semibold text-foreground">₹{Math.max(0,Number(selectedOrder.total_amount)-Number(selectedOrder.refund_amount)).toFixed(2)}</span></p></>}</div>}</div>
            <div><p className="text-xs text-muted-foreground">Order total</p><p className="mt-1 text-lg font-bold">₹{Number(selectedOrder.total_amount).toFixed(2)}</p></div>
          </div>
          <section className="space-y-3"><h3 className="font-semibold">Status timeline</h3><div className="space-y-3">{["placed","confirmed","processing","shipped","delivered"].map((step,index)=>{const orderSteps=["placed","confirmed","processing","shipped","delivered"];const currentIndex=orderSteps.indexOf(selectedOrder.status === "returned" ? "delivered" : selectedOrder.status);const complete=currentIndex>=index;const timestamp=complete?(step==="placed"?selectedOrder.created_at:selectedOrderStatusHistory.find((event:any)=>event.new_value===step)?.changed_at):null;return <div key={step} className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground"}`}>{complete?<CheckCircle2 className="h-4 w-4"/>:<span className="text-xs">{index+1}</span>}</div><div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4"><div><p className="text-sm font-medium capitalize">{step}</p><p className="text-xs text-muted-foreground">{complete?"Reached":"Not reached"}</p></div>{timestamp&&<p className="text-xs text-muted-foreground sm:text-right">{new Date(timestamp).toLocaleString()}</p>}</div></div>})}{selectedOrder.status==="cancelled" && <div className="flex items-start gap-3"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><Clock3 className="h-4 w-4"/></div><div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4"><p className="text-sm font-medium">Cancelled</p><p className="text-xs text-muted-foreground">{selectedOrderStatusHistory.find((event:any)=>event.new_value==="cancelled")?.changed_at?new Date(selectedOrderStatusHistory.find((event:any)=>event.new_value==="cancelled").changed_at).toLocaleString():""}</p></div></div>}{selectedOrder.status==="returned" && <div className="flex items-start gap-3"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Clock3 className="h-4 w-4"/></div><div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4"><p className="text-sm font-medium">Returned after delivery</p><p className="text-xs text-muted-foreground">{selectedOrderStatusHistory.find((event:any)=>event.new_value==="returned")?.changed_at?new Date(selectedOrderStatusHistory.find((event:any)=>event.new_value==="returned").changed_at).toLocaleString():""}</p></div></div>}</div></section>
          <section className="space-y-3"><h3 className="font-semibold">Items</h3>{(selectedOrder.marketplace_order_items || []).map((item:any)=><div key={item.id} className="flex items-center gap-3 border-t pt-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{item.image_url?<img src={item.image_url} alt={item.product_title} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground"/></div>}</div><div className="min-w-0 flex-1"><p className="font-medium">{item.product_title}</p><p className="text-sm text-muted-foreground">Qty: {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p></div><p className="font-semibold">₹{Number(item.line_total).toFixed(2)}</p></div>)}</section>
          {selectedOrder.cod_collected_at && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>COD collected {new Date(selectedOrder.cod_collected_at).toLocaleString()}</p>}
          {selectedOrder.shipping_name && <section className="space-y-2"><h3 className="font-semibold">Shipping details</h3><div className="rounded-lg border p-4 text-sm"><p className="font-medium">{selectedOrder.shipping_name}</p><p>{selectedOrder.shipping_phone}</p><p>{selectedOrder.shipping_address}</p><p>{[selectedOrder.shipping_city,selectedOrder.shipping_state,selectedOrder.shipping_postal_code].filter(Boolean).join(", ")}</p></div></section>}
        </div>}
        <AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div></main></SellerPortalLayout>;
}