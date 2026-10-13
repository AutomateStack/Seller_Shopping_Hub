import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, RefreshCw, Search, ShieldAlert, Store, XCircle } from "lucide-react";

const db = supabase as any;

type SellerApplication = {
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
  created_at: string;
  reviewed_at: string | null;
};

const pretty = (value?: string | null) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Not provided";
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AdminSellerReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [search, setSearch] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: sellers = [], isLoading, isError, error, refetch, isFetching } = useQuery<SellerApplication[]>({
    queryKey: ["marketplace-seller-applications"],
    queryFn: async () => {
      const { data, error } = await db.from("seller_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SellerApplication[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ sellerId, decision, reason }: { sellerId: string; decision: "approved" | "rejected" | "needs_changes"; reason?: string }) => {
      const { error } = await db.rpc("review_seller_application", {
        p_seller_id: sellerId,
        p_decision: decision,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return decision;
    },
    onSuccess: (decision) => {
      toast({ title: decision === "approved" ? "Seller approved" : decision === "rejected" ? "Application rejected" : "Changes requested", description: "The seller status and review history have been updated." });
      queryClient.invalidateQueries({ queryKey: ["marketplace-seller-applications"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-seller-events"] });
    },
    onError: (err: Error) => toast({ title: "Review action failed", description: err.message, variant: "destructive" }),
  });

  const counts = useMemo(() => ({
    submitted: sellers.filter((s) => ["submitted", "under_review"].includes(s.onboarding_status)).length,
    approved: sellers.filter((s) => s.onboarding_status === "approved").length,
    needsChanges: sellers.filter((s) => s.onboarding_status === "needs_changes").length,
    rejected: sellers.filter((s) => s.onboarding_status === "rejected").length,
  }), [sellers]);

  const filtered = useMemo(() => sellers.filter((seller) => {
    const matchesStatus = statusFilter === "all" || (statusFilter === "submitted" ? ["submitted", "under_review"].includes(seller.onboarding_status) : seller.onboarding_status === statusFilter);
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [seller.store_name, seller.contact_name, seller.contact_email, seller.business_name, seller.gstin, seller.contact_phone].some((value) => value?.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  }), [sellers, statusFilter, search]);

  const decide = (seller: SellerApplication, decision: "approved" | "rejected" | "needs_changes") => {
    const reason = reasons[seller.id]?.trim() ?? "";
    if (decision !== "approved" && reason.length < 5) {
      toast({ title: "Add a review reason", description: "Enter at least 5 characters for rejection or requested changes.", variant: "destructive" });
      return;
    }
    if (decision === "rejected" && !window.confirm(`Reject the application for "${seller.store_name}"? This action will be recorded in the audit history.`)) return;
    reviewMutation.mutate({ sellerId: seller.id, decision, reason: reason || undefined });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#f9a8c8]/60 bg-white/90">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#fce7f3] p-2.5"><Store className="h-6 w-6 text-primary" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Shopping Hub</p><h1 className="text-xl font-bold text-[#24151c]">Seller review</h1></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Admin home</Link></Button>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <div>
          <h2 className="text-2xl font-bold">Seller applications</h2>
          <p className="mt-1 text-muted-foreground">Review submitted store details and record an auditable decision. Sellers cannot approve their own applications.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Awaiting review", value: counts.submitted, icon: Clock3 },
            { label: "Approved", value: counts.approved, icon: CheckCircle2 },
            { label: "Changes requested", value: counts.needsChanges, icon: RefreshCw },
            { label: "Rejected", value: counts.rejected, icon: XCircle },
          ].map((item) => <Card key={item.label} className="border-[#f9a8c8]/50"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-3xl font-bold">{item.value}</p></div><div className="rounded-xl bg-[#fce7f3] p-3"><item.icon className="h-5 w-5 text-primary" /></div></CardContent></Card>)}
        </div>

        <Card className="border-[#f9a8c8]/50">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search store, contact, email, GSTIN..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-56"><SelectValue placeholder="Filter status" /></SelectTrigger><SelectContent><SelectItem value="submitted">Awaiting review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="needs_changes">Changes requested</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="draft">Drafts</SelectItem><SelectItem value="all">All applications</SelectItem></SelectContent></Select>
          </CardContent>
        </Card>

        {isLoading && <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading seller applications…</div>}
        {isError && <Card className="border-destructive/40"><CardContent className="flex items-start gap-3 p-5"><ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" /><div className="space-y-1"><p className="font-semibold">Unable to load applications</p><p className="text-sm text-muted-foreground">{(error as Error)?.message ?? "Check your admin access and Supabase connection."}</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div></CardContent></Card>}

        {!isLoading && !isError && filtered.length === 0 && <Card className="border-dashed border-[#f9a8c8]"><CardContent className="py-12 text-center"><Store className="mx-auto h-9 w-9 text-primary/60" /><h3 className="mt-3 font-semibold">No applications found</h3><p className="mt-1 text-sm text-muted-foreground">Try another filter or ask a seller to submit their onboarding form.</p></CardContent></Card>}

        <div className="space-y-4">
          {filtered.map((seller) => {
            const canReview = ["submitted", "under_review", "needs_changes"].includes(seller.onboarding_status);
            const busy = reviewMutation.isPending && reviewMutation.variables?.sellerId === seller.id;
            return <Card key={seller.id} className="overflow-hidden border-[#f9a8c8]/60">
              <CardHeader className="bg-gradient-to-r from-[#fff7fb] to-white pb-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div><div className="flex flex-wrap items-center gap-2"><CardTitle>{seller.store_name}</CardTitle><Badge variant={seller.onboarding_status === "approved" ? "default" : seller.onboarding_status === "rejected" ? "destructive" : "secondary"}>{pretty(seller.onboarding_status)}</Badge></div><CardDescription className="mt-1">Created {dateLabel(seller.created_at)} · /shop/{seller.store_slug}</CardDescription></div>
                  <Badge variant="outline">{pretty(seller.performance_tier)} tier</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Contact person</p><p className="font-medium">{seller.contact_name}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p><p className="break-all font-medium">{seller.contact_email || "Not provided"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p><p className="font-medium">{seller.contact_phone || "Not provided"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Business type</p><p className="font-medium">{pretty(seller.business_type)}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Registered business</p><p className="font-medium">{seller.business_name || "Not provided"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">GSTIN</p><p className="font-medium">{seller.gstin || "Not provided"}</p></div>
                </div>
                {seller.review_notes && <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold">Previous review note:</span> {seller.review_notes}</div>}
                {canReview && <div className="space-y-3 border-t border-[#f9a8c8]/50 pt-4">
                  <div className="space-y-2"><Label htmlFor={`reason-${seller.id}`}>Review note {seller.onboarding_status !== "submitted" && "(required for rejection or requested changes)"}</Label><Textarea id={`reason-${seller.id}`} placeholder="Explain what needs correction, or add an internal review note…" value={reasons[seller.id] ?? ""} onChange={(e) => setReasons((prev) => ({ ...prev, [seller.id]: e.target.value }))} rows={2} maxLength={2000} /></div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={reviewMutation.isPending} onClick={() => decide(seller, "approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve seller</Button>
                    <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => decide(seller, "needs_changes")}><RefreshCw className="mr-2 h-4 w-4" />Request changes</Button>
                    <Button variant="destructive" disabled={reviewMutation.isPending} onClick={() => decide(seller, "rejected")}><XCircle className="mr-2 h-4 w-4" />Reject</Button>
                    {busy && <span className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving decision…</span>}
                  </div>
                </div>}
              </CardContent>
            </Card>;
          })}
        </div>
      </main>
    </div>
  );
}
