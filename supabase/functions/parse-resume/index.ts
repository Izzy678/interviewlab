import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf";
import {
  callGeminiText,
  extractJsonObject,
  requireGeminiKey,
} from "../shared/gemini";

interface ParsedResume {
  name: string;
  years_experience: string;
  skills: string[];
  companies: string[];
  projects: string[];
  education: string[];
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|[\uDC00-\uDFFF]/g, "\uFFFD")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function sanitizeArray(values: string[]): string[] {
  return (values || []).map((v) => sanitizeText(String(v)));
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
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      token,
    );
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: { filePath?: string; fileName?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body", details: "Expected JSON with filePath" },
        400,
      );
    }

    const { filePath, fileName } = body;
    if (!filePath) {
      return jsonResponse({ error: "filePath is required" }, 400);
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      return jsonResponse(
        {
          error: "Failed to download file",
          details: downloadError?.message,
        },
        500,
      );
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    const rawText = sanitizeText(String(extracted || ""));

    if (!rawText.trim()) {
      return jsonResponse(
        {
          error:
            "Could not extract text from the PDF. The file may be scanned or image-based.",
        },
        400,
      );
    }

    // Gemini only — do not fall back to rate-limited OpenRouter
    requireGeminiKey();
    const parsed = await extractWithGemini(rawText.slice(0, 12000));
    console.log("[parse-resume] Used Gemini");

    const insertPayload = {
      user_id: user.id,
      file_path: sanitizeText(filePath),
      file_name: sanitizeText(
        fileName || filePath.split("/").pop() || "resume.pdf",
      ),
      raw_text: rawText.slice(0, 10000),
      parsed_name: sanitizeText(parsed.name),
      parsed_years_experience: sanitizeText(parsed.years_experience),
      parsed_skills: sanitizeArray(parsed.skills),
      parsed_companies: sanitizeArray(parsed.companies),
      parsed_projects: sanitizeArray(parsed.projects),
      parsed_education: sanitizeArray(parsed.education),
      parsed_at: new Date().toISOString(),
    };

    const { data: resumeRecord, error: insertError } = await supabase
      .from("resumes")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("[parse-resume] insert failed:", insertError.message);
      return jsonResponse(
        {
          error: "Failed to save parsed resume",
          details: insertError.message,
        },
        500,
      );
    }

    return jsonResponse({ resume: resumeRecord });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[parse-resume] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});

async function extractWithGemini(text: string): Promise<ParsedResume> {
  const systemMessage =
    "You are a resume parsing assistant. Extract structured data from resumes. Always respond with valid JSON only, no markdown formatting.";

  const userMessage = [
    "Extract structured information from the following resume text.",
    "",
    "Return ONLY valid JSON with these exact fields:",
    "{",
    '  "name": "Full name of the candidate",',
    '  "years_experience": "Total years of professional experience (e.g. 5 years or 3-5 years or Entry level if not clear)",',
    '  "skills": ["List of technical and professional skills"],',
    '  "companies": ["Previous companies worked at"],',
    '  "projects": ["Notable projects mentioned"],',
    '  "education": ["Educational qualifications"]',
    "}",
    "",
    "If a field cannot be determined, use an empty string or empty array as appropriate.",
    "",
    "RESUME TEXT:",
    text,
  ].join("\n");

  const content = await callGeminiText({
    system: systemMessage,
    user: userMessage,
    maxOutputTokens: 2000,
    temperature: 0.1,
  });

  const jsonStr = extractJsonObject(content);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("AI returned invalid JSON: " + jsonStr.slice(0, 200));
  }

  return {
    name: String(parsed.name || ""),
    years_experience: String(parsed.years_experience || ""),
    skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
    companies: Array.isArray(parsed.companies)
      ? parsed.companies.map(String)
      : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects.map(String) : [],
    education: Array.isArray(parsed.education)
      ? parsed.education.map(String)
      : [],
  };
}
