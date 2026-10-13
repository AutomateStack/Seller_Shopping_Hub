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
            { label: "Products", value: "Not launched", icon: Package, detail: "Product management is the next feature" },
            { label: "Orders", value: "—", icon: ShoppingBag, detail: "Order management is not enabled yet" },
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
              <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2"><Package className="h-5 w-5 text-primary" /></div><div><p className="font-medium">Create your first listing</p><p className="text-sm text-muted-foreground">Product creation, image uploads, pricing, inventory, and product approval are planned next.</p></div></div>
              <Button disabled={!active} className="w-full" onClick={() => navigate("/seller/products")}>Go to My Products <ArrowRight className="ml-2 h-4 w-4" /></Button>
              {!active && <p className="text-xs text-muted-foreground">Product tools unlock after your seller account is approved and active.</p>}
            </CardContent>
          </Card>
        </section>

        {seller.review_notes && <Alert><Clock3 className="h-4 w-4" /><AlertTitle>Latest review note</AlertTitle><AlertDescription>{seller.review_notes}</AlertDescription></Alert>}
      </div>
    </main>
  );
}
