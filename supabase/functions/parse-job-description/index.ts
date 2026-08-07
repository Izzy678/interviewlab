import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  callGeminiText,
  extractJsonObject,
  requireGeminiKey,
} from "../_shared/gemini.ts";

interface ParsedJobDescription {
  role: string;
  seniority: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
}

// Strip characters that break JSON.stringify / Postgres text / PostgREST.
function sanitizeText(value: string): string {
  return value
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|[\uDC00-\uDFFF]/g,
      "\uFFFD",
    )
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function sanitizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => sanitizeText(String(v ?? ""))).filter(Boolean);
}

/** Truncate by Unicode code points so we never split emoji / surrogate pairs. */
function truncateText(value: string, maxChars: number): string {
  return sanitizeText(Array.from(value).slice(0, maxChars).join(""));
}

function isEmptyParsed(parsed: ParsedJobDescription): boolean {
  return (
    !parsed.role &&
    !parsed.seniority &&
    parsed.required_skills.length === 0 &&
    parsed.nice_to_have_skills.length === 0 &&
    parsed.responsibilities.length === 0
  );
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error: "Server misconfigured",
          details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: { rawText?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error: "Invalid request body",
          details: "Expected JSON with rawText",
        },
        400,
      );
    }

    const { rawText } = body;
    if (!rawText || !rawText.trim()) {
      return jsonResponse({ error: "rawText is required" }, 400);
    }

    const sanitizedText = sanitizeText(rawText.trim());
    console.log("[parse-job-description] start", {
      userId: user.id,
      textLength: sanitizedText.length,
    });

    // Gemini only — do not fall back to rate-limited OpenRouter
    requireGeminiKey();
    const { parsed, rawContent } = await extractWithGemini(
      truncateText(sanitizedText, 8000),
    );
    console.log("[parse-job-description] Used Gemini", parsed);

    if (isEmptyParsed(parsed)) {
      return jsonResponse(
        {
          error: "Gemini returned empty job description fields",
          details:
            "The model could not find role/skills/responsibilities in the provided text.",
          parsed,
          geminiRaw: truncateText(rawContent, 1500),
          textPreview: truncateText(sanitizedText, 400),
        },
        422,
      );
    }

    const insertPayload = {
      user_id: user.id,
      raw_text: truncateText(sanitizedText, 2000),
      parsed_role: sanitizeText(parsed.role),
      parsed_seniority: sanitizeText(parsed.seniority),
      parsed_required_skills: sanitizeArray(parsed.required_skills),
      parsed_nice_to_have_skills: sanitizeArray(parsed.nice_to_have_skills),
      parsed_responsibilities: sanitizeArray(parsed.responsibilities),
      parsed_at: new Date().toISOString(),
    };

    const { data: jdRecord, error: insertError } = await supabase
      .from("job_descriptions")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      // Parsing succeeded — return structured fields so preparing room can continue.
      console.error(
        "[parse-job-description] insert failed:",
        insertError.message,
        insertError,
      );
      return jsonResponse({
        jobDescription: null,
        parsed,
        saveError: insertError.message,
        geminiRaw: truncateText(rawContent, 1500),
        textPreview: truncateText(sanitizedText, 400),
      });
    }

    return jsonResponse({
      jobDescription: jdRecord,
      parsed,
      geminiRaw: truncateText(rawContent, 1500),
      textPreview: truncateText(sanitizedText, 400),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[parse-job-description] unhandled", message);
    return jsonResponse({ error: message }, 500);
  }
});

async function extractWithGemini(
  text: string,
): Promise<{ parsed: ParsedJobDescription; rawContent: string }> {
  const systemMessage =
    "You are a job description parsing assistant. Extract structured data from job descriptions. Always respond with valid JSON only, no markdown formatting.";

  const userMessage = [
    "Extract structured information from the following job description.",
    "",
    "Return ONLY valid JSON with these exact fields:",
    "{",
    '  "role": "Job title / role name",',
    '  "seniority": "Seniority level (e.g. Entry Level, Mid Level, Senior, Staff, Principal, Lead, Manager, Intern)",',
    '  "required_skills": ["List of required / must-have skills, technologies, and qualifications"],',
    '  "nice_to_have_skills": ["List of nice-to-have / preferred skills and qualifications"],',
    '  "responsibilities": ["List of key job responsibilities and day-to-day tasks"]',
    "}",
    "",
    "If a field cannot be determined, use an empty string or empty array as appropriate.",
    "Do not invent data that is not present in the job description.",
    "",
    "JOB DESCRIPTION:",
    text,
  ].join("\n");

  const content = await callGeminiText({
    system: systemMessage,
    user: userMessage,
    maxOutputTokens: 1500,
    temperature: 0.1,
  });

  return { parsed: normalizeParsedJson(content), rawContent: content };
}

function normalizeParsedJson(rawContent: string): ParsedJobDescription {
  const jsonStr = extractJsonObject(rawContent);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("AI returned invalid JSON: " + jsonStr.slice(0, 200));
  }

  const asString = (v: unknown) =>
    v == null ? "" : Array.isArray(v) ? v.map(String).join(", ") : String(v);
  const asArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) {
      return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  return {
    role: asString(parsed.role || parsed.title || parsed.job_title || parsed.position),
    seniority: asString(
      parsed.seniority ||
        parsed.level ||
        parsed.seniority_level ||
        parsed.experience_level,
    ),
    required_skills: asArray(
      parsed.required_skills ||
        parsed.requirements ||
        parsed.must_have ||
        parsed.required_qualifications,
    ),
    nice_to_have_skills: asArray(
      parsed.nice_to_have_skills ||
        parsed.preferred_skills ||
        parsed.nice_to_have ||
        parsed.preferred_qualifications,
    ),
    responsibilities: asArray(
      parsed.responsibilities ||
        parsed.responsibility ||
        parsed.duties ||
        parsed.what_you_will_do,
    ),
  };
}
