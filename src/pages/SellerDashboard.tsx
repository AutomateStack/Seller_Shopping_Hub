import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Store, Package, ShoppingBag, CircleDollarSign, ArrowRight, Settings, ShieldCheck, AlertTriangle, ExternalLink, LayoutDashboard, LogOut } from "lucide-react";
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

  const goToOrders = () => navigate("/seller/orders");
  const signOut = async () => { await supabase.auth.signOut(); navigate("/"); };

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
    return (
    <main className="min-h-screen bg-muted/30">
      <SEOHead title="Seller Dashboard | Seller Shopping Hub" description="Manage your ShopHub seller store." noindex />
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-card lg:flex lg:min-h-screen lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b px-5"><div className="rounded-xl bg-primary p-2 text-primary-foreground"><Store className="h-5 w-5"/></div><div><p className="font-bold">ShopHub</p><p className="text-xs text-muted-foreground">Seller portal</p></div></div>
          <div className="border-b px-5 py-4"><p className="truncate font-semibold">{seller.store_name}</p><p className="mt-1 text-xs text-muted-foreground">Seller workspace</p></div>
          <nav className="flex-1 space-y-1 p-3" aria-label="Seller navigation">
            <Link to="/seller/dashboard" className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"><LayoutDashboard className="h-4 w-4"/>Dashboard</Link>
            <Link to="/seller/orders" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><ShoppingBag className="h-4 w-4"/>Orders <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">{marketplaceOrders.length}</span></Link>
            <Link to="/seller/products" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Package className="h-4 w-4"/>My products</Link>
            <Link to={`/shop/${seller.store_slug}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Store className="h-4 w-4"/>Storefront</Link>
            <Link to="/seller/onboarding" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><Settings className="h-4 w-4"/>Store details</Link>
          </nav>
          <div className="space-y-1 border-t p-3"><Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"><ExternalLink className="h-4 w-4"/>View marketplace</Link><button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"><LogOut className="h-4 w-4"/>Sign out</button></div>
        </aside>
        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-4 sm:px-7"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary lg:hidden"><Store className="h-5 w-5"/></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seller portal</p><h1 className="text-2xl font-bold">{seller.store_name}</h1></div></div><div className="flex flex-wrap gap-2"><Badge variant={active?"default":"secondary"}>{seller.onboarding_status.replaceAll("_"," ")}</Badge><Button variant="outline" size="sm" asChild><Link to="/seller/onboarding"><Settings className="mr-2 h-4 w-4"/>Store details</Link></Button></div></header>
          <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-7">
            {!active && <Alert><AlertTriangle className="h-4 w-4"/><AlertTitle>Seller account not active</AlertTitle><AlertDescription>Your application status is {seller.onboarding_status.replaceAll("_"," ")} and account status is {seller.account_status}. Some selling features remain unavailable until your account is approved and active.</AlertDescription></Alert>}
            <section><h2 className="text-xl font-bold">Dashboard</h2><p className="text-sm text-muted-foreground">Choose a workspace to get started.</p></section>
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Seller dashboard links">
              <Link to="/seller/orders" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-primary"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Orders</CardTitle><CardDescription className="mt-1">Manage and fulfill customer orders</CardDescription></div><span className="rounded-xl bg-primary/10 p-3 text-primary"><ShoppingBag className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-3xl font-bold">{ordersLoading?"—":marketplaceOrders.length}</p><p className="mt-1 text-sm text-muted-foreground">Orders assigned to your store</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Open orders <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Link to="/seller/products" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-violet-500"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>My products</CardTitle><CardDescription className="mt-1">Create listings and manage stock</CardDescription></div><span className="rounded-xl bg-violet-500/10 p-3 text-violet-600"><Package className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-3xl font-bold">{productCount===null?"—":productCount}</p><p className="mt-1 text-sm text-muted-foreground">Product listings</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Manage products <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Link to={`/shop/${seller.store_slug}`} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-emerald-500"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Storefront</CardTitle><CardDescription className="mt-1">Preview your public seller page</CardDescription></div><span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><Store className="h-6 w-6"/></span></CardHeader><CardContent><p className="break-all text-lg font-bold">/shop/{seller.store_slug}</p><p className="mt-1 text-sm text-muted-foreground">Your customer-facing store</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Open storefront <ExternalLink className="ml-2 h-4 w-4"/></p></CardContent></Card></Link>
              <Link to="/seller/onboarding" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Store details</CardTitle><CardDescription className="mt-1">Update your seller information</CardDescription></div><span className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><Settings className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-sm text-muted-foreground">Account: {seller.account_status}</p><p className="mt-1 text-sm text-muted-foreground">Seller tier: {seller.performance_tier}</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Review details <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Card className="border-border/70"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Sales</CardTitle><CardDescription className="mt-1">Sales reporting</CardDescription></div><span className="rounded-xl bg-sky-500/10 p-3 text-sky-600"><CircleDollarSign className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-2xl font-bold">Coming soon</p><p className="mt-1 text-sm text-muted-foreground">Sales analytics will be available here.</p></CardContent></Card>
            </section>
            {seller.review_notes && <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Latest review note</AlertTitle><AlertDescription>{seller.review_notes}</AlertDescription></Alert>}
          </div>
        </div>
      </div>
    </main>
  );}
