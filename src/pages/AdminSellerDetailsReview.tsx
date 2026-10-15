import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, RefreshCw, Store, UserRound, XCircle } from "lucide-react";

const db = supabase as any;
type RequestRow = {
  id: string; seller_id: string; proposed_store_name: string; proposed_business_name: string | null;
  proposed_business_type: string; proposed_gstin: string | null; change_type?: string | null; seller_explanation?: string | null; status: string;
  review_note: string | null; submitted_at: string; reviewed_at: string | null;
};
type SellerRow = { id: string; store_name: string; contact_name: string; contact_email: string | null; profile_photo_url: string | null; business_name: string | null; business_type: string; gstin: string | null; };
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AdminSellerDetailsReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["seller-profile-change-requests"],
    queryFn: async () => {
      const { data: requests, error: requestError } = await db.schema("seller").from("profile_change_requests")
        .select("*").order("submitted_at", { ascending: false }).limit(500);
      if (requestError) throw requestError;
      const rows = (requests ?? []) as RequestRow[];
      const sellerIds = [...new Set(rows.map(row => row.seller_id))];
      let sellers: SellerRow[] = [];
      if (sellerIds.length) {
        const { data: profiles, error: profileError } = await db.schema("seller").from("seller_profiles")
          .select("id,store_name,contact_name,contact_email,profile_photo_url,business_name,business_type,gstin").in("id", sellerIds);
        if (profileError) throw profileError;
        sellers = (profiles ?? []) as SellerRow[];
      }
      return { requests: rows, sellers };
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "changes_requested" | "rejected" }) => {
      const note = notes[id]?.trim() ?? "";
      if (decision !== "approved" && note.length < 5) throw new Error("Provide at least 5 characters explaining the requested changes or rejection.");
      const { error } = await db.rpc("review_seller_profile_change_request", { p_request_id: id, p_decision: decision, p_review_note: note || null });
      if (error) throw error;
      return decision;
    },
    onSuccess: decision => {
      toast({ title: decision === "approved" ? "Business details approved" : decision === "rejected" ? "Request rejected" : "Changes requested", description: "The request status and seller profile have been updated." });
      queryClient.invalidateQueries({ queryKey: ["seller-profile-change-requests"] });
    },
    onError: (error: Error) => toast({ title: "Review action failed", description: error.message, variant: "destructive" }),
  });

  const requests = data?.requests ?? [];
  const sellers = data?.sellers ?? [];
  const sellerById = useMemo(() => new Map(sellers.map(seller => [seller.id, seller])), [sellers]);
  const filtered = requests.filter(request => filter === "all" || request.status === filter);
  const counts = { pending: requests.filter(row => row.status === "pending").length, approved: requests.filter(row => row.status === "approved").length, changes_requested: requests.filter(row => row.status === "changes_requested").length, rejected: requests.filter(row => row.status === "rejected").length };

  return <SidebarProvider><div className="min-h-screen flex w-full bg-muted/30"><AdminSidebar activeTab="seller-applications" onTabChange={() => {}} /><div className="flex-1 min-w-0">
    <div className="h-14 flex items-center gap-4 border-b bg-background px-4"><SidebarTrigger /><h2 className="font-semibold text-sm">Business detail changes</h2></div>
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#f9a8c8]/60 bg-white/90"><div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-[#fce7f3] p-2.5"><Store className="h-6 w-6 text-primary" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Shopping Hub</p><h1 className="text-xl font-bold text-[#24151c]">Seller business change review</h1></div></div>
        <div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin/sellers"><ArrowLeft className="mr-2 h-4 w-4" /> Seller applications</Link></Button><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh</Button></div>
      </div></header>
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div><h2 className="text-2xl font-bold">Store and registered business changes</h2><p className="text-muted-foreground">Approve proposed store names, registered business names, business types and GSTIN changes. Approved details remain active until approval.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(["pending","approved","changes_requested","rejected"] as const).map(status => <Card key={status}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{pretty(status)}</p><p className="text-2xl font-bold">{counts[status]}</p></CardContent></Card>)}</div>
        <div className="max-w-sm"><Label>Filter requests</Label><Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="changes_requested">Changes requested</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="all">All requests</SelectItem></SelectContent></Select></div>
        {isLoading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading requests…</div> : error ? <Card><CardContent className="py-8 text-destructive">Could not load requests: {(error as Error).message}</CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No {filter === "all" ? "" : pretty(filter).toLowerCase() + " "}business detail requests found.</CardContent></Card> : filtered.map(request => {
          const seller = sellerById.get(request.seller_id);
          const busy = review.isPending;
          return <Card key={request.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3">
                    {seller?.profile_photo_url ? <img src={seller.profile_photo_url} alt={seller.contact_name + " profile"} className="h-11 w-11 rounded-full border object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>}
                    <div><CardTitle>{seller?.store_name ?? "Seller store"} → {request.proposed_store_name}</CardTitle><CardDescription>{seller?.contact_name ?? "Seller"} · {seller?.contact_email ?? "No email"} · Submitted {dateLabel(request.submitted_at)}</CardDescription></div>
                  </div><Badge variant={request.status === "approved" ? "default" : request.status === "pending" ? "secondary" : "outline"}>{pretty(request.status)}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              {request.seller_explanation && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="mb-1 text-sm font-semibold">Seller explanation</p><p className="whitespace-pre-wrap text-sm">{request.seller_explanation}</p>{request.change_type && <p className="mt-2 text-xs text-muted-foreground">Change type: {pretty(request.change_type)}</p>}</div>}
              <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Current approved details</p><p className="text-sm">Store name: {seller?.store_name ?? "—"}</p><p className="text-sm">Business name: {seller?.business_name ?? "Not provided"}</p><p className="text-sm">Business type: {seller?.business_type ? pretty(seller.business_type) : "—"}</p><p className="text-sm">GSTIN: {seller?.gstin ?? "Not provided"}</p></div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="mb-2 text-sm font-semibold">Proposed details</p><p className="text-sm">Store name: {request.proposed_store_name}</p><p className="text-sm">Business name: {request.proposed_business_name ?? "Not provided"}</p><p className="text-sm">Business type: {pretty(request.proposed_business_type)}</p><p className="text-sm">GSTIN: {request.proposed_gstin ?? "Not provided"}</p></div></div>
              {request.review_note && <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">Latest admin note</p><p className="whitespace-pre-wrap">{request.review_note}</p></div>}
              {request.status === "pending" && <div className="space-y-2"><Label htmlFor={`review-note-${request.id}`}>Review note (required for changes requested or rejection)</Label><Textarea id={`review-note-${request.id}`} value={notes[request.id] ?? ""} onChange={event => setNotes(current => ({ ...current, [request.id]: event.target.value }))} placeholder="Explain what needs to change…" disabled={busy} />
                <div className="flex flex-wrap gap-2"><Button onClick={() => review.mutate({ id: request.id, decision: "approved" })} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve changes</Button><Button variant="outline" onClick={() => review.mutate({ id: request.id, decision: "changes_requested" })} disabled={busy}><Clock3 className="mr-2 h-4 w-4" /> Request changes</Button><Button variant="destructive" onClick={() => review.mutate({ id: request.id, decision: "rejected" })} disabled={busy}><XCircle className="mr-2 h-4 w-4" /> Reject</Button></div>
              </div>}
              {request.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed {dateLabel(request.reviewed_at)}</p>}
            </CardContent>
          </Card>;
        })}
      </main>
    </div>
  </div></div></SidebarProvider>;
}
