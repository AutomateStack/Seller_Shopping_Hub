import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const required = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${label}`);
  return value.trim();
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = required(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const anonKey = required(Deno.env.get("SUPABASE_ANON_KEY"), "SUPABASE_ANON_KEY");
    const serviceKey = required(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN");
    const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\/$/, "");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRow, error: adminError } = await admin
      .schema("marketplace").from("marketplace_admins")
      .select("admin_role").eq("user_id", userData.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow || !["operations", "super_admin"].includes(adminRow.admin_role)) {
      return json({ error: "Only marketplace operations admins can manage Delhivery pickup locations" }, 403);
    }

    const body = await req.json();
    const action = required(body.action, "action");

    if (action === "register-warehouse") {
      const addressId = required(body.address_id, "address_id");
      const { data: address, error: addressError } = await admin.schema("seller")
        .from("seller_addresses")
        .select("id,seller_id,address_type,contact_name,contact_phone,address_line1,address_line2,city,state,postal_code,country_code,review_status")
        .eq("id", addressId).maybeSingle();
      if (addressError) throw addressError;
      if (!address) return json({ error: "Pickup address not found" }, 404);
      if (address.address_type !== "pickup" || address.review_status !== "approved") {
        return json({ error: "Only approved pickup addresses can be registered" }, 409);
      }

      const { data: seller, error: sellerError } = await admin.schema("seller")
        .from("seller_profiles")
        .select("id,store_name,business_name,contact_email,contact_phone,onboarding_status,account_status")
        .eq("id", address.seller_id).single();
      if (sellerError) throw sellerError;
      if (seller.onboarding_status !== "approved" || seller.account_status !== "active") {
        return json({ error: "Seller account must be approved and active" }, 409);
      }
      const { data: existing, error: existingError } = await admin.schema("seller")
        .from("delhivery_warehouse_mappings").select("id,warehouse_name,registration_status")
        .eq("address_id", address.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.registration_status === "registered") {
        return json({ ok: true, already_registered: true, warehouse_name: existing.warehouse_name });
      }

      const warehouseName = existing?.warehouse_name ??
        `SH-${seller.id.replaceAll("-", "").slice(0, 8).toUpperCase()}-${address.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const fullAddress = [address.address_line1, address.address_line2].filter(Boolean).join(", ");
      const phone = (address.contact_phone || seller.contact_phone || "").replace(/[^0-9]/g, "");
      const email = seller.contact_email;
      if (!phone || !email) return json({ error: "Seller contact phone and email are required for Delhivery warehouse registration" }, 422);

      const payload = {
        phone,
        city: address.city,
        name: warehouseName,
        pin: address.postal_code,
        address: fullAddress,
        country: address.country_code === "IN" ? "India" : address.country_code,
        email,
        registered_name: seller.business_name || seller.store_name,
        return_address: fullAddress,
        return_pin: address.postal_code,
        return_city: address.city,
        return_state: address.state,
        return_country: address.country_code === "IN" ? "India" : address.country_code,
      };

      const { data: mapping, error: upsertError } = await admin.schema("seller")
        .from("delhivery_warehouse_mappings").upsert({
          seller_id: seller.id,
          address_id: address.id,
          warehouse_name: warehouseName,
          registration_status: "pending",
          last_error: null,
        }, { onConflict: "address_id" }).select("id").single();
      if (upsertError) throw upsertError;

      const response = await fetch(`${baseUrl}/api/backend/clientwarehouse/create/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let responseBody: unknown;
      try { responseBody = JSON.parse(responseText); } catch { responseBody = { raw: responseText.slice(0, 2000) }; }

      if (!response.ok) {
        const message = typeof responseBody === "object" && responseBody !== null
          ? JSON.stringify(responseBody) : String(responseBody);
        await admin.schema("seller").from("delhivery_warehouse_mappings").update({
          registration_status: "failed",
          last_error: message.slice(0, 2000),
          delhivery_response: responseBody,
        }).eq("id", mapping.id);
        return json({ error: "Delhivery warehouse registration failed", details: responseBody }, 502);
      }

      const { error: updateError } = await admin.schema("seller")
        .from("delhivery_warehouse_mappings").update({
          registration_status: "registered",
          registered_at: new Date().toISOString(),
          last_error: null,
          delhivery_response: responseBody,
        }).eq("id", mapping.id);
      if (updateError) throw updateError;

      return json({ ok: true, warehouse_name: warehouseName, delhivery: responseBody });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    console.error("delhivery-integration:", message);
    return json({ error: message }, 500);
  }
});
