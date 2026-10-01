import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Loader2, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/format";

interface Props { userId: string }

interface BalanceResponse {
  earned: number;
  used: number;
  available: number;
  rupees_per_point: number;
  min_points: number;
}

export function RedeemPoints({ userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [points, setPoints] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-balance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<BalanceResponse>(
        "redeem-loyalty-points",
        { body: { action: "balance" } }
      );
      if (error) throw error;
      return data as BalanceResponse;
    },
  });

  const available = data?.available ?? 0;
  const rate = data?.rupees_per_point ?? 0.25;
  const min = data?.min_points ?? 200;
  const parsed = Math.floor(Number(points) || 0);
  const creditPreview = parsed > 0 ? parsed * rate : 0;

  const handleRedeem = async () => {
    setSubmitting(true);
    const { data: res, error } = await supabase.functions.invoke<{ success?: boolean; credit?: number; error?: string }>(
      "redeem-loyalty-points",
      { body: { points: parsed } }
    );
    setSubmitting(false);

    if (error || !res?.success) {
      toast({
        title: "Could not redeem",
        description: res?.error || "Please check your points balance and try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Points redeemed",
      description: `${formatINR(res.credit)} added to your wallet.`,
    });
    setPoints("");
    queryClient.invalidateQueries({ queryKey: ["loyalty-balance", userId] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["loyalty", userId] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
          Redeem Reward Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-md" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-lg font-bold text-primary">{available}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Redeemed</p>
                <p className="text-lg font-bold text-foreground">{data?.used ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Worth</p>
                <p className="text-lg font-bold text-foreground">{formatINR(available * rate, { compact: true })}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                min={min}
                step={1}
                inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder={`Min ${min} points`}
                aria-label="Points to redeem"
                className="min-h-[44px]"
              />
              <Button
                onClick={handleRedeem}
                disabled={submitting || parsed < min || parsed > available}
                className="min-h-[44px] gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Redeem
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              1 point = {formatINR(rate)} wallet credit. Minimum {min} points per redemption.
              {parsed >= min && parsed <= available && (
                <> You'll receive <strong className="text-foreground">{formatINR(creditPreview)}</strong>.</>
              )}
            </p>
            {available > 0 && available < min && (
              <p className="text-xs text-muted-foreground">
                Earn {min - available} more points to unlock your first redemption.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
