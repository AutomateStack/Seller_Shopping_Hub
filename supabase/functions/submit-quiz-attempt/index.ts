import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { quizId, answers } = await req.json();
    if (!quizId || typeof quizId !== "string" || !Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // answers = [{ questionId: string, selectedOption: number }]
    for (const a of answers) {
      if (!a || typeof a.questionId !== "string" || typeof a.selectedOption !== "number") {
        return new Response(JSON.stringify({ error: "Invalid answers" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (answers.length > 100) {
      return new Response(JSON.stringify({ error: "Too many answers" }), {
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

    // One attempt per user per quiz
    const { data: existing } = await svc
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Already attempted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quiz, error: quizErr } = await svc
      .from("quizzes")
      .select("id, passing_score, questions_per_attempt")
      .eq("id", quizId)
      .single();
    if (quizErr || !quiz) {
      return new Response(JSON.stringify({ error: "Quiz not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute score from locked-in answers only. Client-supplied answers
    // are ignored so users can't submit anything they haven't already
    // committed to via grade-quiz-answer.
    const qIds = answers.map((a: any) => a.questionId);
    const { data: locks } = await svc
      .from("quiz_answer_locks")
      .select("question_id, is_correct, quiz_id")
      .eq("user_id", user.id)
      .in("question_id", qIds);
    let score = 0;
    for (const l of (locks || [])) {
      if (l.quiz_id === quizId && l.is_correct) score += 1;
    }

    const passingScore = quiz.passing_score ?? 3;
    const won = score >= passingScore;

    const { error: insErr } = await svc.from("quiz_attempts").insert({
      quiz_id: quizId,
      user_id: user.id,
      score,
      total_questions: answers.length,
      questions_answered: qIds,
      prize_won: won,
      prize_amount: 0,
    });
    if (insErr) throw insErr;

    // Grant a free draw entry on win (idempotent per draw+user+entry_type)
    if (won) {
      const { data: activeDraw } = await svc
        .from("draws")
        .select("id")
        .in("status", ["active", "upcoming"])
        .order("draw_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeDraw) {
        const { data: existingEntry } = await svc
          .from("draw_entries")
          .select("id")
          .eq("draw_id", activeDraw.id)
          .eq("user_id", user.id)
          .eq("entry_type", "quiz")
          .maybeSingle();
        if (!existingEntry) {
          await svc.from("draw_entries").insert({
            draw_id: activeDraw.id,
            user_id: user.id,
            entry_type: "quiz",
            is_paid: false,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, score, won }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-quiz-attempt error:", e);
    return new Response(JSON.stringify({ error: "Unable to submit quiz" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});