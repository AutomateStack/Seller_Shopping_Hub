import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const required = (value: unknown, label: string) => { if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${label}`); return value.trim(); };

const checkPickupPin = async (pin: string, token: string, baseUrl: string) => {
  if (!/^\\d{6}$/.test(pin)) throw new Error("Pickup PIN must contain exactly 6 digits");
  const url = new URL("/c/api/pin-codes/json/", baseUrl);
  url.searchParams.set("filter_codes", pin);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
  });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!response.ok) throw new Error(`Delhivery PIN serviceability check failed (HTTP ${response.status})`);
  const postal = body?.delivery_codes?.[0]?.postal_code;
  if (!postal) return { serviceable: false, pickup: false, pin, reason: "PIN was not found in Delhivery's serviceability records." };
  const pickup = String(postal.pickup || "").toUpperCase() === "Y";
  const remarks = String(postal.remarks || "").trim();
  return {
    serviceable: pickup && !remarks,
    pickup,
    pin,
    city: postal.city || null,
    state_code: postal.state_code || null,
    remarks: remarks || null,
    reason: pickup && !remarks ? null : (remarks || "Delhivery does not mark this PIN as pickup-serviceable."),
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = required(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const anonKey = required(Deno.env.get("SUPABASE_ANON_KEY"), "SUPABASE_ANON_KEY");
    const serviceKey = required(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminRow, error: adminError } = await admin.schema("marketplace").from("marketplace_admins").select("admin_role").eq("user_id", userData.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow || !["operations", "super_admin"].includes(adminRow.admin_role)) return json({ error: "Only marketplace operations admins can manage Delhivery pickup locations" }, 403);
    const body = await req.json();
    const action = required(body.action, "action");
    if (action === "check-pincode") {
      const addressId = required(body.address_id, "address_id");
      const { data: address, error } = await admin.schema("seller").from("seller_addresses")
        .select("id,address_type,postal_code,review_status").eq("id", addressId).maybeSingle();
      if (error) throw error;
      if (!address) return json({ error: "Pickup address not found" }, 404);
      if (address.address_type !== "pickup" || address.review_status !== "approved") return json({ error: "Only approved pickup addresses can be checked" }, 409);
      const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN (testing token)");
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\\/$/, "");
      if (baseUrl !== "https://staging-express.delhivery.com") return json({ error: "PIN checks are locked to Delhivery staging until production is explicitly enabled." }, 409);
      const result = await checkPickupPin(address.postal_code, token, baseUrl);
      return json({ ok: true, ...result });
    }
    if (action === "preview-warehouse") {
      const addressId = required(body.address_id, "address_id");
      const { data: address, error: addressError } = await admin.schema("seller").from("seller_addresses").select("id,seller_id,address_type,contact_name,contact_phone,address_line1,address_line2,city,state,postal_code,country_code,review_status").eq("id", addressId).maybeSingle();
      if (addressError) throw addressError;
      if (!address) return json({ error: "Pickup address not found" }, 404);
      if (address.address_type !== "pickup" || address.review_status !== "approved") return json({ error: "Only approved pickup addresses can be previewed" }, 409);
      const { data: seller, error: sellerError } = await admin.schema("seller").from("seller_profiles").select("id,store_name,business_name,contact_email,contact_phone,onboarding_status,account_status").eq("id", address.seller_id).single();
      if (sellerError) throw sellerError;
      if (seller.onboarding_status !== "approved" || seller.account_status !== "active") return json({ error: "Seller account must be approved and active" }, 409);
      const { data: returnAddress, error: returnError } = await admin.schema("seller").from("seller_addresses").select("contact_phone,address_line1,address_line2,city,state,postal_code,country_code").eq("seller_id", seller.id).eq("address_type", "return").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (returnError) throw returnError;
      const fullAddress = [address.address_line1, address.address_line2].filter(Boolean).join(", ");
      const returnFullAddress = returnAddress ? [returnAddress.address_line1, returnAddress.address_line2].filter(Boolean).join(", ") : fullAddress;
      const phone = (address.contact_phone || seller.contact_phone || "").replace(/[^0-9]/g, "");
      const email = seller.contact_email;
      if (!phone || !email) return json({ error: "Seller contact phone and email are required for Delhivery warehouse registration" }, 422);
      const warehouseName = `SH-${seller.id.replaceAll("-", "").slice(0, 8).toUpperCase()}-${address.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const payload = { phone, city: address.city, name: warehouseName, pin: address.postal_code, address: fullAddress, country: address.country_code === "IN" ? "India" : address.country_code, email, registered_name: seller.business_name || seller.store_name, return_address: returnFullAddress, return_pin: returnAddress?.postal_code || address.postal_code, return_city: returnAddress?.city || address.city, return_state: returnAddress?.state || address.state, return_country: (returnAddress?.country_code || address.country_code) === "IN" ? "India" : (returnAddress?.country_code || address.country_code) };
      const requiredFields = ["phone", "city", "name", "pin", "address", "email", "registered_name", "return_address", "return_pin", "return_city", "return_state", "return_country"];
      const missingFields = requiredFields.filter((key) => !String(payload[key as keyof typeof payload] ?? "").trim());
      if (missingFields.length) return json({ error: "Warehouse payload is incomplete", missing_fields: missingFields }, 422);
      return json({ ok: true, dry_run: true, message: "Local validation passed. No Delhivery API request was made.", warehouse_name: warehouseName, payload: { ...payload, phone: `${phone.slice(0, 2)}******${phone.slice(-2)}`, email: email.replace(/^(.).+(@.*)$/, "$1***$2") } });
    }
    if (action === "register-warehouse") {
      const addressId = required(body.address_id, "address_id");
      const { data: address, error: addressError } = await admin.schema("seller").from("seller_addresses").select("id,seller_id,address_type,contact_name,contact_phone,address_line1,address_line2,city,state,postal_code,country_code,review_status").eq("id", addressId).maybeSingle();
      if (addressError) throw addressError;
      if (!address) return json({ error: "Pickup address not found" }, 404);
      if (address.address_type !== "pickup" || address.review_status !== "approved") return json({ error: "Only approved pickup addresses can be registered" }, 409);
      const { data: seller, error: sellerError } = await admin.schema("seller").from("seller_profiles").select("id,store_name,business_name,contact_email,contact_phone,onboarding_status,account_status").eq("id", address.seller_id).single();
      if (sellerError) throw sellerError;
      if (seller.onboarding_status !== "approved" || seller.account_status !== "active") return json({ error: "Seller account must be approved and active" }, 409);
      const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN (testing token)");
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\\/$/, "");
      if (baseUrl !== "https://staging-express.delhivery.com") return json({ error: "Warehouse registration is locked to Delhivery staging until production is explicitly enabled." }, 409);
      const pinCheck = await checkPickupPin(address.postal_code, token, baseUrl);
      if (!pinCheck.serviceable) return json({ error: "Pickup PIN is not serviceable by Delhivery", pin_check: pinCheck }, 422);
      const { data: existing, error: existingError } = await admin.schema("seller").from("delhivery_warehouse_mappings").select("id,warehouse_name,registration_status").eq("address_id", address.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.registration_status === "registered") return json({ ok: true, already_registered: true, warehouse_name: existing.warehouse_name });
      const warehouseName = existing?.warehouse_name ?? `SH-${seller.id.replaceAll("-", "").slice(0, 8).toUpperCase()}-${address.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
      const { data: returnAddress, error: returnError } = await admin.schema("seller").from("seller_addresses").select("contact_phone,address_line1,address_line2,city,state,postal_code,country_code").eq("seller_id", seller.id).eq("address_type", "return").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (returnError) throw returnError;
      const fullAddress = [address.address_line1, address.address_line2].filter(Boolean).join(", ");
      const returnFullAddress = returnAddress ? [returnAddress.address_line1, returnAddress.address_line2].filter(Boolean).join(", ") : fullAddress;
      const phone = (address.contact_phone || seller.contact_phone || "").replace(/[^0-9]/g, "");
      const email = seller.contact_email;
      if (!phone || !email) return json({ error: "Seller contact phone and email are required for Delhivery warehouse registration" }, 422);
      const payload = { phone, city: address.city, name: warehouseName, pin: address.postal_code, address: fullAddress, country: address.country_code === "IN" ? "India" : address.country_code, email, registered_name: seller.business_name || seller.store_name, return_address: returnFullAddress, return_pin: returnAddress?.postal_code || address.postal_code, return_city: returnAddress?.city || address.city, return_state: returnAddress?.state || address.state, return_country: (returnAddress?.country_code || address.country_code) === "IN" ? "India" : (returnAddress?.country_code || address.country_code) };
      const { data: mapping, error: upsertError } = await admin.schema("seller").from("delhivery_warehouse_mappings").upsert({ seller_id: seller.id, address_id: address.id, warehouse_name: warehouseName, registration_status: "pending", last_error: null }, { onConflict: "address_id" }).select("id").single();
      if (upsertError) throw upsertError;
      const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN");
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/api/backend/clientwarehouse/create/`, { method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const responseText = await response.text();
      let responseBody: unknown;
      try { responseBody = JSON.parse(responseText); } catch { responseBody = { raw: responseText.slice(0, 2000) }; }
      // Delhivery documents a JSON success message on successful warehouse creation.
      // Accept a truthy success message (boolean or text), but never treat an arbitrary
      // JSON error object as a successful registration.
      const validSuccessBody = typeof responseBody === "object" && responseBody !== null
        && "success" in responseBody
        && Boolean((responseBody as { success?: unknown }).success)
        && !("error" in responseBody);
      if (!response.ok || !validSuccessBody) {
        const message = typeof responseBody === "object" && responseBody !== null ? JSON.stringify(responseBody) : String(responseBody);
        await admin.schema("seller").from("delhivery_warehouse_mappings").update({ registration_status: "failed", last_error: message.slice(0, 2000), delhivery_response: responseBody }).eq("id", mapping.id);
        return json({ error: "Delhivery warehouse registration failed", details: responseBody }, 502);
      }
      const { error: updateError } = await admin.schema("seller").from("delhivery_warehouse_mappings").update({ registration_status: "registered", registered_at: new Date().toISOString(), last_error: null, delhivery_response: responseBody }).eq("id", mapping.id);
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