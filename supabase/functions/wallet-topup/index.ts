import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount } = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 50000) {
      return new Response(JSON.stringify({ error: 'Amount must be between ₹1 and ₹50,000' }), {
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

    // Authenticate user
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
    const userEmail = (claimsData.claims as any).email || 'user@example.com';

    // Get or create wallet
    let { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', userId).maybeSingle();
    if (!wallet) {
      const { data: newWallet, error: wErr } = await supabase.from('wallets').insert({ user_id: userId }).select('id').single();
      if (wErr) throw wErr;
      wallet = newWallet;
    }

    // Unique internal receipt for this topup (Razorpay receipt max 40 chars)
    const topupOrderId = `topup_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const normalizedAmount = Number(Number(amount).toFixed(2));
    const amountPaise = Math.round(normalizedAmount * 100);

    // Get user profile for phone
    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', userId).maybeSingle();

    // Create Razorpay order
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: topupOrderId,
        notes: { type: 'wallet_topup', user_id: userId, wallet_id: wallet!.id },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();

    if (!response.ok || !data?.id) {
      console.error('Razorpay wallet topup error:', data);
      return new Response(JSON.stringify({ error: 'Unable to initiate payment. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store pending topup as a wallet transaction. reference_id = Razorpay order id
    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet!.id,
      user_id: userId,
      type: 'deposit',
      amount: normalizedAmount,
      description: `Wallet top-up ₹${normalizedAmount}`,
      reference_id: data.id,
      status: 'pending',
    });

    return new Response(JSON.stringify({
      razorpayOrderId: data.id,
      keyId: RAZORPAY_KEY_ID,
      amount: amountPaise,
      currency: 'INR',
      customer: {
        name: (profile?.full_name || 'Customer').trim().substring(0, 100),
        email: userEmail.toLowerCase(),
        contact: (profile?.phone || '').replace(/\D/g, '').slice(-10),
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Wallet topup error:', error);
    return new Response(JSON.stringify({ error: 'Unable to process request. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
