import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  callGeminiText,
  extractJsonObject,
  requireGeminiKey,
} from "../_shared/gemini.ts";

/* ── Types ─────────────────────────────────────────────── */

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface InterviewPlanData {
  candidate_name: string;
  target_role: string;
  target_seniority: string;
  overall_difficulty: string;
  sections: Record<string, unknown>;
}

interface AnalyzeRequestBody {
  plan: InterviewPlanData;
  conversation: ChatMessage[];
  durationSeconds?: number;
}

interface InterviewAnalysis {
  overall_score: number;
  summary: string;
  metrics: {
    clarity: number;
    depth: number;
    relevance: number;
    communication: number;
  };
  strengths: string[];
  improvements: string[];
}

/* ── Helpers ────────────────────────────────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|[\uDC00-\uDFFF]/g, "\uFFFD")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function formatConversation(messages: ChatMessage[]): string {
  const msgs = messages.slice(-30);
  return msgs
    .map(
      (m) =>
        `[${m.role === "assistant" ? "Interviewer" : "Candidate"}]: ${m.content}`,
    )
    .join("\n\n");
}

function buildPrompt(
  plan: InterviewPlanData,
  conversation: ChatMessage[],
  duration?: number,
): string {
  const candidateName = plan.candidate_name || "the candidate";
  const role = plan.target_role || "the role";
  const seniority = plan.target_seniority || "professional";
  const mins = duration ? Math.floor(duration / 60) : 0;
  const secs = duration ? duration % 60 : 0;
  const durationStr = duration
    ? `${mins} minute${mins === 1 ? "" : "s"} and ${secs} second${secs === 1 ? "" : "s"}`
    : "unknown duration";

  return [
    `You are an expert interview coach. Analyze this mock interview for ${candidateName} for a ${seniority} ${role} position.`,
    ``,
    `INTERVIEW CONTEXT (plan summary):`,
    `- Candidate: ${candidateName}`,
    `- Role: ${role}`,
    `- Seniority: ${seniority}`,
    `- Overall difficulty: ${plan.overall_difficulty || "Not specified"}`,
    `- Duration: ${durationStr}`,
    ``,
    `FULL CONVERSATION TRANSCRIPT:`,
    formatConversation(conversation),
    ``,
    `Analyze the candidate's performance and provide detailed, honest feedback. Consider:`,
    `- Did the candidate answer the questions thoroughly and with relevant examples?`,
    `- How clear, structured, and confident were their responses?`,
    `- Did they demonstrate the required skills and experience?`,
    `- How well did they communicate under pressure?`,
    `- What were their standout moments?`,
    `- Where could they improve?`,
    ``,
    `Respond with ONLY valid JSON (no markdown, no code fences):`,
    `{`,
    `  "overall_score": <number 0-100>,`,
    `  "summary": "<2-3 sentence overall assessment>",`,
    `  "metrics": { "clarity": <0-100>, "depth": <0-100>, "relevance": <0-100>, "communication": <0-100> },`,
    `  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],`,
    `  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]`,
    `}`,
    ``,
    `Be honest and constructive. Scores should reflect real assessment — reserve 90+ for exceptional performances. Never inflate scores.`,
  ].join("\n");
}

/* ── Main handler ──────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      token,
    );
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Parse body
    let body: AnalyzeRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({
        error: "Invalid request body",
        details: "Expected JSON",
      }, 400);
    }

    const { plan, conversation = [], durationSeconds } = body;

    if (!plan || !conversation || conversation.length < 2) {
      return jsonResponse({
        error: "Missing data",
        details:
          "Both plan and conversation (with at least 2 messages) are required.",
      }, 400);
    }

    const systemMessage =
      "You are an expert interview coach and HR professional. " +
      "You analyze mock interview transcripts and provide detailed, honest, actionable feedback. " +
      "Your analysis is specific, constructive, and helps the candidate improve. " +
      "Always respond with valid JSON only, no markdown formatting.";

    const userMessage = buildPrompt(plan, conversation, durationSeconds);

    console.log(
      "[analyze-interview] Request",
      { userId: user.id, messageCount: conversation.length },
    );

    // Gemini only — do not fall back to rate-limited OpenRouter
    requireGeminiKey();
    const rawContent = await callGeminiText({
      system: systemMessage,
      user: userMessage,
      maxOutputTokens: 1500,
      temperature: 0.3,
    });
    console.log("[analyze-interview] Used Gemini");

    const jsonStr = extractJsonObject(rawContent);

    let analysis: InterviewAnalysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error(
        "[analyze-interview] Could not parse JSON",
        jsonStr.slice(0, 200),
      );
      analysis = {
        overall_score: 0,
        summary: "Analysis could not be generated. Please try again.",
        metrics: { clarity: 0, depth: 0, relevance: 0, communication: 0 },
        strengths: [],
        improvements: [],
      };
    }

    // Clamp + sanitize all fields
    analysis.overall_score = Math.max(0, Math.min(100, analysis.overall_score || 0));
    analysis.metrics = {
      clarity: Math.max(0, Math.min(100, analysis.metrics?.clarity || 0)),
      depth: Math.max(0, Math.min(100, analysis.metrics?.depth || 0)),
      relevance: Math.max(0, Math.min(100, analysis.metrics?.relevance || 0)),
      communication: Math.max(
        0,
        Math.min(100, analysis.metrics?.communication || 0),
      ),
    };
    analysis.summary = sanitizeText(analysis.summary || "").slice(0, 600);
    analysis.strengths = (analysis.strengths || []).slice(0, 5).map((s) =>
      sanitizeText(s).slice(0, 200)
    );
    analysis.improvements = (analysis.improvements || []).slice(0, 5).map((s) =>
      sanitizeText(s).slice(0, 200)
    );

    return jsonResponse(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze-interview] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});
