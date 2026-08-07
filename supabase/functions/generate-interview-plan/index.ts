import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  callGeminiText,
  extractJsonObject,
  isValidJson,
  requireGeminiKey,
} from "../shared/gemini";

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
      `Generate a focused interview plan for a ${targetLevelStr} position.`,
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
      `  "overall_difficulty": "One of: Easy, Medium, Hard, Very Hard",`,
      `  "sections": {`,
      `    "recruiter_questions": {`,
      `      "title": "Recruiter / Screening Questions",`,
      `      "description": "Brief description",`,
      `      "questions": [`,
      `        {`,
      `          "id": "r1",`,
      `          "question": "The full question text",`,
      `          "category": "recruiter",`,
      `          "difficulty": "easy|medium|hard",`,
      `          "focus_area": "What this tests",`,
      `          "expected_answer_points": ["Point 1", "Point 2"],`,
      `          "context": "Why relevant to this candidate"`,
      `        }`,
      `      ]`,
      `    },`,
      `    "behavioral_questions": { "title": "...", "description": "...", "questions": [/* same shape, category behavioral */] },`,
      `    "technical_questions": { "title": "...", "description": "...", "questions": [/* same shape, category technical */] },`,
      `    "follow_up_questions": { "title": "...", "description": "...", "questions": [/* same shape, category follow_up */] }`,
      `  },`,
      `  "preparation_tips": ["Tip 1", "Tip 2", "Tip 3"]`,
      `}`,
      "",
      "RULES:",
      "- Keep the entire response under 3500 tokens. Be concise.",
      "- recruiter_questions: exactly 3 questions",
      "- behavioral_questions: exactly 4 questions (STAR-method)",
      "- technical_questions: exactly 5 questions",
      "- follow_up_questions: exactly 3 questions",
      "- expected_answer_points: 2 short bullets each",
      "- context: one short sentence",
      "- preparation_tips: exactly 3 tips",
      "- Do not invent data. Use empty string or empty array for missing fields.",
      "- Output complete valid JSON only — no markdown, no trailing commentary.",
    ].join("\n");

    console.log(
      "[generate-interview-plan] Request",
      { userId: user.id },
    );

    // Gemini only — disable thinking so the full JSON fits in the output budget
    requireGeminiKey();
    let rawContent = await callGeminiText({
      system: systemMessage,
      user: userMessage,
      maxOutputTokens: 8192,
      temperature: 0.2,
      thinkingBudget: 0,
      jsonMode: true,
    });
    console.log("[generate-interview-plan] Used Gemini", {
      chars: rawContent.length,
    });

    // One repair pass if the first reply was truncated / invalid JSON
    if (!isValidJson(rawContent)) {
      console.warn(
        "[generate-interview-plan] Invalid/truncated JSON — requesting repair",
      );
      rawContent = await callGeminiText({
        system:
          "You repair truncated JSON. Return ONLY the completed valid JSON object. No markdown.",
        user: [
          "The following interview-plan JSON was cut off. Complete it to valid JSON matching the schema (candidate_name, target_role, target_seniority, overall_difficulty, sections with recruiter_questions/behavioral_questions/technical_questions/follow_up_questions, preparation_tips). Keep question counts small if needed.",
          "",
          "TRUNCATED JSON:",
          rawContent.slice(0, 6000),
        ].join("\n"),
        maxOutputTokens: 8192,
        temperature: 0,
        thinkingBudget: 0,
        jsonMode: true,
      });
    }

    const jsonStr = extractJsonObject(rawContent);

    let plan: InterviewPlanResponse;
    try {
      plan = JSON.parse(jsonStr);
    } catch {
      console.error(
        "[generate-interview-plan] could not parse JSON",
        jsonStr.slice(0, 300),
      );
      throw new Error(
        "Gemini returned invalid JSON: " + jsonStr.slice(0, 200),
      );
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
