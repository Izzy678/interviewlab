import { createClient } from "jsr:@supabase/supabase-js@2";

interface ResumeData {
  parsed_name?: string;
  parsed_years_experience?: string;
  parsed_skills?: string[];
  parsed_companies?: string[];
  parsed_projects?: string[];
  parsed_education?: string[];
}

interface JobData {
  role?: string;
  seniority?: string;
  required_skills?: string[];
  nice_to_have_skills?: string[];
  responsibilities?: string[];
}

interface InterviewQuestion {
  id: string;
  question: string;
  category: "recruiter" | "behavioral" | "technical" | "follow_up";
  difficulty: "easy" | "medium" | "hard";
  focus_area: string;
  expected_answer_points: string[];
  context?: string;
}

interface InterviewPlanSection {
  title: string;
  description: string;
  questions: InterviewQuestion[];
}

interface InterviewPlanResponse {
  candidate_name: string;
  target_role: string;
  target_seniority: string;
  overall_difficulty: string;
  sections: {
    recruiter_questions: InterviewPlanSection;
    behavioral_questions: InterviewPlanSection;
    technical_questions: InterviewPlanSection;
    follow_up_questions: InterviewPlanSection;
  };
  preparation_tips: string[];
}

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

Deno.serve(async (req: Request) => {
  // CORS
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

    // Parse request body
    let body: {
      resumeData?: ResumeData;
      jobData?: JobData;
      targetLevel?: string;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body", details: "Expected JSON" },
        400,
      );
    }

    const { resumeData, jobData, targetLevel } = body;

    if (!resumeData && !jobData) {
      return jsonResponse(
        {
          error: "Missing data",
          details: "At least one of resumeData or jobData is required.",
        },
        400,
      );
    }

    const systemMessage =
      "You are an expert interview coach and technical recruiter. " +
      "You generate detailed, tailored interview plans based on a candidate's resume " +
      "and a target job description. Your plans are realistic, rigorous, and help the " +
      "candidate prepare effectively. Always respond with valid JSON only, no markdown formatting.";

    const resumeSection = resumeData
      ? [
          "## CANDIDATE RESUME PROFILE",
          `Name: ${resumeData.parsed_name || "Unknown"}`,
          `Years of Experience: ${resumeData.parsed_years_experience || "Not specified"}`,
          `Skills: ${(resumeData.parsed_skills || []).join(", ")}`,
          `Companies: ${(resumeData.parsed_companies || []).join(", ")}`,
          `Education: ${(resumeData.parsed_education || []).join(", ")}`,
          `Projects: ${(resumeData.parsed_projects || []).join(", ")}`,
        ].join("\n")
      : "No resume data provided.";

    const jobSection = jobData
      ? [
          "## TARGET JOB DESCRIPTION",
          `Role: ${jobData.role || "Not specified"}`,
          `Seniority: ${jobData.seniority || "Not specified"}`,
          `Required Skills: ${(jobData.required_skills || []).join(", ")}`,
          `Nice-to-have Skills: ${(jobData.nice_to_have_skills || []).join(", ")}`,
          `Responsibilities: ${(jobData.responsibilities || []).join(", ")}`,
        ].join("\n")
      : "No job description data provided.";

    const targetLevelStr = targetLevel || "Mid Level";

    const userMessage = [
      `Generate a comprehensive interview plan for a ${targetLevelStr} position.`,
      "",
      resumeSection,
      "",
      jobSection,
      "",
      "Return ONLY valid JSON with this exact structure:",
      `{`,
      `  "candidate_name": "Candidate's name from resume",`,
      `  "target_role": "Job title from the job description",`,
      `  "target_seniority": "${targetLevelStr}",`,
      `  "overall_difficulty": "One of: Easy, Medium, Hard, Very Hard — based on the candidate's experience vs job requirements gap",`,
      `  "sections": {`,
      `    "recruiter_questions": {`,
      `      "title": "Recruiter / Screening Questions",`,
      `      "description": "Brief description of this section",`,
      `      "questions": [`,
      `        {`,
      `          "id": "r1",`,
      `          "question": "The full question text",`,
      `          "category": "recruiter",`,
      `          "difficulty": "easy|medium|hard",`,
      `          "focus_area": "What skill/area this tests",`,
      `          "expected_answer_points": ["Key point 1", "Key point 2"],`,
      `          "context": "Optional context about why this question is relevant to this candidate"`,
      `        }`,
      `      ]`,
      `    },`,
      `    "behavioral_questions": { ... same structure ..., "category": "behavioral" },`,
      `    "technical_questions": { ... same structure ..., "category": "technical" },`,
      `    "follow_up_questions": { ... same structure ..., "category": "follow_up" }`,
      `  },`,
      `  "preparation_tips": ["Tip 1", "Tip 2", "Tip 3"]`,
      `}`,
      "",
      "RULES:",
      "- recruiter_questions: 3-4 questions about background, availability, salary expectations, logistics",
      "- behavioral_questions: 4-5 STAR-method questions based on the candidate's actual experience and the job's responsibilities",
      "- technical_questions: 5-7 questions testing the required skills, including coding/architecture/system design as appropriate",
      "- follow_up_questions: 3-4 deeper-dive questions that build on the technical questions",
      "- Each question's difficulty should be calibrated to the candidate's experience level vs the job's seniority",
      "- expected_answer_points should list 2-4 concrete things a strong answer would cover",
      "- context field: reference specific items from the resume or job description (e.g. 'Based on your React experience at Google')",
      "- preparation_tips: 3-5 actionable tips specific to this candidate and role",
      "- Do not invent data. Use empty string or empty array for missing fields.",
      "- Keep questions realistic and specific — avoid generic questions that don't relate to the candidate or role.",
    ].join("\n");

    console.log(
      "[generate-interview-plan] Request",
      { userId: user.id },
    );

    // Try providers: Gemini → OpenRouter
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!geminiKey && !openRouterKey) {
      return jsonResponse({
        error: "No AI provider configured",
        details: "Set GEMINI_API_KEY or OPENROUTER_API_KEY secret.",
      }, 503);
    }

    const providers: { name: string; call: () => Promise<string> }[] = [];

    if (geminiKey) {
      providers.push({
        name: "Gemini",
        call: () => callGemini(systemMessage, userMessage, geminiKey),
      });
    }
    if (openRouterKey) {
      providers.push({
        name: "OpenRouter",
        call: () =>
          callOpenRouter(
            systemMessage,
            userMessage,
            openRouterKey,
            Deno.env.get("OPENROUTER_MODEL") || "openrouter/free",
          ),
      });
    }

    let lastError: Error | null = null;
    let rawContent = "";
    let providerUsed = "";

    for (const provider of providers) {
      try {
        rawContent = await provider.call();
        providerUsed = provider.name;
        console.log("[generate-interview-plan] Used provider", provider.name);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[generate-interview-plan] ${provider.name} failed`,
          lastError.message,
        );
      }
    }

    if (!rawContent) {
      throw lastError || new Error("All AI providers failed");
    }

    // Clean markdown code fences from the response
    const jsonStr = rawContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let plan: InterviewPlanResponse;
    try {
      plan = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error(
          "[generate-interview-plan] could not parse JSON",
          jsonStr.slice(0, 300),
        );
        throw new Error(
          providerUsed + " returned invalid JSON: " + jsonStr.slice(0, 200),
        );
      }
      plan = JSON.parse(match[0]);
    }

    // Ensure all required fields exist
    if (!plan.sections) {
      plan.sections = {
        recruiter_questions: { title: "Recruiter Questions", description: "", questions: [] },
        behavioral_questions: { title: "Behavioral Questions", description: "", questions: [] },
        technical_questions: { title: "Technical Questions", description: "", questions: [] },
        follow_up_questions: { title: "Follow-Up Questions", description: "", questions: [] },
      };
    }

    // Sanitize text fields
    const sanitize = (obj: Record<string, unknown>) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = sanitizeText(obj[key] as string);
        }
      }
      return obj;
    };

    // Save to database (async, non-blocking)
    try {
      const planData = {
        user_id: user.id,
        candidate_name: sanitizeText(plan.candidate_name || ""),
        target_role: sanitizeText(plan.target_role || ""),
        target_seniority: sanitizeText(plan.target_seniority || ""),
        overall_difficulty: sanitizeText(plan.overall_difficulty || ""),
        plan_data: plan,
        preparation_tips: (plan.preparation_tips || []).map(sanitizeText),
      };

      const { error: insertError } = await supabase
        .from("interview_plans")
        .insert(planData);

      if (insertError) {
        console.error(
          "[generate-interview-plan] Failed to save plan",
          insertError.message,
        );
      }
    } catch (dbErr) {
      // Non-fatal — plan is still returned to the client
      console.error(
        "[generate-interview-plan] DB save error",
        dbErr instanceof Error ? dbErr.message : String(dbErr),
      );
    }

    return jsonResponse(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-interview-plan] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});

/* ── AI Provider callers ──────────────────────────────── */

async function callGemini(
  systemMessage: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMessage }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generation_config: { maxOutputTokens: 4000, temperature: 0.2 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

async function callOpenRouter(
  systemMessage: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://interviewlab.app",
      "X-Title": "InterviewLab",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}