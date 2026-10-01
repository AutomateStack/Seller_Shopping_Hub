import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questionId, selectedOption } = await req.json();
    if (!questionId || typeof questionId !== "string" || typeof selectedOption !== "number") {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If the user already answered this question, return the locked result
    // (do NOT allow repeated calls to probe for the correct answer).
    const { data: existingLock } = await svc
      .from("quiz_answer_locks")
      .select("is_correct")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (existingLock) {
      return new Response(
        JSON.stringify({ is_correct: existingLock.is_correct }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: q, error } = await svc
      .from("quiz_questions")
      .select("correct_option, quiz_id")
      .eq("id", questionId)
      .single();
    if (error || !q) {
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCorrect = selectedOption === q.correct_option;
    // Lock the first answer for this (user, question). Race-safe via unique index.
    await svc.from("quiz_answer_locks").insert({
      user_id: user.id,
      question_id: questionId,
      quiz_id: q.quiz_id,
      selected_option: selectedOption,
      is_correct: isCorrect,
    });

    // Do NOT return correct_option — that would make this an answer oracle.
    return new Response(
      JSON.stringify({ is_correct: isCorrect }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("grade-quiz-answer error:", e);
    return new Response(JSON.stringify({ error: "Unable to process request" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});