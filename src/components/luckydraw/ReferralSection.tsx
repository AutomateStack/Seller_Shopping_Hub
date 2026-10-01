import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Copy, Share2, Users, Gift, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion } from "framer-motion";

interface ReferralSectionProps {
  userId: string;
}

const MILESTONES = [
  { count: 5, bonus: 2, label: "5 referrals → 2 bonus entries" },
  { count: 10, bonus: 5, label: "10 referrals → 5 bonus entries" },
  { count: 25, bonus: 15, label: "25 referrals → 15 bonus entries" },
];

export function ReferralSection({ userId }: ReferralSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: referralCode } = useQuery({
    queryKey: ["referral-code", userId],
    queryFn: async () => {
      // Try to get existing code
      let { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!data) {
        // Generate new code
        const code = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
        const { data: newCode, error: insertError } = await supabase
          .from("referral_codes")
          .insert({ user_id: userId, code })
          .select()
          .single();
        if (insertError) throw insertError;
        data = newCode;
      }
      return data;
    },
  });

  const { data: referrals } = useQuery({
    queryKey: ["my-referrals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const referralLink = referralCode
    ? `${window.location.origin}/lucky-draw?ref=${referralCode.code}`
    : "";

  const totalReferrals = referrals?.length || 0;
  const nextMilestone = MILESTONES.find(m => totalReferrals < m.count);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `🎁 Join ShopHub's Lucky Draw! Get a FREE entry and win up to ₹5,000!\n\nUse my referral link: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <section className="py-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Refer & Earn Bonus Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">₹100 store credit per friend</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When a friend joins with your link and their first order is delivered, ₹100 is added to your wallet automatically — on top of your bonus entries.
                </p>
              </div>

              {/* Referral Link */}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Your Referral Link</label>
                <div className="flex gap-2">
                  <Input value={referralLink} readOnly className="text-sm" />
                  <Button onClick={copyLink} variant="outline" size="icon" className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3">
                <Button onClick={shareWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700 flex-1">
                  <Share2 className="h-4 w-4" />
                  Share on WhatsApp
                </Button>
                <Button onClick={copyLink} variant="outline" className="gap-2 flex-1">
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent/50 rounded-xl p-4 text-center">
                  <Users className="h-5 w-5 text-accent-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">{totalReferrals}</p>
                  <p className="text-xs text-muted-foreground">Total Referrals</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-4 text-center">
                  <Gift className="h-5 w-5 text-accent-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold text-foreground">
                    {referrals?.reduce((sum, r) => sum + r.bonus_entries_awarded, 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Bonus Entries Earned</p>
                </div>
              </div>

              {/* Milestone Progress */}
              {nextMilestone && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Next milestone</span>
                    <span className="font-medium">{totalReferrals}/{nextMilestone.count} referrals</span>
                  </div>
                  <Progress value={(totalReferrals / nextMilestone.count) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">{nextMilestone.label}</p>
                </div>
              )}

              {/* Milestones List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Milestone Rewards</h4>
                {MILESTONES.map(m => (
                  <div
                    key={m.count}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                      totalReferrals >= m.count ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {totalReferrals >= m.count ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Gift className="h-4 w-4" />
                    )}
                    {m.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
