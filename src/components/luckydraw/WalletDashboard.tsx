import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpRight, ArrowDownRight, CreditCard, IndianRupee, History, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface WalletDashboardProps {
  userId: string;
}

export function WalletDashboard({ userId }: WalletDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      let { data } = await supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle();
      if (!data) {
        const { data: newWallet, error } = await supabase
          .from("wallets")
          .insert({ user_id: userId })
          .select()
          .single();
        if (error) throw error;
        data = newWallet;
      }
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["wallet-transactions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const initiateTopup = useMutation({
    mutationFn: async (amount: number) => {
      setIsProcessingPayment(true);

      const { data, error } = await supabase.functions.invoke("wallet-topup", {
        body: { amount },
      });

      if (error) throw new Error(error.message || "Failed to initiate payment");
      if (!data?.razorpayOrderId) throw new Error("No payment order returned");

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Payment SDK failed to load. Check your connection.");

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: "ShopHub Wallet",
          description: `Wallet top-up ₹${amount}`,
          prefill: {
            name: data.customer?.name,
            email: data.customer?.email,
            contact: data.customer?.contact,
          },
          theme: { color: "#6366f1" },
          handler: async (response: any) => {
            try {
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
                "wallet-verify-topup",
                {
                  body: {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                }
              );
              if (verifyError) return reject(new Error("Verification failed"));
              if (verifyData?.status === "success") {
                toast({ title: `💰 ₹${verifyData.amount} added to your wallet!` });
                queryClient.invalidateQueries({ queryKey: ["wallet"] });
                queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
                resolve();
              } else {
                reject(new Error("Payment could not be verified"));
              }
            } catch (err: any) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        });
        rzp.on("payment.failed", (resp: any) => {
          reject(new Error(resp?.error?.description || "Payment failed"));
        });
        rzp.open();
      });
    },
    onError: (e: any) => {
      setIsProcessingPayment(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      setIsProcessingPayment(false);
      setDepositAmount("");
    },
  });

  const requestWithdrawal = useMutation({
    mutationFn: async ({ amount, upi }: { amount: number; upi: string }) => {
      const { data, error } = await supabase.functions.invoke("wallet-request-withdrawal", {
        body: { amount, upi },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      setWithdrawAmount("");
      setUpiId("");
      setWithdrawOpen(false);
      toast({ title: "Withdrawal request submitted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
    deposit: { icon: ArrowDownRight, color: "text-green-600", label: "Deposit" },
    entry_purchase: { icon: CreditCard, color: "text-orange-600", label: "Entry Purchase" },
    winning: { icon: ArrowDownRight, color: "text-green-600", label: "Prize Won" },
    withdrawal: { icon: ArrowUpRight, color: "text-red-600", label: "Withdrawal" },
    refund: { icon: ArrowDownRight, color: "text-blue-600", label: "Refund" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Wallet</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Wallet className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">₹{wallet?.balance?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <ArrowDownRight className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">₹{wallet?.total_deposited?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Deposited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <IndianRupee className="h-5 w-5 text-secondary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">₹{wallet?.total_won?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <ArrowUpRight className="h-5 w-5 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">₹{wallet?.total_withdrawn?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-muted-foreground">Withdrawn</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Funds via UPI/Card</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              {[10, 50, 100, 500].map(amt => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setDepositAmount(String(amt))}
                  className="flex-1"
                  disabled={isProcessingPayment}
                >
                  ₹{amt}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount (₹1 - ₹50,000)"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                min="1"
                max="50000"
                disabled={isProcessingPayment}
              />
              <Button
                onClick={() => initiateTopup.mutate(parseFloat(depositAmount))}
                disabled={!depositAmount || parseFloat(depositAmount) < 1 || parseFloat(depositAmount) > 50000 || isProcessingPayment || initiateTopup.isPending}
                className="min-w-[100px]"
              >
                {isProcessingPayment || initiateTopup.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Paying...</>
                ) : (
                  "Pay & Add"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Secure payment via Razorpay (UPI, Cards, Net Banking)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Withdraw</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Withdraw your winnings to your UPI account. Minimum ₹10.
            </p>
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  Request Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw Funds</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      placeholder="Min ₹10"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      min="10"
                      max={wallet?.balance || 0}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: ₹{wallet?.balance?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  <div>
                    <Label>UPI ID</Label>
                    <Input
                      placeholder="yourname@upi"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => requestWithdrawal.mutate({ amount: parseFloat(withdrawAmount), upi: upiId })}
                    disabled={
                      !withdrawAmount || !upiId || parseFloat(withdrawAmount) < 10 ||
                      parseFloat(withdrawAmount) > (wallet?.balance || 0) ||
                      requestWithdrawal.isPending
                    }
                    className="w-full"
                  >
                    {requestWithdrawal.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</>
                    ) : (
                      "Submit Withdrawal Request"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Withdrawals are manually reviewed and processed within 24-48 hours.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Requests */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Withdrawal Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {withdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">₹{w.amount} → {w.upi_id}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(w.created_at), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  <Badge variant={
                    w.status === "completed" ? "default" :
                    w.status === "approved" ? "secondary" :
                    w.status === "rejected" ? "destructive" : "outline"
                  }>
                    {w.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          ) : (
            <div className="space-y-1">
              {transactions.map(tx => {
                const config = typeConfig[tx.type] || { icon: CreditCard, color: "text-foreground", label: tx.type };
                const Icon = config.icon;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{config.label}</p>
                        <p className="text-xs text-muted-foreground">{tx.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount >= 0 ? "+" : ""}₹{Math.abs(tx.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1.5 justify-end">
                        {tx.status === "pending" && <Badge variant="outline" className="text-[9px] px-1 py-0">pending</Badge>}
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
