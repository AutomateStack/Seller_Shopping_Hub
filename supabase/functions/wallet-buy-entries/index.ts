import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { drawId, count } = await req.json();
    if (!drawId || typeof drawId !== 'string' || !Number.isInteger(count) || count < 1 || count > 100) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
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

    const { data: draw, error: drawErr } = await supabase
      .from('draws').select('id, entry_fee, status').eq('id', drawId).single();
    if (drawErr || !draw) {
      return new Response(JSON.stringify({ error: 'Draw not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['active', 'upcoming'].includes(draw.status)) {
      return new Response(JSON.stringify({ error: 'Draw is not open' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fee = Number(draw.entry_fee) * count;

    const { data: wallet, error: wErr } = await supabase
      .from('wallets').select('*').eq('user_id', user.id).single();
    if (wErr || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Number(wallet.balance) < fee) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await supabase
      .from('wallets')
      .update({
        balance: Number(wallet.balance) - fee,
        total_spent: Number(wallet.total_spent) + fee,
      })
      .eq('id', wallet.id);
    if (updErr) throw updErr;

    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'entry_purchase',
      amount: -fee,
      description: `Purchased ${count} entries`,
      reference_id: drawId,
    });

    const entries = Array.from({ length: count }, () => ({
      draw_id: drawId, user_id: user.id, entry_type: 'paid', is_paid: true,
    }));
    const { error: entErr } = await supabase.from('draw_entries').insert(entries);
    if (entErr) throw entErr;

    return new Response(JSON.stringify({ success: true, count }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('wallet-buy-entries error:', e);
    return new Response(JSON.stringify({ error: 'Unable to process request' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});