import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Plus, Eye } from "lucide-react";

export function AdminCampaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const { data: campaigns } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: subscriberCount } = useQuery({
    queryKey: ["newsletter-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("email_campaigns" as any).insert({
        subject,
        body_html: bodyHtml,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast({ title: "Draft saved" });
      setOpen(false); setSubject(""); setBodyHtml("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("send-newsletter-campaign", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast({ title: "Campaign sent", description: `${res.sent} delivered, ${res.failed} failed` });
    },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6" /> Newsletter Campaigns</h1>
          <p className="text-muted-foreground">Send broadcasts to {subscriberCount ?? 0} active subscribers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Subject *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="🎉 New arrivals just dropped!" />
              </div>
              <div>
                <Label>Body (HTML supported)</Label>
                <Textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={12}
                  placeholder="<p>Hi there,</p><p>Check out our latest collection...</p>"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setPreviewHtml(bodyHtml); setPreviewOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={!subject || !bodyHtml || createMutation.isPending}>
                  Save Draft
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {(campaigns || []).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{c.subject}</h3>
                  <Badge variant={c.status === "sent" ? "default" : c.status === "sending" ? "secondary" : "outline"}>
                    {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(c.created_at).toLocaleDateString()}
                  {c.status === "sent" && ` · ${c.sent_count} sent · ${c.failed_count} failed`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => { setPreviewHtml(c.body_html); setPreviewOpen(true); }}>
                  <Eye className="h-4 w-4" />
                </Button>
                {c.status === "draft" && (
                  <Button size="sm" onClick={() => sendMutation.mutate(c.id)} disabled={sendMutation.isPending}>
                    <Send className="h-4 w-4 mr-1" /> Send
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!campaigns || campaigns.length === 0) && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No campaigns yet. Click "New Campaign" to get started.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}