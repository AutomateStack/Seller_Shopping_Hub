import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizeAmount(amount: unknown): number {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid order amount');
  return Number(parsed.toFixed(2));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { orderId }: { orderId: string } = await req.json();
    if (!orderId || typeof orderId !== 'string') throw new Error('orderId is required');

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error('Razorpay credentials not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, guest_email, guest_name, guest_phone, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Invalid order ID');

    // If the order belongs to a signed-in user, REQUIRE a valid matching bearer token.
    // Only true guest orders (user_id IS NULL) may be paid without an Authorization header.
    if (order.user_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new Error('Unauthorized: authentication required for this order');
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user || order.user_id !== user.id) {
        throw new Error('Unauthorized: order does not belong to this user');
      }
    }

    const orderAmount = normalizeAmount(order.total_amount);
    const amountPaise = Math.round(orderAmount * 100);

    // Razorpay receipt max 40 chars
    const receipt = `ord_${String(order.id).replace(/-/g, '').slice(0, 32)}`;

    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { shophub_order_id: order.id, type: 'order_payment' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const rzpData = await rzpResp.json();
    if (!rzpResp.ok || !rzpData?.id) {
      console.error('Razorpay create order failed:', rzpData);
      throw new Error(rzpData?.error?.description || 'Gateway request failed');
    }

    return new Response(JSON.stringify({
      razorpayOrderId: rzpData.id,
      keyId: RAZORPAY_KEY_ID,
      amount: amountPaise,
      currency: 'INR',
      shophubOrderId: order.id,
      customer: {
        name: (order.guest_name || 'Customer').trim().substring(0, 100),
        email: (order.guest_email || '').toLowerCase(),
        contact: (order.guest_phone || '').replace(/\D/g, '').slice(-10),
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('razorpay-create-order error:', error);
    const msg = error.message || '';
    let clientMessage = 'Unable to initiate payment. Please try again.';
    let statusCode = 502;
    if (msg === 'orderId is required') { clientMessage = 'Order ID is required.'; statusCode = 400; }
    else if (msg === 'Invalid order ID') { clientMessage = 'Order not found.'; statusCode = 404; }
    else if (msg.includes('Unauthorized')) { clientMessage = 'Not authorized for this order.'; statusCode = 403; }
    else if (msg === 'Razorpay credentials not configured') { clientMessage = 'Payment gateway not configured. Please contact support.'; statusCode = 500; }
    else if (msg === 'Invalid order amount') { clientMessage = 'Invalid order amount.'; statusCode = 400; }
    return new Response(JSON.stringify({ error: clientMessage }), {
      status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});