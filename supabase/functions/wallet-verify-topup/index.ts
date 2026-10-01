import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing verification fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify signature
    const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      // Mark pending tx failed if present
      await supabase.from('wallet_transactions')
        .update({ status: 'failed' })
        .eq('reference_id', razorpay_order_id)
        .eq('user_id', userId)
        .eq('type', 'deposit');
      return new Response(JSON.stringify({ status: 'invalid_signature' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already processed
    const { data: existingTx } = await supabase
      .from('wallet_transactions')
      .select('id, status')
      .eq('reference_id', razorpay_order_id)
      .eq('user_id', userId)
      .eq('type', 'deposit')
      .maybeSingle();

    if (existingTx?.status === 'completed') {
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch Razorpay order to get authoritative amount
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const rzpResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { 'Authorization': `Basic ${basicAuth}`, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const rzpOrder = await rzpResp.json();
    if (!rzpResp.ok || !rzpOrder?.id) {
      console.error('Razorpay order fetch failed:', rzpOrder);
      return new Response(JSON.stringify({ error: 'Unable to verify payment' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = Number(rzpOrder.amount) / 100;

    // Credit wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, balance, total_deposited')
      .eq('user_id', userId)
      .single();

    if (!wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await supabase
      .from('wallets')
      .update({
        balance: wallet.balance + amount,
        total_deposited: wallet.total_deposited + amount,
      })
      .eq('id', wallet.id);
    if (updateErr) throw updateErr;

    if (existingTx) {
      await supabase.from('wallet_transactions')
        .update({ status: 'completed', description: `Wallet top-up ₹${amount} via Razorpay` })
        .eq('id', existingTx.id);
    } else {
      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id, user_id: userId,
        type: 'deposit', amount,
        description: `Wallet top-up ₹${amount} via Razorpay`,
        reference_id: razorpay_order_id, status: 'completed',
      });
    }

    return new Response(JSON.stringify({ status: 'success', amount }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Wallet verify topup error:', error);
    return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
