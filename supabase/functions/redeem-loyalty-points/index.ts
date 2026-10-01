import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POINTS_PER_RUPEE_SPENT = 10; // 1 point per ₹10 spent
const RUPEES_PER_POINT = 0.25; // 1 point = ₹0.25 wallet credit
const MIN_POINTS = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Earned points from completed (non-cancelled) orders
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("total_amount, status")
      .eq("user_id", userId)
      .neq("status", "cancelled");
    if (ordersErr) throw new Error("orders");

    const totalSpent = (orders || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const earned = Math.floor(totalSpent / POINTS_PER_RUPEE_SPENT);

    const { data: redemptions, error: redErr } = await supabase
      .from("loyalty_redemptions")
      .select("points_used")
      .eq("user_id", userId);
    if (redErr) throw new Error("redemptions");

    const used = (redemptions || []).reduce((s, r) => s + Number(r.points_used || 0), 0);
    const available = Math.max(0, earned - used);

    const body = await req.json().catch(() => ({}));
    if (body?.action === "balance") {
      return json({ earned, used, available, rupees_per_point: RUPEES_PER_POINT, min_points: MIN_POINTS });
    }

    const requested = Math.floor(Number(body?.points ?? 0));
    if (!requested || requested < MIN_POINTS) {
      return json({ error: `Redeem at least ${MIN_POINTS} points` }, 400);
    }
    if (requested > available) return json({ error: "Not enough points" }, 400);

    const credit = Number((requested * RUPEES_PER_POINT).toFixed(2));

    // Ensure wallet exists
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .maybeSingle();

    let walletId = wallet?.id as string | undefined;
    if (!walletId) {
      const { data: created, error: createErr } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance: credit })
        .select("id")
        .single();
      if (createErr) throw new Error("wallet");
      walletId = created.id;
    } else {
      const { error: updErr } = await supabase
        .from("wallets")
        .update({ balance: Number(wallet!.balance || 0) + credit })
        .eq("id", walletId);
      if (updErr) throw new Error("wallet");
    }

    const { error: recErr } = await supabase
      .from("loyalty_redemptions")
      .insert({ user_id: userId, points_used: requested, credit_amount: credit });
    if (recErr) {
      // roll back credit
      await supabase
        .from("wallets")
        .update({ balance: Number(wallet?.balance || 0) })
        .eq("id", walletId);
      throw new Error("record");
    }

    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      user_id: userId,
      type: "loyalty",
      amount: credit,
      description: `Redeemed ${requested} loyalty points`,
      status: "completed",
    });

    return json({
      success: true,
      credit,
      points_used: requested,
      available: available - requested,
    });
  } catch (e) {
    console.error("redeem-loyalty-points error", e);
    return json({ error: "Unable to redeem points right now. Please try again." }, 400);
  }
});
