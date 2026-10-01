import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Plus, Play, Users, Ticket, X, DollarSign, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";

interface PrizeRow {
  position: number;
  prize_amount: string;
  prize_label: string;
}

export function AdminLuckyDraw() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [entryFee, setEntryFee] = useState("1");
  const [freeEntries, setFreeEntries] = useState("1");
  const [prizes, setPrizes] = useState<PrizeRow[]>([
    { position: 1, prize_amount: "5000", prize_label: "1st Prize" },
    { position: 2, prize_amount: "2000", prize_label: "2nd Prize" },
    { position: 3, prize_amount: "500", prize_label: "Consolation" },
  ]);

  const { data: draws } = useQuery({
    queryKey: ["admin-draws"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draws")
        .select("*, draw_prizes(*), draw_entries(count), draw_winners(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createDraw = useMutation({
    mutationFn: async () => {
      const totalPool = prizes.reduce((sum, p) => sum + parseFloat(p.prize_amount || "0"), 0);
      const { data: draw, error } = await supabase
        .from("draws")
        .insert({
          title,
          description,
          draw_date: new Date(drawDate).toISOString(),
          entry_fee: parseFloat(entryFee),
          free_entries_per_user: parseInt(freeEntries),
          total_prize_pool: totalPool,
          winner_count: prizes.length,
          status: "upcoming" as any,
        })
        .select()
        .single();
      if (error) throw error;

      const prizeInserts = prizes.map(p => ({
        draw_id: draw.id,
        position: p.position,
        prize_amount: parseFloat(p.prize_amount),
        prize_label: p.prize_label,
      }));
      const { error: prizeErr } = await supabase.from("draw_prizes").insert(prizeInserts);
      if (prizeErr) throw prizeErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-draws"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setDrawDate("");
      toast({ title: "Draw created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDrawStatus = useMutation({
    mutationFn: async ({ drawId, status }: { drawId: string; status: string }) => {
      const { error } = await supabase
        .from("draws")
        .update({ status: status as any })
        .eq("id", drawId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-draws"] });
      toast({ title: "Status updated" });
    },
  });

  const executeDraw = useMutation({
    mutationFn: async (drawId: string) => {
      const { error } = await supabase.rpc("execute_draw", { p_draw_id: drawId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-draws"] });
      toast({ title: "🎉 Draw executed! Winners selected." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const processWithdrawal = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status, processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // If rejected, refund to wallet
      if (status === "rejected") {
        const withdrawal = withdrawals?.find(w => w.id === id);
        if (withdrawal) {
          const { data: wallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", withdrawal.user_id)
            .single();
          if (wallet) {
            await supabase
              .from("wallets")
              .update({ balance: wallet.balance + withdrawal.amount })
              .eq("id", wallet.id);
            await supabase.from("wallet_transactions").insert({
              wallet_id: wallet.id,
              user_id: withdrawal.user_id,
              type: "refund",
              amount: withdrawal.amount,
              description: "Withdrawal rejected - refunded",
              reference_id: id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      toast({ title: "Withdrawal processed" });
    },
  });

  const addPrize = () => {
    setPrizes(prev => [...prev, { position: prev.length + 1, prize_amount: "100", prize_label: `Prize ${prev.length + 1}` }]);
  };

  const removePrize = (i: number) => {
    setPrizes(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, position: idx + 1 })));
  };

  const pendingWithdrawals = withdrawals?.filter(w => w.status === "pending") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lucky Draw Management</h1>
          <p className="text-muted-foreground">Create and manage draws, process withdrawals.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Draw</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Draw</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly Lucky Draw #1" /></div>
                <div><Label>Draw Date *</Label><Input type="datetime-local" value={drawDate} onChange={e => setDrawDate(e.target.value)} /></div>
                <div><Label>Entry Fee (₹)</Label><Input type="number" value={entryFee} onChange={e => setEntryFee(e.target.value)} min="0" /></div>
                <div><Label>Free Entries per User</Label><Input type="number" value={freeEntries} onChange={e => setFreeEntries(e.target.value)} min="0" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" /></div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Prizes</Label>
                  <Button size="sm" variant="outline" onClick={addPrize}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </div>
                <div className="space-y-2">
                  {prizes.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Label"
                        value={p.prize_label}
                        onChange={e => setPrizes(prev => prev.map((pp, idx) => idx === i ? { ...pp, prize_label: e.target.value } : pp))}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={p.prize_amount}
                        onChange={e => setPrizes(prev => prev.map((pp, idx) => idx === i ? { ...pp, prize_amount: e.target.value } : pp))}
                        className="w-28"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removePrize(i)}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total Pool: ₹{prizes.reduce((s, p) => s + (parseFloat(p.prize_amount) || 0), 0)}
                </p>
              </div>

              <Button onClick={() => createDraw.mutate()} disabled={!title || !drawDate || createDraw.isPending} className="w-full">
                Create Draw
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Draws */}
      <div className="space-y-4">
        {draws?.map(draw => {
          const entryCount = (draw.draw_entries as any)?.[0]?.count || 0;
          const prizesList = (draw.draw_prizes as any[])?.sort((a: any, b: any) => a.position - b.position) || [];
          const winners = (draw.draw_winners as any[]) || [];

          return (
            <Card key={draw.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{draw.title}</h3>
                      <Badge variant={
                        draw.status === "active" ? "default" :
                        draw.status === "completed" ? "secondary" :
                        draw.status === "cancelled" ? "destructive" : "outline"
                      }>
                        {draw.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(draw.draw_date), "MMM d, yyyy h:mm a")} • {entryCount} entries • Pool: ₹{draw.total_prize_pool}
                    </p>
                    {draw.draw_hash && (
                      <p className="text-xs text-muted-foreground mt-1">Draw Hash: {draw.draw_hash}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {draw.status === "upcoming" && (
                      <Button size="sm" onClick={() => updateDrawStatus.mutate({ drawId: draw.id, status: "active" })}>
                        Activate
                      </Button>
                    )}
                    {draw.status === "active" && (
                      <Button size="sm" onClick={() => executeDraw.mutate(draw.id)} className="gap-1 bg-green-600 hover:bg-green-700">
                        <Play className="h-3 w-3" /> Execute Draw
                      </Button>
                    )}
                    {(draw.status === "upcoming" || draw.status === "active") && (
                      <Button size="sm" variant="destructive" onClick={() => updateDrawStatus.mutate({ drawId: draw.id, status: "cancelled" })}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Prizes & Winners */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {prizesList.map((prize: any) => {
                    const winner = winners.find((w: any) => w.prize_position === prize.position);
                    return (
                      <div key={prize.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Trophy className={`h-4 w-4 ${prize.position === 1 ? "text-yellow-500" : "text-muted-foreground"}`} />
                          <span>{prize.prize_label}: ₹{prize.prize_amount}</span>
                        </div>
                        {winner && (
                          <span className="text-xs text-green-600 font-medium">Winner: ***{winner.user_id.slice(-4)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-secondary" />
              Pending Withdrawals ({pendingWithdrawals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingWithdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium">₹{w.amount} → {w.upi_id}</p>
                    <p className="text-xs text-muted-foreground">
                      User: ***{w.user_id.slice(-4)} • {format(new Date(w.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => processWithdrawal.mutate({ id: w.id, status: "completed" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => processWithdrawal.mutate({ id: w.id, status: "rejected" })}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
