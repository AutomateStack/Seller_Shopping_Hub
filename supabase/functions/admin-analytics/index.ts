import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    let days = 30;
    try {
      const body = await req.json();
      const d = Number(body?.days);
      if (Number.isFinite(d)) days = Math.min(365, Math.max(1, Math.round(d)));
    } catch { /* defaults */ }

    const [sales, traffic, users] = await Promise.all([
      svc.rpc("admin_sales_analytics", { p_days: days }),
      svc.rpc("admin_traffic_analytics", { p_days: days }),
      svc.rpc("admin_user_analytics", { p_days: days, p_limit: 100 }),
    ]);

    if (sales.error) {
      console.error("sales analytics failed:", sales.error.message);
      return json({ error: "Analytics query failed" }, 500);
    }
    if (traffic.error) {
      console.error("traffic analytics failed:", traffic.error.message);
      return json({ error: "Analytics query failed" }, 500);
    }

    if (users.error) {
      console.error("user analytics failed:", users.error.message);
      return json({ error: "Analytics query failed" }, 500);
    }

    return json({ days, sales: sales.data, traffic: traffic.data, users: users.data });
  } catch (e) {
    console.error("admin-analytics error:", e instanceof Error ? e.message : e);
    return json({ error: "Unexpected error" }, 500);
  }
});
