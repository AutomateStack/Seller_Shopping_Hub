import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Store, ShieldCheck } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

type Seller = {
  id: string;
  user_id: string;
  store_name: string;
  store_slug: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  business_type: string;
  business_name: string | null;
  gstin: string | null;
  onboarding_status: string;
  account_status: string;
  performance_tier: string;
  review_notes: string | null;
};

const db = supabase as any;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [seller, setSeller] = useState<Seller | null>(null);
  const [storeName, setStoreName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("individual");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const storeSlug = useMemo(() => slugify(storeName), [storeName]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth?next=/seller/onboarding", { replace: true }); return; }
      if (!active) return;
      setUserId(session.user.id);
      setEmail(session.user.email ?? "");
      const { data, error } = await db.schema("seller").from("seller_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
      if (!active) return;
      if (error) {
        toast({ title: "Unable to load seller profile", description: error.message, variant: "destructive" });
      } else if (data) {
        const row = data as Seller;
        if (row.onboarding_status === "approved" && row.account_status === "active") {
          navigate("/seller/dashboard", { replace: true });
          return;
        }
        setSeller(row);
        setStoreName(row.store_name ?? "");
        setContactName(row.contact_name ?? "");
        setPhone(row.contact_phone ?? "");
        setBusinessType(row.business_type ?? "individual");
        setBusinessName(row.business_name ?? "");
        setGstin(row.gstin ?? "");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [navigate, toast]);

  const editable = !seller || ["draft", "needs_changes"].includes(seller.onboarding_status);
  const saveProfile = async (submitForReview: boolean) => {
    if (!userId) return;
    if (storeName.trim().length < 2 || contactName.trim().length < 2) {
      toast({ title: "Please complete required fields", description: "Store name and contact name are required.", variant: "destructive" });
      return;
    }
    if (!storeSlug) {
      toast({ title: "Invalid store name", description: "Use a store name containing letters or numbers.", variant: "destructive" });
      return;
    }
    const normalizedGstin = gstin.trim().toUpperCase();
    if (normalizedGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizedGstin)) {
      toast({ title: "Check the GSTIN format", description: "Enter a 15-character GSTIN in the expected format. This checks format only, not GST registration validity.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      store_name: storeName.trim(),
      store_slug: storeSlug,
      contact_name: contactName.trim(),
      contact_email: email,
      contact_phone: phone.trim() || null,
      business_type: businessType,
      business_name: businessName.trim() || null,
      gstin: gstin.trim().toUpperCase() || null,
    };
    const result = seller
      ? await db.schema("seller").from("seller_profiles").update(payload).eq("id", seller.id).select("*").single()
      : await db.schema("seller").from("seller_profiles").insert(payload).select("*").single();
    if (result.error) {
      setSaving(false);
      toast({ title: "Could not save seller profile", description: result.error.message, variant: "destructive" });
      return;
    }
    let saved = result.data as Seller;
    if (submitForReview) {
      const submission = await db.rpc("submit_seller_onboarding", { p_seller_id: saved.id });
      if (submission.error) {
        setSeller(saved);
        setSaving(false);
        toast({ title: "Profile saved, but submission needs attention", description: submission.error.message, variant: "destructive" });
        return;
      }
      saved = { ...saved, onboarding_status: "submitted" };
    }
    setSeller(saved);
    setSaving(false);
    toast({ title: submitForReview ? "Submitted for review" : "Draft saved", description: submitForReview ? "Your seller profile is now awaiting review." : "Your seller details have been saved." });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Seller onboarding | Seller Shopping Hub" description="Set up your marketplace seller account." noindex />
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Button variant="ghost" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to store</Link></Button>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3"><Store className="h-7 w-7 text-primary" /></div>
          <div><h1 className="text-3xl font-bold">Seller onboarding</h1><p className="text-muted-foreground mt-1">Set up your store details to start selling on Seller Shopping Hub.</p></div>
        </div>
        {seller && <Card><CardContent className="flex items-center gap-3 pt-6"><ShieldCheck className="h-5 w-5 text-primary" /><div><p className="font-medium">Application status: <span className="capitalize">{seller.onboarding_status.replaceAll("_", " ")}</span></p><p className="text-sm text-muted-foreground">Seller tier: {seller.performance_tier} · Account: {seller.account_status}</p></div></CardContent></Card>}
        {seller?.onboarding_status === "needs_changes" && seller.review_notes && <Card className="border-amber-300 bg-amber-50/60"><CardHeader className="pb-2"><CardTitle className="text-base">Changes requested by the review team</CardTitle><CardDescription>Please correct the details below, save your changes, and submit the application again.</CardDescription></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{seller.review_notes}</p></CardContent></Card>}
        <Card>
          <CardHeader><CardTitle>Store and contact details</CardTitle><CardDescription>Fields marked required must be completed before submission.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={e => { e.preventDefault(); void saveProfile(false); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="store-name">Store name *</Label><Input id="store-name" value={storeName} onChange={e => setStoreName(e.target.value)} disabled={!editable || saving} required minLength={2} maxLength={120} placeholder="Your store name" /></div>
                <div className="space-y-2"><Label htmlFor="store-slug">Store URL</Label><Input id="store-slug" value={storeSlug} readOnly aria-describedby="slug-help" /><p id="slug-help" className="text-xs text-muted-foreground">Generated from your store name.</p></div>
                <div className="space-y-2"><Label htmlFor="contact-name">Contact person *</Label><Input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} disabled={!editable || saving} required minLength={2} maxLength={120} /></div>
                <div className="space-y-2"><Label htmlFor="contact-email">Account email</Label><Input id="contact-email" value={email} readOnly disabled /></div>
                <div className="space-y-2"><Label htmlFor="phone">Contact phone</Label><Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} disabled={!editable || saving} type="tel" maxLength={20} placeholder="+91..." /></div>
                <div className="space-y-2"><Label>Business type *</Label><Select value={businessType} onValueChange={setBusinessType} disabled={!editable || saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="sole_proprietorship">Sole proprietorship</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="llp">LLP</SelectItem><SelectItem value="private_limited">Private limited</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="business-name">Registered business name</Label><Input id="business-name" value={businessName} onChange={e => setBusinessName(e.target.value)} disabled={!editable || saving} maxLength={160} /></div>
                <div className="space-y-2"><Label htmlFor="gstin">GSTIN (if applicable)</Label><Input id="gstin" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} disabled={!editable || saving} maxLength={15} minLength={0} placeholder="15-character GSTIN" /></div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Do not upload identity or bank documents until the secure document-upload flow is enabled. Your application will need review before selling features are enabled.</div>
              {editable && <div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" variant="outline" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft</Button><Button type="button" disabled={saving} onClick={() => void saveProfile(true)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for review</Button></div>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
