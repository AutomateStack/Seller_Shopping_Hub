import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientKey } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = checkRateLimit(clientKey(req, 'guest-order-lookup'), 10, 60_000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait and try again.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const { orderId, email }: { orderId: string; email: string } = await req.json();

    if (!orderId || !email) {
      return new Response(
        JSON.stringify({ error: 'Both orderId and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, total_amount, created_at, shipping_address, city, state, zip_code, order_items(product_name, quantity, product_price, subtotal)')
      .eq('id', orderId)
      .eq('guest_email', email.toLowerCase().trim())
      .is('user_id', null)
      .single();

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found. Please check your order ID and email.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, order }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Guest order lookup error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
