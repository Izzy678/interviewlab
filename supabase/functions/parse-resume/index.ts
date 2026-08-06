import { createClient } from "jsr:@supabase/supabase-js@2";

interface ParsedResume {
  name: string;
  years_experience: string;
  skills: string[];
  companies: string[];
  projects: string[];
  education: string[];
}

// PostgreSQL rejects lone Unicode surrogates (e.g. \uD800) in JSON — replace them
// with the U+FFFD replacement character so inserts never fail with
// "unsupported Unicode escape sequence".
function sanitizeText(value: string): string {
  return value.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|[\uDC00-\uDFFF]/g,
    "\uFFFD"
  );
}

function sanitizeArray(values: string[]): string[] {
  return (values || []).map((v) => sanitizeText(String(v)));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Strip "Bearer " prefix — getUser() expects the raw JWT
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileName } = await req.json();
    if (!filePath) {
      return new Response(JSON.stringify({ error: "filePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download file", details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawText = sanitizeText(extractPdfText(await fileData.arrayBuffer()));

    if (!rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "Could not extract text from the PDF. The file may be scanned or image-based." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Try Gemini first, fall back to OpenRouter
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    let parsed: ParsedResume;
    let providerUsed = "";

    if (geminiKey) {
      try {
        parsed = await extractWithGemini(rawText, geminiKey);
        providerUsed = "Gemini";
        console.log("[parse-resume] Used Gemini");
      } catch (err) {
        console.error("[parse-resume] Gemini failed", err instanceof Error ? err.message : String(err));
        if (openRouterKey) {
          parsed = await extractWithOpenRouter(rawText, openRouterKey);
          providerUsed = "OpenRouter";
          console.log("[parse-resume] Used OpenRouter (Gemini fallback)");
        } else {
          throw err; // No fallback available
        }
      }
    } else if (openRouterKey) {
      parsed = await extractWithOpenRouter(rawText, openRouterKey);
      providerUsed = "OpenRouter";
      console.log("[parse-resume] Used OpenRouter");
    } else {
      throw new Error("No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.");
    }

    const { data: resumeRecord, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        file_path: sanitizeText(filePath),
        file_name: sanitizeText(fileName || filePath.split("/").pop() || "resume.pdf"),
        raw_text: rawText.slice(0, 10000),
        parsed_name: sanitizeText(parsed.name),
        parsed_years_experience: sanitizeText(parsed.years_experience),
        parsed_skills: sanitizeArray(parsed.skills),
        parsed_companies: sanitizeArray(parsed.companies),
        parsed_projects: sanitizeArray(parsed.projects),
        parsed_education: sanitizeArray(parsed.education),
        parsed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("parse-resume insert failed:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to save parsed resume", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ resume: resumeRecord }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* ── PDF text extraction ──────────────────────────────── */

function extractPdfText(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(buffer);
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  const textChunks: string[] = [];
  let streamMatch;
  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    const streamData = streamMatch[1].trim();
    const textRegex = /\(([^)]*)\)/g;
    let textMatch;
    while ((textMatch = textRegex.exec(streamData)) !== null) {
      let extracted = textMatch[1];
      extracted = extracted
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\([0-7]{1,3})/g, (_m: string, octal: string) =>
          String.fromCharCode(parseInt(octal, 8))
        )
        .replace(/\\(.)/g, "$1");
      if (extracted.trim()) {
        textChunks.push(extracted);
      }
    }
  }
  return textChunks.join(" ");
}

/* ── AI Provider callers ──────────────────────────────── */

async function extractWithGemini(text: string, apiKey: string): Promise<ParsedResume> {
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMessage }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generation_config: { maxOutputTokens: 1000, temperature: 0.1 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Gemini API error: " + res.status + " - " + err);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  return parseResumeJson(content);
}

async function extractWithOpenRouter(text: string, apiKey: string): Promise<ParsedResume> {
  const model = Deno.env.get("OPENROUTER_MODEL") || "openrouter/free";

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

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error("OpenRouter API error: " + response.status + " - " + errBody);
  }

  const data: { choices: { message: { content: string } }[] } = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  return parseResumeJson(content);
}

function parseResumeJson(rawContent: string): ParsedResume {
  const jsonStr = rawContent
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI returned invalid JSON: " + jsonStr.slice(0, 200));
    }
    parsed = JSON.parse(match[0]);
  }

  return {
    name: String(parsed.name || ""),
    years_experience: String(parsed.years_experience || ""),
    skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
    companies: Array.isArray(parsed.companies) ? parsed.companies.map(String) : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects.map(String) : [],
    education: Array.isArray(parsed.education) ? parsed.education.map(String) : [],
  };
}