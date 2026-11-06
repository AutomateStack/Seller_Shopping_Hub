import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SellerPortalLayout } from "@/components/seller/SellerPortalLayout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Plus, RefreshCw, Truck } from "lucide-react";

const db = supabase as any;
type Address = {
  id: string; seller_id: string; address_type: string; contact_name: string;
  contact_phone: string; address_line1: string; address_line2: string | null;
  city: string; state: string; postal_code: string; country_code: string;
  is_default: boolean; review_status: string; review_note: string | null;
  created_at: string;
};
const empty = {
  contact_name: "", contact_phone: "", address_line1: "", address_line2: "",
  city: "", state: "", postal_code: "", country_code: "IN",
};

export default function SellerPickupAddresses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sellerId, setSellerId] = useState("");
  const [rows, setRows] = useState<Address[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth?next=/seller/pickup-addresses", { replace: true }); return; }
    const { data: seller, error: sellerError } = await db.schema("seller").from("seller_profiles")
      .select("id,onboarding_status,account_status").eq("user_id", session.user.id).maybeSingle();
    if (sellerError || !seller) {
      toast({ title: "Seller profile unavailable", description: sellerError?.message || "Complete seller onboarding first.", variant: "destructive" });
      setLoading(false); return;
    }
    if (seller.onboarding_status !== "approved" || seller.account_status !== "active") {
      navigate("/seller/onboarding", { replace: true }); return;
    }
    setSellerId(seller.id);
    const { data, error } = await db.schema("seller").from("seller_addresses")
      .select("id,seller_id,address_type,contact_name,contact_phone,address_line1,address_line2,city,state,postal_code,country_code,is_default,review_status,review_note,created_at")
      .eq("seller_id", seller.id).eq("address_type", "pickup").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load pickup addresses", description: error.message, variant: "destructive" });
    else setRows(data || []);
    setLoading(false);
  }, [navigate, toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sellerId) return;
    if (!/^\\d{6}$/.test(form.postal_code.trim())) {
      toast({ title: "Check the PIN code", description: "Enter a valid 6-digit Indian PIN code.", variant: "destructive" }); return;
    }
    if (form.contact_phone.replace(/\\D/g, "").length < 10) {
      toast({ title: "Check the contact phone", description: "Enter a phone number with at least 10 digits.", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await db.schema("seller").from("seller_addresses").insert({
      seller_id: sellerId, address_type: "pickup", ...form,
      address_line2: form.address_line2.trim() || null,
      contact_name: form.contact_name.trim(), contact_phone: form.contact_phone.trim(),
      address_line1: form.address_line1.trim(), city: form.city.trim(),
      state: form.state.trim(), postal_code: form.postal_code.trim(),
      country_code: "IN", is_default: rows.length === 0,
    });
    setSaving(false);
    if (error) toast({ title: "Could not save pickup address", description: error.message, variant: "destructive" });
    else { setForm(empty); toast({ title: "Pickup address submitted", description: "The operations team will review it before registering it with Delhivery." }); await load(); }
  };

  const remove = async (id: string) => {
    const { error } = await db.schema("seller").from("seller_addresses").delete().eq("id", id);
    if (error) toast({ title: "Could not remove address", description: error.message, variant: "destructive" });
    else { toast({ title: "Pickup address removed" }); await load(); }
  };

  return <SellerPortalLayout><main className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
    <SEOHead title="Pickup addresses | Seller Shopping Hub" description="Manage seller pickup addresses." noindex />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Pickup addresses</h1><p className="text-sm text-muted-foreground">Add the physical locations from which Delhivery will collect your marketplace orders.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add pickup address</CardTitle><CardDescription>Every address is reviewed by Seller Shopping Hub before it is registered as a Delhivery pickup location.</CardDescription></CardHeader>
      <CardContent><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {([["contact_name","Contact person"],["contact_phone","Contact phone"],["address_line1","Address line 1"],["address_line2","Address line 2 (optional)"],["city","City"],["state","State"],["postal_code","PIN code"]] as const).map(([key,label]) => <div key={key} className={key.startsWith("address") ? "sm:col-span-2 space-y-2" : "space-y-2"}><Label htmlFor={key}>{label}{key !== "address_line2" ? " *" : ""}</Label><Input id={key} value={form[key]} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} required={key !== "address_line2"} maxLength={key === "postal_code" ? 6 : 180} disabled={saving} /></div>)}
        <div className="sm:col-span-2"><Button type="submit" disabled={saving || !sellerId}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit pickup address for review</Button></div>
      </form></CardContent>
    </Card>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Your pickup locations</h2>
      {loading ? <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin" /></div> : rows.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground"><MapPin className="mx-auto mb-2 h-8 w-8" />No pickup addresses added yet.</CardContent></Card> : rows.map(address => <Card key={address.id}><CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="font-semibold">{address.contact_name}</p><Badge variant={address.review_status === "approved" ? "default" : address.review_status === "rejected" ? "destructive" : "secondary"}>{address.review_status.replaceAll("_", " ")}</Badge></div><p className="text-sm">{address.address_line1}{address.address_line2 ? ", " + address.address_line2 : ""}</p><p className="text-sm">{address.city}, {address.state} - {address.postal_code}</p><p className="text-sm text-muted-foreground">{address.contact_phone}</p>{address.review_note && <p className="mt-2 text-sm text-amber-700">Admin note: {address.review_note}</p>}</div>
        {address.review_status !== "approved" && <Button variant="outline" size="sm" onClick={() => void remove(address.id)}>Remove</Button>}
      </CardContent></Card>)}
    </section>
    <p className="text-sm text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4" />Delhivery warehouse registration is handled automatically by operations after approval. You do not need to create a warehouse in Delhivery yourself.</p>
    <div><Button variant="ghost" asChild><Link to="/seller/dashboard">Back to seller dashboard</Link></Button></div>
  </main></SellerPortalLayout>;
}
