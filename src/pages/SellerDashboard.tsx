import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Store, Package, ShoppingBag, CircleDollarSign, ArrowRight, Settings, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { SellerPortalLayout } from "@/components/seller/SellerPortalLayout";
import { SEOHead } from "@/components/SEOHead";

type Seller = {
  id: string; user_id: string; store_name: string; store_slug: string; contact_name: string;
  onboarding_status: string; account_status: string; performance_tier: string; review_notes: string | null;
};
const db = supabase as any;

export default function SellerDashboard() {
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [inventorySummary, setInventorySummary] = useState({lowStock:0,outOfStock:0});
  const [salesPeriod, setSalesPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth?next=/seller/dashboard", { replace: true }); return; }
      const { data, error: queryError } = await db.schema("seller").from("seller_profiles")
        .select("id,user_id,store_name,store_slug,contact_name,onboarding_status,account_status,performance_tier,review_notes")
        .eq("user_id", session.user.id).maybeSingle();
      if (!active) return;
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      if (!data) { navigate("/seller/onboarding", { replace: true }); return; }
      const row = data as Seller;
      if (row.onboarding_status === "needs_changes" || ["draft","submitted","under_review","rejected"].includes(row.onboarding_status)) {
        navigate("/seller/onboarding", { replace: true }); return;
      }
      setSeller(row);
      if (row.onboarding_status === "approved" && row.account_status === "active") {
        const { data: productRows, count, error: productError } = await db.schema("catalog").from("products")
          .select("id,status,stock_quantity", { count: "exact" }).eq("seller_id", row.id);
        if (!active) return;
        if (productError) setError(productError.message); else {
          setProductCount(count ?? 0);
          const approved = productRows || [];
          setInventorySummary({
            lowStock: approved.filter((p:any)=>p.status==="approved" && Number(p.stock_quantity)>0 && Number(p.stock_quantity)<=5).length,
            outOfStock: approved.filter((p:any)=>p.status==="approved" && Number(p.stock_quantity)===0).length
          });
        }
        setOrdersLoading(true);
        const { data: orderRows, error: orderError } = await db.schema("orders").from("marketplace_orders")
          .select("id,order_number,status,payment_status,payment_method,total_amount,refund_status,refund_amount,created_at,marketplace_order_items(id,product_title,quantity,unit_price,line_total,image_url)")
          .eq("seller_id", row.id).order("created_at", { ascending: false }).limit(1000);
        if (!active) return;
        if (orderError) setError(orderError.message); else setMarketplaceOrders(orderRows || []);
        setOrdersLoading(false);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  const salesOrders = marketplaceOrders.filter((order) => {
    if (salesPeriod === "all") return true;
    const days = salesPeriod === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(order.created_at) >= cutoff;
  });
  const grossSales = salesOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const refundsRecorded = salesOrders.filter((order) => order.refund_status === "refunded")
    .reduce((sum, order) => sum + Number(order.refund_amount || 0), 0);

  const isActive = seller?.onboarding_status === "approved" && seller?.account_status === "active";

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-muted/30"><Loader2 className="h-8 w-8 animate-spin text-primary"/></main>;
  if (!seller) return <main className="mx-auto max-w-xl p-8">{error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Could not load seller workspace</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</main>;

  return (
    <main className="min-h-screen bg-muted/30">
      <SEOHead title="Seller Dashboard | Seller Shopping Hub" description="Manage your ShopHub seller store." noindex/>
      <SellerPortalLayout storeName={seller.store_name}>
      <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-7">
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Workspace notice</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {!isActive && <Alert><AlertTriangle className="h-4 w-4"/><AlertTitle>Seller account not active</AlertTitle><AlertDescription>Your application status is {seller.onboarding_status.replaceAll("_"," ")} and account status is {seller.account_status}. Some selling features remain unavailable until your account is approved and active.</AlertDescription></Alert>}
            <section><h2 className="text-xl font-bold">Dashboard</h2><p className="text-sm text-muted-foreground">Choose a workspace to get started.</p></section>
            <section aria-label="Seller alerts" className="grid gap-3 sm:grid-cols-2">{(inventorySummary.lowStock>0||inventorySummary.outOfStock>0)&&<Card className="border-amber-500/40"><CardContent className="flex items-start gap-3 p-4"><span className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><AlertTriangle className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="font-semibold">Inventory needs attention</p><p className="text-sm text-muted-foreground">{inventorySummary.outOfStock} out of stock · {inventorySummary.lowStock} low stock (1–5 units)</p><Link to="/seller/products" className="mt-2 inline-flex items-center text-sm font-semibold text-primary">Review inventory <ArrowRight className="ml-2 h-4 w-4"/></Link></div></CardContent></Card>}{marketplaceOrders.filter(o=>["placed","confirmed"].includes(o.status)).length>0&&<Card className="border-primary/30"><CardContent className="flex items-start gap-3 p-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><ShoppingBag className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="font-semibold">Orders need attention</p><p className="text-sm text-muted-foreground">{marketplaceOrders.filter(o=>["placed","confirmed"].includes(o.status)).length} order(s) awaiting confirmation or processing.</p><Link to="/seller/orders" className="mt-2 inline-flex items-center text-sm font-semibold text-primary">Review orders <ArrowRight className="ml-2 h-4 w-4"/></Link></div></CardContent></Card>}</section><section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Seller dashboard links">
              <Link to="/seller/orders" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-primary"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Orders</CardTitle><CardDescription className="mt-1">Manage and fulfill customer orders</CardDescription></div><span className="rounded-xl bg-primary/10 p-3 text-primary"><ShoppingBag className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-3xl font-bold">{ordersLoading ? "—" : marketplaceOrders.length}</p><p className="mt-1 text-sm text-muted-foreground">Orders assigned to your store</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Open orders <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Link to="/seller/products" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-violet-500"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>My products</CardTitle><CardDescription className="mt-1">Create listings and manage stock</CardDescription></div><span className="rounded-xl bg-violet-500/10 p-3 text-violet-600"><Package className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-3xl font-bold">{productCount === null ? "—" : productCount}</p><p className="mt-1 text-sm text-muted-foreground">Product listings</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Manage products <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Link to={`/shop/${seller.store_slug}`} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full overflow-hidden border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><div className="h-1.5 bg-emerald-500"/><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Storefront</CardTitle><CardDescription className="mt-1">Preview your public seller page</CardDescription></div><span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><Store className="h-6 w-6"/></span></CardHeader><CardContent><p className="break-all text-lg font-bold">/shop/{seller.store_slug}</p><p className="mt-1 text-sm text-muted-foreground">Your customer-facing store</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Open storefront <ExternalLink className="ml-2 h-4 w-4"/></p></CardContent></Card></Link>
              <Link to="/seller/onboarding" className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full border-border/70 transition-all group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Store details</CardTitle><CardDescription className="mt-1">Update your seller information</CardDescription></div><span className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><Settings className="h-6 w-6"/></span></CardHeader><CardContent><p className="text-sm text-muted-foreground">Account: {seller.account_status}</p><p className="mt-1 text-sm text-muted-foreground">Seller tier: {seller.performance_tier}</p><p className="mt-5 inline-flex items-center text-sm font-semibold text-primary">Review details <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"/></p></CardContent></Card></Link>
              <Card className="border-border/70"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle>Sales overview</CardTitle><CardDescription className="mt-1">Order value after recorded refunds</CardDescription></div><span className="rounded-xl bg-sky-500/10 p-3 text-sky-600"><CircleDollarSign className="h-6 w-6"/></span></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Sales date range"><Button type="button" size="sm" variant={salesPeriod==="7d"?"default":"outline"} onClick={()=>setSalesPeriod("7d")}>7 days</Button><Button type="button" size="sm" variant={salesPeriod==="30d"?"default":"outline"} onClick={()=>setSalesPeriod("30d")}>30 days</Button><Button type="button" size="sm" variant={salesPeriod==="all"?"default":"outline"} onClick={()=>setSalesPeriod("all")}>All time</Button></div><p className="text-xs text-muted-foreground">{salesPeriod==="7d"?"Last 7 days":salesPeriod==="30d"?"Last 30 days":"All loaded order history"}</p><div><p className="text-xs text-muted-foreground">Gross order value</p><p className="text-xl font-bold">₹{grossSales.toFixed(2)}</p></div><div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Refunds recorded</span><span className="font-medium">−₹{refundsRecorded.toFixed(2)}</span></div><div className="border-t pt-3"><p className="text-xs text-muted-foreground">Net order value after refunds</p><p className="text-2xl font-bold">₹{Math.max(0,grossSales-refundsRecorded).toFixed(2)}</p></div><p className="text-xs text-muted-foreground">Order value, not seller payout or profit. Refunds are deducted only when marked refunded.</p><Link to="/seller/orders" className="inline-flex items-center text-sm font-semibold text-primary">Review orders <ArrowRight className="ml-2 h-4 w-4"/></Link></CardContent></Card>
            </section>
            {seller.review_notes && <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Latest review note</AlertTitle><AlertDescription>{seller.review_notes}</AlertDescription></Alert>}
          </div>

      </SellerPortalLayout>    </main>
  );
}
