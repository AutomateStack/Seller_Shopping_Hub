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
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must contain exactly 6 digits");
  const url = new URL("/c/api/pin-codes/json/", baseUrl);
  url.searchParams.set("filter_codes", pin);
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Token ${token}`, Accept: "application/json" } });
  const responseText = await response.text();
  let body: any;
  try { body = JSON.parse(responseText); } catch { body = null; }
  if (!response.ok) throw new Error(`Delhivery PIN serviceability check failed (HTTP ${response.status})`);
  const postal = body?.delivery_codes?.[0]?.postal_code;
  if (!postal) return { serviceable: false, pickup: false, prepaid: false, cod: false, pin, reason: "PIN was not found in Delhivery's serviceability records." };
  const pickup = String(postal.pickup || "").toUpperCase() === "Y";
  const prepaid = String(postal.prepaid || "").toUpperCase() === "Y";
  const cod = String(postal.cod || "").toUpperCase() === "Y";
  const remarks = String(postal.remarks || "").trim();
  return { serviceable: pickup && !remarks, pickup, prepaid, cod, pin, city: postal.city || null, state_code: postal.state_code || null, remarks: remarks || null,
    reason: pickup && !remarks ? null : (remarks || "Delhivery does not mark this PIN as pickup-serviceable.") };
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
    if (action === "create-shipment") {
      const orderId = required(body.order_id, "order_id");
      const { data: seller, error: sellerError } = await admin.schema("seller").from("seller_profiles")
        .select("id,user_id,store_name,business_name,gstin,onboarding_status,account_status")
        .eq("user_id", userData.user.id).maybeSingle();
      if (sellerError) throw sellerError;
      if (!seller || seller.onboarding_status !== "approved" || seller.account_status !== "active") return json({ error: "An active approved seller account is required" }, 403);
      const { data: order, error: orderError } = await admin.schema("orders").from("marketplace_orders")
        .select("id,order_number,seller_id,status,payment_method,payment_status,total_amount,created_at,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_state,shipping_postal_code,marketplace_order_items(id,product_title,quantity,hsn_code,seller_gstin),marketplace_order_packages(id,pickup_address_id,weight_grams,length_cm,breadth_cm,height_cm,packed_at)")
        .eq("id", orderId).eq("seller_id", seller.id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json({ error: "Order not found for this seller" }, 404);
      if (order.status !== "processing") return json({ error: "Only processing orders can be manifested" }, 409);
      const parcel = Array.isArray(order.marketplace_order_packages) ? order.marketplace_order_packages[0] : order.marketplace_order_packages;
      if (!parcel?.packed_at) return json({ error: "Confirm the final packed parcel before creating an AWB" }, 409);
      const items = Array.isArray(order.marketplace_order_items) ? order.marketplace_order_items : [];
      if (!items.length) return json({ error: "Order has no shipment items" }, 422);
      const hsnCodes = [...new Set(items.map((item: any) => String(item.hsn_code || "").trim()))];
      const sellerGstins = [...new Set(items.map((item: any) => String(item.seller_gstin || "").trim().toUpperCase()))];
      if (hsnCodes.some((value: string) => !/^\d{4,8}$/.test(value)) || sellerGstins.length !== 1 || !/^[0-9A-Z]{15}$/.test(sellerGstins[0])) {
        return json({ error: "Shipment blocked: valid HSN codes and one valid 15-character seller GSTIN are required on every order item. Update product details and place a new order." }, 422);
      }
      const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN (staging token)");
      const clientName = required(Deno.env.get("DELHIVERY_CLIENT_NAME"), "DELHIVERY_CLIENT_NAME (exact Delhivery client name)");
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\/$/, "");
      if (baseUrl !== "https://staging-express.delhivery.com") return json({ error: "Shipment creation is locked to Delhivery staging. Production is not enabled." }, 409);
      const { data: pickupAddress, error: pickupError } = await admin.schema("seller").from("seller_addresses")
        .select("id,contact_phone,address_line1,address_line2,city,state,postal_code,country_code,review_status,address_type")
        .eq("id", parcel.pickup_address_id).eq("seller_id", seller.id).maybeSingle();
      if (pickupError) throw pickupError;
      if (!pickupAddress || pickupAddress.address_type !== "pickup" || pickupAddress.review_status !== "approved") return json({ error: "The saved pickup address is no longer approved" }, 409);
      const { data: warehouse, error: warehouseError } = await admin.schema("seller").from("delhivery_warehouse_mappings")
        .select("warehouse_name,registration_status").eq("address_id", pickupAddress.id).eq("seller_id", seller.id).maybeSingle();
      if (warehouseError) throw warehouseError;
      if (!warehouse || warehouse.registration_status !== "registered") return json({ error: "The pickup warehouse must be registered with Delhivery before shipment creation" }, 409);
      const { data: existing, error: existingError } = await admin.schema("orders").from("delhivery_shipments")
        .select("id,waybill,shipment_status,last_error").eq("order_id", order.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.waybill) return json({ ok: true, already_created: true, waybill: existing.waybill, shipment_status: existing.shipment_status });
        return json({ error: "A shipment request already exists for this order without a confirmed AWB. To prevent duplicate manifests, reconcile this order in Delhivery staging first.", shipment_status: existing.shipment_status, last_error: existing.last_error }, 409);
      }
      const pickupPin = await checkPickupPin(pickupAddress.postal_code, token, baseUrl);
      if (!pickupPin.pickup) return json({ error: "Pickup PIN is not serviceable by Delhivery", pin_check: pickupPin }, 422);
      const deliveryPin = await checkPickupPin(order.shipping_postal_code, token, baseUrl);
      const paymentMode = String(order.payment_method || "").toLowerCase() === "cod" || order.payment_status === "cod_due" ? "COD" : "Pre-paid";
      if (paymentMode === "COD" ? !deliveryPin.cod : !deliveryPin.prepaid) return json({ error: `Delivery PIN is not serviceable for ${paymentMode} shipments`, pin_check: deliveryPin }, 422);
      const delhiveryOrderId = `SH-${order.id.replaceAll("-", "").toUpperCase()}`;
      const { data: reservation, error: reserveError } = await admin.schema("orders").from("delhivery_shipments").insert({
        order_id: order.id, seller_id: seller.id, pickup_address_id: pickupAddress.id, warehouse_name: warehouse.warehouse_name,
        delhivery_order_id: delhiveryOrderId, shipment_status: "pending", delhivery_response: { request_started_at: new Date().toISOString(), environment: "staging" }
      }).select("id").single();
      if (reserveError) {
        const { data: concurrent } = await admin.schema("orders").from("delhivery_shipments").select("waybill,shipment_status").eq("order_id", order.id).maybeSingle();
        if (concurrent?.waybill) return json({ ok: true, already_created: true, waybill: concurrent.waybill, shipment_status: concurrent.shipment_status });
        return json({ error: "A shipment reservation already exists. Reconcile it before retrying to avoid duplicate AWBs." }, 409);
      }
      const phone = String(order.shipping_phone || "").replace(/\\D/g, "");
      if (phone.length < 10 || phone.length > 12) {
        await admin.schema("orders").from("delhivery_shipments").update({ shipment_status: "exception", last_error: "Invalid consignee phone number" }).eq("id", reservation.id);
        return json({ error: "Buyer phone number is invalid for Delhivery" }, 422);
      }
      const sellerName = seller.business_name || seller.store_name;
      const sellerAddress = [pickupAddress.address_line1, pickupAddress.address_line2, pickupAddress.city, pickupAddress.state, pickupAddress.postal_code].filter(Boolean).join(", ");
      const shipment = {
        client: clientName, name: order.shipping_name, phone, add: order.shipping_address,
        pin: String(order.shipping_postal_code), city: order.shipping_city, state: order.shipping_state, country: "India",
        order: delhiveryOrderId, payment_mode: paymentMode,
        products_desc: items.map((item: any) => `${item.product_title} x ${item.quantity}`).join(", ").slice(0, 500),
        hsn_code: hsnCodes.join(","), seller_gst_tin: sellerGstins[0], seller_name: sellerName, seller_add: sellerAddress,
        seller_inv: order.order_number, order_date: new Date(order.created_at).toISOString().slice(0, 10),
        quantity: items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
        weight: Number(parcel.weight_grams), shipment_length: Math.ceil(Number(parcel.length_cm)),
        shipment_width: Math.ceil(Number(parcel.breadth_cm)), shipment_height: Math.ceil(Number(parcel.height_cm)),
        total_amount: Number(order.total_amount), cod_amount: paymentMode === "COD" ? Number(order.total_amount) : 0,
      };
      const requestData = { shipments: [shipment], pickup_location: { name: warehouse.warehouse_name } };
      try {
        const form = new URLSearchParams();
        form.set("format", "json");
        form.set("data", JSON.stringify(requestData));
        const response = await fetch(`${baseUrl}/api/cmu/create.json`, {
          method: "POST", headers: { Authorization: `Token ${token}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form.toString(),
        });
        const responseText = await response.text();
        let responseBody: any;
        try { responseBody = JSON.parse(responseText); } catch { responseBody = { raw: responseText.slice(0, 2000) }; }
        const packageResult = Array.isArray(responseBody?.packages) ? responseBody.packages[0] : null;
        const waybill = String(packageResult?.waybill || packageResult?.wbn || responseBody?.waybill || "").trim();
        const successFlag = responseBody?.success === true || responseBody?.success === "true" || responseBody?.status === true || Boolean(waybill && !packageResult?.remarks && !responseBody?.error);
        if (!response.ok || !successFlag || !waybill) {
          const detail = JSON.stringify(responseBody).slice(0, 2000);
          await admin.schema("orders").from("delhivery_shipments").update({ shipment_status: "exception", last_error: detail, delhivery_response: responseBody }).eq("id", reservation.id);
          return json({ error: "Delhivery did not confirm shipment creation. The request is held to prevent duplicate retries; check this order in Delhivery staging before proceeding.", details: responseBody }, 502);
        }
        const { error: saveError } = await admin.schema("orders").from("delhivery_shipments").update({ waybill, shipment_status: "manifested", delhivery_response: responseBody, last_error: null }).eq("id", reservation.id);
        if (saveError) {
          console.error("AWB created but database save failed; do not retry Delhivery create request", saveError.message);
          return json({ error: "Delhivery created the shipment, but saving the AWB failed. Do not retry; contact marketplace operations for reconciliation." }, 500);
        }
        return json({ ok: true, waybill, shipment_status: "manifested", delhivery_order_id: delhiveryOrderId });
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Unknown network error";
        await admin.schema("orders").from("delhivery_shipments").update({ shipment_status: "exception", last_error: `Uncertain Delhivery response: ${message}` }).eq("id", reservation.id);
        return json({ error: "The Delhivery request outcome is uncertain. This order is locked against automatic retries to prevent duplicate shipments. Reconcile it in Delhivery staging.", shipment_status: "exception" }, 502);
      }
    }

    const { data: adminRow, error: adminError } = await admin.schema("marketplace").from("marketplace_admins").select("admin_role").eq("user_id", userData.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow || !["operations", "super_admin"].includes(adminRow.admin_role)) return json({ error: "Only marketplace operations admins can manage Delhivery pickup locations" }, 403);
    if (action === "check-pincode") {
      const addressId = required(body.address_id, "address_id");
      const { data: address, error } = await admin.schema("seller").from("seller_addresses")
        .select("id,address_type,postal_code,review_status").eq("id", addressId).maybeSingle();
      if (error) throw error;
      if (!address) return json({ error: "Pickup address not found" }, 404);
      if (address.address_type !== "pickup" || address.review_status !== "approved") return json({ error: "Only approved pickup addresses can be checked" }, 409);
      const token = required(Deno.env.get("DELHIVERY_API_TOKEN"), "DELHIVERY_API_TOKEN (testing token)");
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\/$/, "");
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
      const payload = { phone, city: address.city, name: warehouseName, pin: address.postal_code, address: fullAddress, country: address.country_code === "IN" ? "India" : address.country_code, email, registered_name: warehouseName, return_address: returnFullAddress, return_pin: returnAddress?.postal_code || address.postal_code, return_city: returnAddress?.city || address.city, return_state: returnAddress?.state || address.state, return_country: (returnAddress?.country_code || address.country_code) === "IN" ? "India" : (returnAddress?.country_code || address.country_code) };
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
      const baseUrl = (Deno.env.get("DELHIVERY_BASE_URL") || "https://staging-express.delhivery.com").replace(/\/$/, "");
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
      const payload = { phone, city: address.city, name: warehouseName, pin: address.postal_code, address: fullAddress, country: address.country_code === "IN" ? "India" : address.country_code, email, registered_name: warehouseName, return_address: returnFullAddress, return_pin: returnAddress?.postal_code || address.postal_code, return_city: returnAddress?.city || address.city, return_state: returnAddress?.state || address.state, return_country: (returnAddress?.country_code || address.country_code) === "IN" ? "India" : (returnAddress?.country_code || address.country_code) };
      const { data: mapping, error: upsertError } = await admin.schema("seller").from("delhivery_warehouse_mappings").upsert({ seller_id: seller.id, address_id: address.id, warehouse_name: warehouseName, registration_status: "pending", last_error: null }, { onConflict: "address_id" }).select("id").single();
      if (upsertError) throw upsertError;
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