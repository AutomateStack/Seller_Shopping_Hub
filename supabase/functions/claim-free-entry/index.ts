import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { drawId } = await req.json();
    if (!drawId || typeof drawId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: draw, error: drawErr } = await svc
      .from("draws")
      .select("id, status, free_entries_per_user")
      .eq("id", drawId)
      .single();
    if (drawErr || !draw) {
      return new Response(JSON.stringify({ error: "Draw not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["active", "upcoming"].includes(draw.status)) {
      return new Response(JSON.stringify({ error: "Draw not open for entries" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = draw.free_entries_per_user ?? 1;

    const { count, error: countErr } = await svc
      .from("draw_entries")
      .select("id", { count: "exact", head: true })
      .eq("draw_id", drawId)
      .eq("user_id", user.id)
      .eq("entry_type", "free");
    if (countErr) throw countErr;

    if ((count ?? 0) >= limit) {
      return new Response(
        JSON.stringify({ error: `Free entry limit (${limit}) reached for this draw` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insErr } = await svc.from("draw_entries").insert({
      draw_id: drawId,
      user_id: user.id,
      entry_type: "free",
      is_paid: false,
    });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("claim-free-entry error:", e);
    return new Response(JSON.stringify({ error: "Unable to claim entry" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});