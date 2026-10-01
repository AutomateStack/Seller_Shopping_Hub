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

function buildHtml(name: string, items: Array<{ name: string; image_url?: string | null; price: number; quantity: number }>) {
  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:10px 0">
        ${i.image_url ? `<img src="${i.image_url}" alt="" style="width:60px;height:60px;border-radius:8px;object-fit:cover;vertical-align:middle"/>` : ""}
      </td>
      <td style="padding:10px;font-size:14px;color:#333">
        <strong>${i.name}</strong><br/>
        <span style="color:#888;font-size:12px">Qty ${i.quantity}</span>
      </td>
      <td style="padding:10px;text-align:right;font-size:14px;color:#4f46e5;font-weight:600">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">You left something behind 🛒</h1>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
      <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${name},</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px">Your cart is waiting for you. Complete your purchase before your favorites sell out!</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        ${itemsHtml}
      </table>
      <div style="text-align:center">
        <a href="${SITE_URL}/cart" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Return to Cart</a>
      </div>
    </div>
  </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find users with cart items older than 24h, not reminded in last 72h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const reminderCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: cartRows } = await supabase
      .from("cart")
      .select("id, user_id, quantity, last_reminded_at, created_at, products:product_id(name, image_url, price, stock)")
      .lte("created_at", cutoff)
      .or(`last_reminded_at.is.null,last_reminded_at.lte.${reminderCutoff}`);

    if (!cartRows || cartRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No abandoned carts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user
    const byUser = new Map<string, typeof cartRows>();
    for (const row of cartRows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id)!.push(row);
    }

    let sent = 0;
    for (const [userId, rows] of byUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.email) continue;

      const items = rows
        .filter((r: any) => r.products && (r.products.stock ?? 0) > 0)
        .map((r: any) => ({
          name: r.products.name,
          image_url: r.products.image_url,
          price: Number(r.products.price),
          quantity: r.quantity || 1,
        }));
      if (items.length === 0) continue;

      const html = buildHtml(profile.full_name || "there", items);

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ShopHub <onboarding@resend.dev>",
            to: [profile.email],
            subject: "You left items in your cart 🛒",
            html,
          }),
        });
        if (res.ok) {
          sent++;
          await supabase
            .from("cart")
            .update({ last_reminded_at: new Date().toISOString() })
            .in("id", rows.map((r: any) => r.id));
        }
      } catch (e) {
        console.error("reminder send error", e);
      }
    }

    return new Response(JSON.stringify({ sent, users: byUser.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});