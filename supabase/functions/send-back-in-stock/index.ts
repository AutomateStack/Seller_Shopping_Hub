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

function emailHtml(productName: string, productId: string, imageUrl?: string | null) {
  const productUrl = `${SITE_URL}/products/${productId}`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">It's back in stock! 🎉</h1>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
      ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="width:100%;max-width:280px;border-radius:8px;margin:0 auto 20px;display:block"/>` : ""}
      <h2 style="font-size:20px;color:#333;margin:0 0 12px;text-align:center">${productName}</h2>
      <p style="font-size:14px;color:#666;margin:0 0 24px;text-align:center">Good news — the product you wanted is available again. Grab it before it sells out!</p>
      <div style="text-align:center">
        <a href="${productUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Shop Now</a>
      </div>
      <p style="font-size:12px;color:#999;margin:32px 0 0;text-align:center">You're receiving this because you subscribed to back-in-stock alerts on ShopHub.</p>
    </div>
  </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product_id } = await req.json();
    if (!product_id) throw new Error("product_id required");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: product } = await supabase
      .from("products")
      .select("id, name, image_url, stock")
      .eq("id", product_id)
      .maybeSingle();

    if (!product || (product.stock ?? 0) <= 0) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabase
      .from("stock_notifications")
      .select("id, email")
      .eq("product_id", product_id)
      .eq("notified", false);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = emailHtml(product.name, product.id, product.image_url);
    let sent = 0;
    const sentIds: string[] = [];

    for (const sub of subs) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ShopHub <onboarding@resend.dev>",
            to: [sub.email],
            subject: `${product.name} is back in stock!`,
            html,
          }),
        });
        if (res.ok) {
          sent++;
          sentIds.push(sub.id);
        }
      } catch (e) {
        console.error("send error", e);
      }
    }

    if (sentIds.length > 0) {
      await supabase.from("stock_notifications").update({ notified: true }).in("id", sentIds);
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Failed to send notifications" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});