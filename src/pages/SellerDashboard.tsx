import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Store, Package, ShoppingBag, CircleDollarSign, ArrowRight, Settings, ShieldCheck, Clock3, AlertTriangle } from "lucide-react";
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
          setOrdersLoading(true);
          const { data: orderRows, error: orderError } = await db.schema("orders")
            .from("marketplace_orders")
            .select("id,order_number,status,payment_status,total_amount,created_at,marketplace_order_items(id,product_title,quantity,unit_price,line_total)")
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

        <Card className={active ? "border-primary/20" : ""}>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-semibold">Store status</p>
                <p className="text-sm text-muted-foreground">Seller tier: {seller.performance_tier}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={active ? "default" : "secondary"}>{seller.onboarding_status.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">Account: {seller.account_status}</Badge>
              <Badge variant="outline">{seller.performance_tier} tier</Badge>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Store summary">
          {[
            { label: "Products", value: "Manage listings", icon: Package, detail: "Create listings and track review status" },
            { label: "Orders", value: String(marketplaceOrders.length), icon: ShoppingBag, detail: "Marketplace orders assigned to your store" },
            { label: "Sales", value: "—", icon: CircleDollarSign, detail: "Sales reporting will appear here" },
            { label: "Store URL", value: `/shop/${seller.store_slug}`, icon: Store, detail: "Storefront route reserved for your store" },
          ].map(({ label, value, icon: Icon, detail }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="break-words text-xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common tasks for your seller account.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-between" asChild><Link to="/seller/onboarding"><span className="flex items-center"><Settings className="mr-2 h-4 w-4" /> Review store details</span><ArrowRight className="h-4 w-4" /></Link></Button>
              <Button variant="outline" className="w-full justify-between" asChild><Link to="/"><span className="flex items-center"><Store className="mr-2 h-4 w-4" /> View marketplace</span><ArrowRight className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Next up: Product management</CardTitle><CardDescription>Your seller account is ready for the next marketplace feature.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2"><Package className="h-5 w-5 text-primary" /></div><div><p className="font-medium">Create your first listing</p><p className="text-sm text-muted-foreground">Create listings with images, pricing, stock, and send them for admin approval before publication.</p></div></div>
              <Button className="w-full" asChild><Link to="/seller/products">Open My Products <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              {!active && <p className="text-xs text-muted-foreground">Product tools unlock after your seller account is approved and active.</p>}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4" aria-label="Marketplace orders">
          <div><h2 className="text-2xl font-bold">Recent marketplace orders</h2><p className="text-sm text-muted-foreground">Orders for products sold by your store.</p></div>
          {ordersLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading your orders…</CardContent></Card>
          : ordersError ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Could not load seller orders</AlertTitle><AlertDescription>{ordersError}</AlertDescription></Alert>
          : marketplaceOrders.length === 0 ? <Card><CardContent className="p-8 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No marketplace orders yet</p><p className="text-sm text-muted-foreground">New orders containing your listings will appear here.</p></CardContent></Card>
          : marketplaceOrders.map((order:any)=><Card key={order.id}><CardContent className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{order.order_number}</p><p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><Badge>{String(order.status).replaceAll("_"," ")}</Badge><p className="mt-1 font-semibold">₹{Number(order.total_amount).toFixed(2)}</p></div></div>{(order.marketplace_order_items||[]).map((item:any)=><div key={item.id} className="flex justify-between gap-3 border-t pt-3 text-sm"><div><p className="font-medium">{item.product_title}</p><p className="text-muted-foreground">Qty: {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p></div><p className="font-medium">₹{Number(item.line_total).toFixed(2)}</p></div>)}</CardContent></Card>)}
        </section>

        {seller.review_notes && <Alert><Clock3 className="h-4 w-4" /><AlertTitle>Latest review note</AlertTitle><AlertDescription>{seller.review_notes}</AlertDescription></Alert>}
      </div>
    </main>
  );
}
