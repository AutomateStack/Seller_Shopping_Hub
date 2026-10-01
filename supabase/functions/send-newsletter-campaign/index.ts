import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://shopshub.lovable.app";

function wrapHtml(subject: string, bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px">${subject}</h1>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;color:#333;font-size:15px;line-height:1.6">
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"/>
      <p style="font-size:11px;color:#999;text-align:center;margin:0">
        You're receiving this because you subscribed to ShopHub updates.<br/>
        <a href="${SITE_URL}" style="color:#4f46e5">Visit ShopHub</a>
      </p>
    </div>
  </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const { data: campaign } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Campaign already sent");

    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    const { data: subs } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    const html = wrapHtml(campaign.subject, campaign.body_html);
    let sent = 0, failed = 0;

    for (const sub of subs || []) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ShopHub <onboarding@resend.dev>",
            to: [sub.email],
            subject: campaign.subject,
            html,
          }),
        });
        if (res.ok) sent++; else failed++;
      } catch {
        failed++;
      }
    }

    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_count: sent,
        failed_count: failed,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ sent, failed, total: subs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Failed to send campaign" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});