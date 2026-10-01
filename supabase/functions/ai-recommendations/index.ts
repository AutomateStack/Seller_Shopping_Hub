import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productId } = await req.json();
    if (!productId) throw new Error("productId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load current product
    const { data: current } = await supabase
      .from("products")
      .select("id, name, category, description, price")
      .eq("id", productId)
      .maybeSingle();
    if (!current) throw new Error("Product not found");

    // Candidate pool: same category first, fallback to recent
    let { data: candidates } = await supabase
      .from("products")
      .select("id, name, category, description, price")
      .neq("id", productId)
      .gt("stock", 0)
      .eq("category", current.category ?? "")
      .limit(30);

    if (!candidates || candidates.length < 4) {
      const { data: extra } = await supabase
        .from("products")
        .select("id, name, category, description, price")
        .neq("id", productId)
        .gt("stock", 0)
        .order("created_at", { ascending: false })
        .limit(30);
      candidates = extra || [];
    }

    if (!candidates.length) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI not configured");

    const prompt = `Pick the 4 best products to recommend as complements/alternatives to the customer who is viewing this product. Return ONLY a JSON array of 4 product IDs (strings), most relevant first.

CURRENT PRODUCT:
${JSON.stringify({ name: current.name, category: current.category, price: current.price, description: (current.description || "").slice(0, 200) })}

CANDIDATES:
${candidates.map(c => `- id=${c.id} | ${c.name} | ${c.category} | ₹${c.price}`).join("\n")}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a shopping assistant. Reply with ONLY a JSON array of product IDs, no prose." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiRes.status === 429 || aiRes.status === 402) {
      return new Response(JSON.stringify({ recommendations: candidates.slice(0, 4).map(c => c.id) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const text: string = ai.choices?.[0]?.message?.content ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    let ids: string[] = [];
    try { ids = JSON.parse(match?.[0] ?? "[]"); } catch { ids = []; }
    const valid = ids.filter(id => candidates!.some(c => c.id === id)).slice(0, 4);
    const final = valid.length ? valid : candidates.slice(0, 4).map(c => c.id);

    return new Response(JSON.stringify({ recommendations: final }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommendations error:", e);
    return new Response(JSON.stringify({ recommendations: [], error: "Failed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});