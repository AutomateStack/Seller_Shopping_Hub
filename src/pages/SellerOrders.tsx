import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Package, ShoppingBag, AlertTriangle, Loader2 } from "lucide-react";
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
  const load = async (id: string) => {
    const { data, error } = await db.schema("orders").from("marketplace_orders")
      .select("id,order_number,status,payment_method,payment_status,cod_collected_at,total_amount,created_at,marketplace_order_items(id,product_title,quantity,unit_price,line_total,image_url)")
      .eq("seller_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) setError(error.message); else setOrders(data || []);
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
    if (error) setError(error.message); else await load(sellerId);
    setUpdating(""); 
  };
  const recordCodCollection = async (orderId: string) => {
    setUpdating(orderId); setError("");
    const { error } = await db.rpc("record_marketplace_cod_collection", { p_order_id: orderId });
    if (error) setError(error.message); else await load(sellerId);
    setUpdating("");
  };
  const filtered = orders.filter(o => tab === "all" || (tab === "pending" && ["placed","confirmed"].includes(o.status)) || (tab === "ready" && o.status === "processing") || (tab === "shipped" && o.status === "shipped") || (tab === "delivered" && o.status === "delivered"));
  const tabs = [{id:"pending",label:"Pending",count:orders.filter(o=>["placed","confirmed"].includes(o.status)).length},{id:"ready",label:"Ready to dispatch",count:orders.filter(o=>o.status==="processing").length},{id:"shipped",label:"Shipped",count:orders.filter(o=>o.status==="shipped").length},{id:"delivered",label:"Delivered",count:orders.filter(o=>o.status==="delivered").length},{id:"all",label:"All orders",count:orders.length}];
  return <SellerPortalLayout><main className="min-h-screen bg-background"><SEOHead title="Seller Orders | Seller Shopping Hub" description="Manage seller orders." noindex/><div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Button variant="ghost" size="sm" asChild><Link to="/seller/dashboard"><ArrowLeft className="mr-2 h-4 w-4"/>Seller dashboard</Link></Button><h1 className="mt-2 text-3xl font-bold">Orders</h1><p className="text-sm text-muted-foreground">Manage orders from confirmation through delivery.</p></div><Badge variant="outline">{orders.length} total orders</Badge></div>
    <div className="flex flex-wrap gap-2">{tabs.map(t=><Button key={t.id} variant={tab===t.id?"default":"outline"} size="sm" onClick={()=>setTab(t.id)}>{t.label}<span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{t.count}</span></Button>)}</div>
    {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Orders</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin"/></div> : filtered.length === 0 ? <Card><CardContent className="p-10 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No orders in this section</p><p className="text-sm text-muted-foreground">Orders will appear here as buyers place them.</p></CardContent></Card> : filtered.map(order=><Card key={order.id}><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{order.order_number}</p><p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><Badge>{order.status}</Badge><p className="mt-1 font-semibold">₹{Number(order.total_amount).toFixed(2)}</p><div className="mt-1 flex flex-wrap justify-end gap-1"><Badge variant="outline">{String(order.payment_method || "cod").toUpperCase()}</Badge><Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>{order.payment_status === "paid" ? "Paid" : order.payment_status === "cod_due" ? "COD due" : order.payment_status}</Badge></div><div className="mt-2 flex flex-wrap justify-end gap-2">{actions(order.status).map(next=><Button key={next} size="sm" variant={next==="cancelled"?"destructive":"outline"} disabled={updating===order.id} onClick={()=>void changeStatus(order.id,next)}>{updating===order.id?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:null}{next}</Button>)}{order.status === "delivered" && order.payment_method === "cod" && order.payment_status === "cod_due" && <Button size="sm" disabled={updating===order.id} onClick={()=>void recordCodCollection(order.id)}>{updating===order.id?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:null}Mark COD collected</Button>}</div>{order.cod_collected_at && <p className="mt-1 text-xs text-muted-foreground">Collected {new Date(order.cod_collected_at).toLocaleString()}</p>}</div></div>{(order.marketplace_order_items||[]).map((item:any)=><div key={item.id} className="flex items-center gap-3 border-t pt-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{item.image_url?<img src={item.image_url} alt={item.product_title} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground"/></div>}</div><div className="min-w-0 flex-1"><p className="font-medium">{item.product_title}</p><p className="text-sm text-muted-foreground">Qty: {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p></div><p className="text-sm font-semibold">₹{Number(item.line_total).toFixed(2)}</p></div>)}</CardContent></Card>)}
  </div></main></SellerPortalLayout>;
}