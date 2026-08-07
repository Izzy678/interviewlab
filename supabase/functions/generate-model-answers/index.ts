import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  callGeminiText,
  extractJsonObject,
  isValidJson,
  requireGeminiKey,
} from "../_shared/gemini.ts";

/* ── Types ─────────────────────────────────────────────── */

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface InterviewBriefing {
  focus_skills?: string[];
  resume_gap?: { skill?: string; note?: string } | null;
}

interface InterviewPlanData {
  candidate_name?: string;
  target_role?: string;
  target_seniority?: string;
  overall_difficulty?: string;
  briefing?: InterviewBriefing;
}

interface ResumeSummary {
  parsed_name?: string;
  parsed_years_experience?: string;
  parsed_skills?: string[];
  parsed_companies?: string[];
  parsed_projects?: string[];
  parsed_education?: string[];
}

interface ModelAnswerItem {
  /** The interviewer's question, verbatim (cleaned). */
  question: string;
  /** recruiter | behavioral | technical | follow_up */
  category: string;
  /** The candidate's actual answer from the conversation (may be empty). */
  userAnswer: string;
  /** First-person, resume-grounded model answer (3–6 sentences). */
  modelAnswer: string;
}

interface ModelAnswersResponse {
  answers: ModelAnswerItem[];
  /** How many interviewer turns were skipped as non-questions (greeting/wrap-up). */
  skipped: number;
}

interface GenerateRequestBody {
  plan: InterviewPlanData;
  conversation: ChatMessage[];
  /** Optional — when omitted, the function loads the user's latest parsed resume. */
  resumeSummary?: ResumeSummary;
}

/* ── Helpers ───────────────────────────────────────────── */

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
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim();
}

function formatConversation(messages: ChatMessage[]): string {
  const msgs = messages.slice(-40);
  return msgs
    .map(
      (m) =>
        `[${m.role === "assistant" ? "Interviewer" : "Candidate"}]: ${m.content}`,
    )
    .join("\n\n");
}

function buildResumeBlock(
  plan: InterviewPlanData,
  resume?: ResumeSummary,
): string {
  const candidateName =
    resume?.parsed_name || plan.candidate_name || "the candidate";
  const lines: string[] = [`- Candidate name: ${candidateName}`];
  lines.push(`- Target role: ${plan.target_role || "the role"}`);
  lines.push(
    `- Seniority: ${plan.target_seniority || "professional"} · Difficulty: ${plan.overall_difficulty || "Medium"}`,
  );

  if (resume) {
    if (resume.parsed_years_experience) {
      lines.push(
        `- Years of experience (per resume): ${resume.parsed_years_experience}`,
      );
    }
    if (resume.parsed_skills?.length) {
      lines.push(`- Resume skills: ${resume.parsed_skills.join(", ")}`);
    }
    if (resume.parsed_companies?.length) {
      lines.push(`- Resume companies: ${resume.parsed_companies.join(", ")}`);
    }
    if (resume.parsed_projects?.length) {
      lines.push(`- Resume projects: ${resume.parsed_projects.join(", ")}`);
    }
    if (resume.parsed_education?.length) {
      lines.push(`- Resume education: ${resume.parsed_education.join(", ")}`);
    }
  }

  const focusSkills = plan.briefing?.focus_skills;
  if (focusSkills?.length) {
    lines.push(`- Role focus skills: ${focusSkills.join(", ")}`);
  }
  const gap = plan.briefing?.resume_gap;
  if (gap?.skill && gap.note) {
    lines.push(`- Known resume gap: ${gap.skill} — ${gap.note}`);
  }

  return lines.join("\n");
}

function buildPrompt(
  plan: InterviewPlanData,
  conversation: ChatMessage[],
  resume?: ResumeSummary,
): string {
  return [
    `You are an expert interview coach. A candidate just finished a mock interview for ${plan.target_role || "a role"}.`,
    ``,
    `CANDIDATE CONTEXT (ground every model answer in this — NEVER invent experience that is not listed):`,
    buildResumeBlock(plan, resume),
    ``,
    `FULL CONVERSATION TRANSCRIPT:`,
    formatConversation(conversation),
    ``,
    `TASK:`,
    `1. Extract EVERY substantive question the interviewer asked during the interview.`,
    `   - Skip the opening greeting / icebreaker and any final wrap-up, thank-you, or goodbye.`,
    `   - Skip purely transitional utterances that contain no real question.`,
    `   - Keep questions verbatim where possible; clean up filler like "Tell me..." only if needed.`,
    `2. For each extracted question, capture the candidate's ACTUAL answer from the transcript (userAnswer). If the candidate gave no real answer (e.g. "[NO_SPEECH_DETECTED]"), leave userAnswer as an empty string.`,
    `3. Write a modelAnswer — how the candidate COULD have answered — satisfying ALL rules:`,
    `   - Answer in FIRST PERSON as the candidate ("I led...", "I built..."), never as the interviewer or as a coach.`,
    `   - Ground it in the candidate's resume: use their real skills, companies, projects, and experience above.`,
    `   - NEVER invent experience, companies, projects, or skills not present in the candidate context.`,
    `   - When the resume doesn't cover the topic, give a credible, generic-but-specific answer a strong candidate could give, and keep it plausible — do not fabricate named employers.`,
    `   - Interview-length: 3–6 sentences, spoken naturally. No markdown, no bullets, no headings.`,
    `   - Directly answer the question asked; use the STAR structure (Situation/Task/Action/Result) for behavioral questions.`,
    `4. Classify each question: "recruiter" | "behavioral" | "technical" | "follow_up".`,
    ``,
    `Respond with ONLY valid JSON (no markdown, no code fences):`,
    `{`,
    `  "answers": [`,
    `    { "question": "...", "category": "behavioral", "userAnswer": "...", "modelAnswer": "..." }`,
    `  ],`,
    `  "skipped": <number of interviewer turns you skipped as non-questions>`,
    `}`,
    ``,
    `If there are NO substantive questions (e.g. the interview never started), return {"answers": [], "skipped": 0}.`,
  ].join("\n");
}

function clampAnswers(raw: ModelAnswersResponse): ModelAnswersResponse {
  const items = Array.isArray(raw?.answers) ? raw.answers : [];
  const answers: ModelAnswerItem[] = items
    .slice(0, 15)
    .map((item) => {
      const question = sanitizeText(item.question || "").slice(0, 500);
      const modelAnswer = sanitizeText(item.modelAnswer || "").slice(0, 1200);
      const userAnswer = sanitizeText(item.userAnswer || "").slice(0, 2000);
      const category = ["recruiter", "behavioral", "technical", "follow_up"]
        .includes(item.category)
        ? item.category
        : "behavioral";
      // Only keep pairs that actually have a question + a model answer.
      if (!question || !modelAnswer) return null;
      return { question, category, userAnswer, modelAnswer };
    })
    .filter((x): x is ModelAnswerItem => x !== null);

  return {
    answers,
    skipped: typeof raw?.skipped === "number" ? raw.skipped : 0,
  };
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
    let body: GenerateRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({
        error: "Invalid request body",
        details: "Expected JSON",
      }, 400);
    }

    const { plan, conversation = [], resumeSummary } = body;

    if (!plan) {
      return jsonResponse({
        error: "Missing plan",
        details: "An interview plan is required.",
      }, 400);
    }
    if (conversation.length < 2) {
      return jsonResponse({
        error: "Missing conversation",
        details: "At least 2 messages are required to extract questions.",
      }, 400);
    }

    // Load the user's latest parsed resume when no summary was passed
    let resume: ResumeSummary | undefined = resumeSummary;
    if (!resume || !resume.parsed_skills?.length) {
      try {
        const { data: rows } = await supabase
          .from("resumes")
          .select(
            "parsed_name, parsed_years_experience, parsed_skills, parsed_companies, parsed_projects, parsed_education",
          )
          .eq("user_id", user.id)
          .order("parsed_at", { ascending: false })
          .limit(1);
        if (rows && rows.length > 0) {
          resume = { ...(resume || {}), ...(rows[0] as ResumeSummary) };
        }
      } catch (err) {
        console.warn(
          "[generate-model-answers] resume lookup failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const systemMessage =
      "You are an expert interview coach. You show candidates how they could have " +
      "answered each interview question, writing strong first-person answers grounded " +
      "strictly in the candidate's own resume. You never invent experience that is not " +
      "in the candidate context. Answers are natural spoken interview responses, " +
      "3–6 sentences, no markdown. Always respond with valid JSON only.";

    const userMessage = buildPrompt(plan, conversation, resume);

    console.log(
      "[generate-model-answers] Request",
      { userId: user.id, messageCount: conversation.length },
    );

    // Gemini only — disable thinking so the full JSON fits in the output budget
    requireGeminiKey();
    let rawContent = await callGeminiText({
      system: systemMessage,
      user: userMessage,
      maxOutputTokens: 8192,
      temperature: 0.3,
      thinkingBudget: 0,
      jsonMode: true,
    });
    console.log("[generate-model-answers] Used Gemini", {
      chars: rawContent.length,
    });

    // One repair pass if the first reply was truncated / invalid JSON
    if (!isValidJson(rawContent)) {
      console.warn(
        "[generate-model-answers] Invalid/truncated JSON — requesting repair",
      );
      rawContent = await callGeminiText({
        system:
          "You repair truncated JSON. Return ONLY the completed valid JSON object. No markdown.",
        user: [
          "The following model-answers JSON was cut off. Complete it to valid JSON matching the schema:",
          '{ "answers": [{ "question": "...", "category": "behavioral", "userAnswer": "...", "modelAnswer": "..." }], "skipped": 0 }',
          "Keep answers to 3–6 sentences. You may drop the last incomplete item if needed.",
          "",
          "TRUNCATED JSON:",
          rawContent.slice(0, 7000),
        ].join("\n"),
        maxOutputTokens: 8192,
        temperature: 0,
        thinkingBudget: 0,
        jsonMode: true,
      });
    }

    const jsonStr = extractJsonObject(rawContent);

    let result: ModelAnswersResponse;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.error(
        "[generate-model-answers] could not parse JSON",
        jsonStr.slice(0, 300),
      );
      throw new Error(
        "Gemini returned invalid JSON: " + jsonStr.slice(0, 200),
      );
    }

    result = clampAnswers(result);
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-model-answers] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});
