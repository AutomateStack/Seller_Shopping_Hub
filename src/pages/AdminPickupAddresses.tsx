import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Truck } from "lucide-react";

const db = supabase as any;
type Address = {
  id: string; seller_id: string; contact_name: string; contact_phone: string;
  address_line1: string; address_line2: string | null; city: string; state: string;
  postal_code: string; review_status: string; review_note: string | null;
  seller_profiles: { store_name: string; business_name: string | null; onboarding_status: string; account_status: string } | null;
  delhivery_warehouse_mappings?: { registration_status: string; warehouse_name: string }[] | null;
};

export default function AdminPickupAddresses() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Address[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [validated, setValidated] = useState<Record<string, boolean>>({});
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.schema("seller").from("seller_addresses")
      .select("id,seller_id,contact_name,contact_phone,address_line1,address_line2,city,state,postal_code,review_status,review_note,seller_profiles!inner(store_name,business_name,onboarding_status,account_status),delhivery_warehouse_mappings(registration_status,warehouse_name)")
      .eq("address_type", "pickup").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load pickup addresses", description: error.message, variant: "destructive" });
    else setRows(data || []);
    setLoading(false);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const review = async (address: Address, decision: "approved" | "changes_requested" | "rejected") => {
    const note = (notes[address.id] || "").trim();
    if (decision !== "approved" && note.length < 5) {
      toast({ title: "Add a review note", description: "Please explain the issue in at least 5 characters.", variant: "destructive" }); return;
    }
    setBusy(address.id);
    const { error } = await db.schema("seller").from("seller_addresses").update({
      review_status: decision, review_note: note || null,
      reviewed_by: (await supabase.auth.getUser()).data.user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", address.id);
    if (error) {
      setBusy(""); toast({ title: "Could not update address review", description: error.message, variant: "destructive" }); return;
    }
    setValidated(v => ({ ...v, [address.id]: false }));
    toast({ title: decision === "approved" ? "Pickup address approved" : decision === "rejected" ? "Pickup address rejected" : "Changes requested", description: decision === "approved" ? "Next, run the dry-run validation before any Delhivery registration." : undefined });
    setBusy(""); await load();
  };

  const previewWarehouse = async (address: Address) => {
    setBusy(address.id);
    const { data, error } = await supabase.functions.invoke("delhivery-integration", { body: { action: "preview-warehouse", address_id: address.id } });
    setBusy("");
    if (error || data?.error) {
      setValidated(v => ({ ...v, [address.id]: false }));
      toast({ title: "Warehouse validation failed", description: error?.message || data?.error || "Validation failed.", variant: "destructive" });
      return;
    }
    setValidated(v => ({ ...v, [address.id]: true }));
    toast({ title: "Dry-run validation passed", description: "Payload is valid. No Delhivery API request was made." });
  };

  const registerWarehouse = async (address: Address) => {
    setBusy(address.id);
    const { data, error } = await supabase.functions.invoke("delhivery-integration", { body: { action: "register-warehouse", address_id: address.id } });
    setBusy("");
    if (error || data?.error) {
      toast({ title: "Delhivery registration failed", description: error?.message || data?.error || "Registration failed.", variant: "destructive" });
    } else {
      toast({ title: "Delhivery registration complete", description: data?.warehouse_name ? `Pickup location: ${data.warehouse_name}` : "Registration completed." });
    }
    await load();
  };

  return <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Pickup address review</h1><p className="text-sm text-muted-foreground">Review seller pickup addresses and register approved locations with Delhivery.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    {loading ? <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : rows.length === 0 ? <Card><CardContent className="p-10 text-center text-muted-foreground">No seller pickup addresses submitted.</CardContent></Card> : rows.map(address => {
      const mapping = address.delhivery_warehouse_mappings?.[0];
      const canApprove = address.seller_profiles?.onboarding_status === "approved" && address.seller_profiles?.account_status === "active";
      return <Card key={address.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>{address.seller_profiles?.business_name || address.seller_profiles?.store_name || "Seller"} · {address.contact_name}</CardTitle><CardDescription>{address.contact_phone} · {address.city}, {address.state} - {address.postal_code}</CardDescription></div><Badge variant={address.review_status === "approved" ? "default" : address.review_status === "rejected" ? "destructive" : "secondary"}>{address.review_status.replaceAll("_", " ")}</Badge></div></CardHeader>
        <CardContent className="space-y-3"><p className="text-sm">{address.address_line1}{address.address_line2 ? ", " + address.address_line2 : ""}</p>
          {mapping && <div className="flex items-center gap-2 rounded-md border p-3 text-sm"><Truck className="h-4 w-4" /><span>Delhivery: {mapping.warehouse_name}</span><Badge variant={mapping.registration_status === "registered" ? "default" : mapping.registration_status === "failed" ? "destructive" : "secondary"}>{mapping.registration_status}</Badge></div>}
          {address.review_note && <p className="text-sm text-muted-foreground">Previous note: {address.review_note}</p>}
          {address.review_status !== "approved" && <div className="space-y-2"><Label htmlFor={`pickup-note-${address.id}`}>Review note (required for rejection or changes)</Label><Textarea id={`pickup-note-${address.id}`} value={notes[address.id] ?? ""} onChange={e => setNotes(v => ({ ...v, [address.id]: e.target.value }))} rows={2} placeholder="Explain what needs correction…" />
            <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!!busy || !canApprove} onClick={() => void review(address, "approved")}>{busy === address.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Approve address</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void review(address, "changes_requested")}>Request changes</Button><Button size="sm" variant="destructive" disabled={!!busy} onClick={() => void review(address, "rejected")}>Reject</Button></div>
            {!canApprove && <p className="text-xs text-amber-700">Seller onboarding must be approved and account active before warehouse registration.</p>}
          </div>}
          {address.review_status === "approved" && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!!busy || !canApprove || mapping?.registration_status === "registered"} onClick={() => void previewWarehouse(address)}>{busy === address.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Validate payload (dry run)</Button>
            <Button size="sm" disabled={!!busy || !validated[address.id] || mapping?.registration_status === "registered"} onClick={() => void registerWarehouse(address)}><Truck className="mr-2 h-4 w-4" />Register with Delhivery</Button>
            {validated[address.id] && <span className="self-center text-xs text-muted-foreground">Dry run passed — no Delhivery request was made.</span>}
          </div>}
        </CardContent></Card>;
    })}
  </main>;
}
