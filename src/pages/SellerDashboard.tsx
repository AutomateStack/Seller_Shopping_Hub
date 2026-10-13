import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Store, Package, ShoppingBag, CircleDollarSign, ArrowRight, Settings, ShieldCheck, Clock3, AlertTriangle, ExternalLink, Truck, CheckCircle2, Plus, LayoutDashboard } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

type Seller = {
  id: string;
  user_id: string;
  store_name: string;
  store_slug: string;
  contact_name: string;
  onboarding_status: string;
  account_status: string;
  performance_tier: string;
  review_notes: string | null;
};

const db = supabase as any;

export default function SellerDashboard() {
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderUpdateError, setOrderUpdateError] = useState("");
  const [orderTab, setOrderTab] = useState("pending");
  const [productCount, setProductCount] = useState<number | null>(null);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    setOrderUpdateError("");
    const { error } = await db.rpc("update_marketplace_order_status", { p_order_id: orderId, p_status: status });
    setUpdatingOrderId(null);
    if (error) { setOrderUpdateError(error.message); return; }
    const { data, error: refreshError } = await db.schema("orders").from("marketplace_orders")
      .select("id,order_number,status,payment_status,total_amount,created_at,marketplace_order_items(id,product_title,quantity,unit_price,line_total,image_url)")
      .eq("seller_id", seller?.id || "").order("created_at", { ascending: false }).limit(20);
    if (refreshError) setOrdersError(refreshError.message);
    else setMarketplaceOrders(data || []);
  };

  const goToOrders = () => document.getElementById("marketplace-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const visibleOrders = marketplaceOrders.filter((order: any) => {
    if (orderTab === "all") return true;
    if (orderTab === "pending") return ["placed", "confirmed"].includes(order.status);
    if (orderTab === "ready") return order.status === "processing";
    if (orderTab === "shipped") return order.status === "shipped";
    if (orderTab === "delivered") return order.status === "delivered";
    return false;
  });

  const sellerNextStatuses = (status: string) => ({
    placed: ["confirmed", "cancelled"], confirmed: ["processing", "cancelled"],
    processing: ["shipped"], shipped: ["delivered"],
  } as Record<string, string[]>)[status] || [];

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?next=/seller/dashboard", { replace: true });
        return;
      }

      const { data, error: queryError } = await db.schema("seller")
        .from("seller_profiles")
        .select("id,user_id,store_name,store_slug,contact_name,onboarding_status,account_status,performance_tier,review_notes")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
      } else if (!data) {
        navigate("/seller/onboarding", { replace: true });
        return;
      } else {
        const row = data as Seller;
        setSeller(row);
        if (row.onboarding_status === "approved" && row.account_status === "active") {
          const { count: productsTotal } = await db.schema("catalog").from("products").select("id", { count: "exact", head: true }).eq("seller_id", row.id);
          setProductCount(productsTotal ?? 0);
          setOrdersLoading(true);
          const { data: orderRows, error: orderError } = await db.schema("orders")
            .from("marketplace_orders")
            .select("id,order_number,status,payment_status,total_amount,created_at,marketplace_order_items(id,product_title,quantity,unit_price,line_total,image_url)")
            .eq("seller_id", row.id)
            .order("created_at", { ascending: false })
            .limit(20);
          if (orderError) setOrdersError(orderError.message);
          else setMarketplaceOrders(orderRows || []);
          setOrdersLoading(false);
        }
        if (row.onboarding_status === "needs_changes" || ["draft", "submitted", "under_review", "rejected"].includes(row.onboarding_status)) {
          navigate("/seller/onboarding", { replace: true });
          return;
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Loading seller dashboard</span></div>;

  if (error) return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Unable to load your seller dashboard</AlertTitle><AlertDescription>{error}. Please refresh or contact support if this continues.</AlertDescription></Alert>
      <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Retry</Button>
    </main>
  );

  if (!seller) return null;

  const active = seller.account_status === "active" && seller.onboarding_status === "approved";

  return (
    <main className="min-h-screen bg-background">
      <SEOHead title="Seller Dashboard | Seller Shopping Hub" description="Manage your ShopHub seller store." noindex />
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><Store className="h-7 w-7 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">SELLER PORTAL</p>
              <h1 className="text-3xl font-bold">{seller.store_name}</h1>
              <p className="mt-1 text-muted-foreground">Welcome, {seller.contact_name}. Manage your marketplace store here.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/seller/onboarding"><Settings className="mr-2 h-4 w-4" /> Store details</Link></Button>
            <Button variant="outline" asChild><Link to="/"><ArrowRight className="mr-2 h-4 w-4" /> View marketplace</Link></Button>
          </div>
        </div>

        {!active && <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Seller account not active</AlertTitle><AlertDescription>Your application status is {seller.onboarding_status.replaceAll("_", " ")} and account status is {seller.account_status}. Some selling features remain unavailable until your account is approved and active.</AlertDescription></Alert>}

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/15 p-3"><ShieldCheck className="h-6 w-6 text-primary"/></div><div><p className="font-semibold">Your seller workspace</p><p className="text-sm text-muted-foreground">Manage listings, fulfill orders, and keep your store up to date.</p></div></div><div className="flex flex-wrap gap-2"><Badge variant={active ? "default" : "secondary"}>{seller.onboarding_status.replaceAll("_"," ")}</Badge><Badge variant="outline">Account: {seller.account_status}</Badge><Badge variant="outline">{seller.performance_tier} tier</Badge></div></CardContent></Card>
        <section className="space-y-4" aria-label="Seller workspace navigation">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold">Workspace overview</h2><p className="text-sm text-muted-foreground">Shortcuts to the tools you use most.</p></div><Button variant="outline" size="sm" asChild><Link to="/"><Store className="mr-2 h-4 w-4"/>View marketplace</Link></Button></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/seller/products" className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full border-border/70 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm font-medium">Products</CardTitle><span className="rounded-lg bg-primary/10 p-2 text-primary"><Package className="h-5 w-5"/></span></CardHeader><CardContent><p className="text-2xl font-bold">{productCount === null ? "—" : productCount}</p><p className="mt-1 text-sm text-muted-foreground">Your product listings</p><p className="mt-4 inline-flex items-center text-sm font-medium text-primary">Manage products <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
            <button type="button" onClick={goToOrders} className="group rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full border-border/70 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm font-medium">Orders</CardTitle><span className="rounded-lg bg-primary/10 p-2 text-primary"><ShoppingBag className="h-5 w-5"/></span></CardHeader><CardContent><p className="text-2xl font-bold">{marketplaceOrders.length}</p><p className="mt-1 text-sm text-muted-foreground">Orders assigned to your store</p><p className="mt-4 inline-flex items-center text-sm font-medium text-primary">Manage orders <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></button>
            <Card className="h-full border-border/70"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm font-medium">Sales</CardTitle><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><CircleDollarSign className="h-5 w-5"/></span></CardHeader><CardContent><p className="text-2xl font-bold">—</p><p className="mt-1 text-sm text-muted-foreground">Sales analytics</p><p className="mt-4 text-xs text-muted-foreground">Reporting coming soon</p></CardContent></Card>
            <Link to={`/shop/${seller.store_slug}`} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full border-border/70 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm font-medium">Storefront</CardTitle><span className="rounded-lg bg-primary/10 p-2 text-primary"><Store className="h-5 w-5"/></span></CardHeader><CardContent><p className="break-all text-lg font-bold">/shop/{seller.store_slug}</p><p className="mt-1 text-sm text-muted-foreground">Your public store page</p><p className="mt-4 inline-flex items-center text-sm font-medium text-primary">Open storefront <ExternalLink className="ml-1 h-4 w-4"/></p></CardContent></Card></Link>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Order status overview">
          {[{label:"Pending",count:marketplaceOrders.filter((o:any)=>["placed","confirmed"].includes(o.status)).length,icon:Clock3,tab:"pending"},{label:"Ready to dispatch",count:marketplaceOrders.filter((o:any)=>o.status==="processing").length,icon:Package,tab:"ready"},{label:"Shipped",count:marketplaceOrders.filter((o:any)=>o.status==="shipped").length,icon:Truck,tab:"shipped"},{label:"Delivered",count:marketplaceOrders.filter((o:any)=>o.status==="delivered").length,icon:CheckCircle2,tab:"delivered"}].map(({label,count,icon:Icon,tab})=><button type="button" key={label} onClick={()=>{setOrderTab(tab);goToOrders();}} className="rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="text-2xl font-bold">{count}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground"/></CardContent></Card></button>)}
        </section>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-label="Quick actions"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><LayoutDashboard className="h-5 w-5"/></div><div><h2 className="font-semibold">Quick actions</h2><p className="text-sm text-muted-foreground">Jump straight into a task.</p></div></div><div className="flex flex-wrap gap-2"><Button asChild><Link to="/seller/products"><Plus className="mr-2 h-4 w-4"/>Add a product</Link></Button><Button variant="outline" onClick={goToOrders}><ShoppingBag className="mr-2 h-4 w-4"/>Review orders</Button><Button variant="outline" asChild><Link to="/seller/onboarding"><Settings className="mr-2 h-4 w-4"/>Store details</Link></Button></div></section>
        <section id="marketplace-orders" className="scroll-mt-6 space-y-4" aria-label="Marketplace orders">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-2xl font-bold">Orders</h2><p className="text-sm text-muted-foreground">Manage fulfillment from confirmation to delivery.</p></div><Badge variant="outline">{marketplaceOrders.length} total</Badge></div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders">{[{id:"pending",label:"Pending",count:marketplaceOrders.filter((o:any)=>["placed","confirmed"].includes(o.status)).length},{id:"ready",label:"Ready to dispatch",count:marketplaceOrders.filter((o:any)=>o.status==="processing").length},{id:"shipped",label:"Shipped",count:marketplaceOrders.filter((o:any)=>o.status==="shipped").length},{id:"delivered",label:"Delivered",count:marketplaceOrders.filter((o:any)=>o.status==="delivered").length},{id:"all",label:"All orders",count:marketplaceOrders.length}].map(tab=><Button key={tab.id} type="button" role="tab" aria-selected={orderTab===tab.id} variant={orderTab===tab.id?"default":"outline"} size="sm" onClick={()=>setOrderTab(tab.id)}>{tab.label}<span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{tab.count}</span></Button>)}</div>
          {orderUpdateError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Order status not updated</AlertTitle><AlertDescription>{orderUpdateError}</AlertDescription></Alert>}
          {ordersLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading your orders…</CardContent></Card> : ordersError ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Could not load seller orders</AlertTitle><AlertDescription>{ordersError}</AlertDescription></Alert> : marketplaceOrders.length === 0 ? <Card><CardContent className="p-8 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No marketplace orders yet</p><p className="text-sm text-muted-foreground">New orders containing your listings will appear here.</p></CardContent></Card> : visibleOrders.length === 0 ? <Card><CardContent className="p-8 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No orders in this section</p><p className="text-sm text-muted-foreground">Orders will appear here as their status changes.</p></CardContent></Card> : visibleOrders.map((order:any)=><Card key={order.id}><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{order.order_number}</p><p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><Badge>{String(order.status).replaceAll("_"," ")}</Badge><p className="mt-1 font-semibold">₹{Number(order.total_amount).toFixed(2)}</p><div className="mt-2 flex flex-wrap justify-end gap-2">{sellerNextStatuses(order.status).map((status:string)=><Button key={status} size="sm" variant={status==="cancelled"?"destructive":"outline"} disabled={updatingOrderId===order.id} onClick={()=>void updateOrderStatus(order.id,status)}>{updatingOrderId===order.id?"Updating…":status.replaceAll("_"," ")}</Button>)}</div></div></div>{(order.marketplace_order_items||[]).map((item:any)=><div key={item.id} className="flex items-center gap-3 border-t pt-3 text-sm"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{item.image_url ? <img src={item.image_url} alt={item.product_title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}</div><div className="min-w-0 flex-1"><p className="font-medium">{item.product_title}</p><p className="text-muted-foreground">Qty: {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p></div><p className="font-medium">₹{Number(item.line_total).toFixed(2)}</p></div>)}</CardContent></Card>)}
        </section>

        {seller.review_notes && <Alert><Clock3 className="h-4 w-4" /><AlertTitle>Latest review note</AlertTitle><AlertDescription>{seller.review_notes}</AlertDescription></Alert>}
      </div>
    </main>
  );
}
