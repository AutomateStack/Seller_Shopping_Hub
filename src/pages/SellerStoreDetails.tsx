import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SellerPortalLayout } from "@/components/seller/SellerPortalLayout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Send, ShieldCheck, Store } from "lucide-react";

const db = supabase as any;
type Seller = {
  id: string; store_name: string; store_slug: string; contact_name: string;
  contact_email: string | null; contact_phone: string | null; business_type: string;
  business_name: string | null; gstin: string | null; onboarding_status: string; account_status: string;
};
type ChangeRequest = {
  id: string; proposed_store_name: string; proposed_business_name: string | null;
  proposed_business_type: string; proposed_gstin: string | null; status: string;
  review_note: string | null; submitted_at: string; reviewed_at: string | null;
};

const businessTypes = [
  { value: "individual", label: "Individual" },
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "LLP" },
  { value: "private_limited", label: "Private limited" },
  { value: "other", label: "Other" },
];
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function SellerStoreDetails() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("individual");
  const [gstin, setGstin] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [submittingChanges, setSubmittingChanges] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth?next=/seller/store-details", { replace: true }); return; }
    const { data, error } = await db.schema("seller").from("seller_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
    if (error) { toast({ title: "Could not load store details", description: error.message, variant: "destructive" }); setLoading(false); return; }
    if (!data) { navigate("/seller/onboarding", { replace: true }); return; }
    if (data.onboarding_status !== "approved" || data.account_status !== "active") {
      navigate("/seller/onboarding", { replace: true }); return;
    }
    const row = data as Seller;
    setSeller(row);
    setContactName(row.contact_name ?? "");
    setPhone(row.contact_phone ?? "");
    setStoreName(row.store_name ?? "");
    setBusinessName(row.business_name ?? "");
    setBusinessType(row.business_type ?? "individual");
    setGstin(row.gstin ?? "");
    const { data: changeRows, error: requestError } = await db.schema("seller").from("profile_change_requests")
      .select("id,proposed_store_name,proposed_business_name,proposed_business_type,proposed_gstin,status,review_note,submitted_at,reviewed_at")
      .eq("seller_id", row.id).order("submitted_at", { ascending: false }).limit(10);
    if (requestError) toast({ title: "Could not load change request history", description: requestError.message, variant: "destructive" });
    setRequests((changeRows ?? []) as ChangeRequest[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [navigate]);

  const pendingRequest = requests.some(request => request.status === "pending");
  const saveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingContact(true);
    const { error } = await db.rpc("update_seller_contact_details", {
      p_contact_name: contactName.trim(), p_contact_phone: phone.trim(),
    });
    setSavingContact(false);
    if (error) { toast({ title: "Contact details not saved", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact details updated", description: "Your contact person and phone number are now saved." });
    setSeller(current => current ? { ...current, contact_name: contactName.trim(), contact_phone: phone.trim() || null } : current);
  };

  const submitBusinessChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingRequest) return;
    const normalizedGstin = gstin.trim().toUpperCase();
    if (normalizedGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizedGstin)) {
      toast({ title: "Check the GSTIN format", description: "Enter a valid 15-character GSTIN format, or leave it blank.", variant: "destructive" }); return;
    }
    setSubmittingChanges(true);
    const { error } = await db.rpc("submit_seller_profile_change_request", {
      p_store_name: storeName.trim(), p_business_name: businessName.trim(),
      p_business_type: businessType, p_gstin: normalizedGstin,
    });
    setSubmittingChanges(false);
    if (error) { toast({ title: "Could not submit changes", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Business changes sent for review", description: "Your current approved details remain active until an admin approves the request." });
    await load();
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  if (!seller) return null;

  return <main className="min-h-screen bg-muted/30">
    <SEOHead title="Store details | Seller Shopping Hub" description="Manage your approved seller store and business details." noindex />
    <SellerPortalLayout storeName={seller.store_name}>
      <div id="main-content" className="mx-auto max-w-5xl space-y-6 p-4 sm:p-7">
        <Button variant="ghost" asChild><Link to="/seller/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Link></Button>
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3"><Store className="h-6 w-6 text-primary" /></div><div><h1 className="text-2xl font-bold">Store details</h1><p className="text-muted-foreground">Update contact information directly and submit business identity changes for review.</p></div></div>

        <Card>
          <CardHeader><CardTitle>Contact information</CardTitle><CardDescription>These updates take effect immediately and do not require admin review.</CardDescription></CardHeader>
          <CardContent><form onSubmit={saveContact} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="contact-name">Contact person *</Label><Input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} required minLength={2} maxLength={120} disabled={savingContact} /></div>
            <div className="space-y-2"><Label htmlFor="contact-phone">Contact phone</Label><Input id="contact-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} disabled={savingContact} placeholder="+91..." /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="account-email">Account email</Label><Input id="account-email" value={seller.contact_email ?? ""} readOnly disabled /><p className="text-xs text-muted-foreground">Account email is read-only here.</p></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={savingContact}>{savingContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save contact details</Button></div>
          </form></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Store and registered business identity</CardTitle><CardDescription>These details are shown to customers or used for business verification. Changes only become official after admin approval.</CardDescription></CardHeader>
          <CardContent><form onSubmit={submitBusinessChanges} className="space-y-4">
            {pendingRequest && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Changes awaiting review</AlertTitle><AlertDescription>Your current approved information remains active. You can submit another request after this one is reviewed.</AlertDescription></Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="store-name">Store name *</Label><Input id="store-name" value={storeName} onChange={e => setStoreName(e.target.value)} required minLength={2} maxLength={120} disabled={pendingRequest || submittingChanges} /></div>
              <div className="space-y-2"><Label htmlFor="store-url">Current public store URL</Label><Input id="store-url" value={seller.store_slug ? `/store/${seller.store_slug}` : "Not set"} readOnly disabled /><p className="text-xs text-muted-foreground">The URL changes only when the requested store name is approved.</p></div>
              <div className="space-y-2"><Label htmlFor="business-name">Registered business name</Label><Input id="business-name" value={businessName} onChange={e => setBusinessName(e.target.value)} maxLength={160} disabled={pendingRequest || submittingChanges} /></div>
              <div className="space-y-2"><Label>Business type *</Label><Select value={businessType} onValueChange={setBusinessType} disabled={pendingRequest || submittingChanges}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{businessTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="gstin">GSTIN (if applicable)</Label><Input id="gstin" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} maxLength={15} disabled={pendingRequest || submittingChanges} placeholder="15-character GSTIN" /></div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Submitting a request does not change your approved store details. Admin review is required before the proposed identity becomes official.</div>
            <Button type="submit" disabled={pendingRequest || submittingChanges}>{submittingChanges ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit business changes for review</Button>
          </form></CardContent>
        </Card>

        <Card><CardHeader><CardTitle>Business change request history</CardTitle><CardDescription>Track the status and admin feedback for your submitted requests.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{requests.length === 0 ? <p className="text-sm text-muted-foreground">You have not submitted any business detail changes.</p> : requests.map(request => <div key={request.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Submitted {dateLabel(request.submitted_at)}</p><Badge variant={request.status === "approved" ? "default" : request.status === "pending" ? "secondary" : "outline"}>{pretty(request.status)}</Badge></div>
            <p className="text-sm">Requested store name: <strong>{request.proposed_store_name}</strong></p>
            <p className="text-sm">Business: {request.proposed_business_name || "Not provided"} · {pretty(request.proposed_business_type)} · GSTIN: {request.proposed_gstin || "Not provided"}</p>
            {request.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed {dateLabel(request.reviewed_at)}</p>}
            {request.review_note && <Alert><AlertTitle>Admin feedback</AlertTitle><AlertDescription className="whitespace-pre-wrap">{request.review_note}</AlertDescription></Alert>}
          </div>)}</CardContent>
        </Card>
      </div>
    </SellerPortalLayout>
  </main>;
}
