import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { amount, upi } = await req.json();
    const upiClean = typeof upi === 'string' ? upi.trim() : '';
    if (
      typeof amount !== 'number' || !Number.isFinite(amount) || amount < 10 || amount > 100000 ||
      !upiClean || upiClean.length > 100 || !/^[\w.\-]+@[\w.\-]+$/.test(upiClean)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid amount or UPI ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: wallet, error: wErr } = await supabase
      .from('wallets').select('*').eq('user_id', user.id).single();
    if (wErr || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Number(wallet.balance) < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await supabase
      .from('wallets')
      .update({ balance: Number(wallet.balance) - amount })
      .eq('id', wallet.id);
    if (updErr) throw updErr;

    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'withdrawal',
      amount: -amount,
      description: `Withdrawal request to ${upiClean}`,
      status: 'pending',
    });

    const { error: reqErr } = await supabase
      .from('withdrawal_requests')
      .insert({ user_id: user.id, amount, upi_id: upiClean });
    if (reqErr) throw reqErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('wallet-request-withdrawal error:', e);
    return new Response(JSON.stringify({ error: 'Unable to process request' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});