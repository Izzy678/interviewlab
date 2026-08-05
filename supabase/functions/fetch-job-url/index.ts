import { createClient } from "jsr:@supabase/supabase-js@2";

interface ParsedJobDescription {
  role: string;
  seniority: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
}

interface ScrapeResult {
  jobDescription: string;
  companyName: string;
  companyOverview: string;
  techStack: string[];
  parsed: ParsedJobDescription;
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchViaBrightData(targetUrl: string): Promise<string> {
  const apiKey = Deno.env.get("BRIGHTDATA_API_KEY");
  if (!apiKey) throw new Error("BRIGHTDATA_API_KEY is not configured");

  const zone = Deno.env.get("BRIGHTDATA_ZONE") || "web_unlocker1";
  // Job boards (Indeed, LinkedIn, etc.) render content via JS — enable browser rendering by default.
  const render = (Deno.env.get("BRIGHTDATA_RENDER") || "true").toLowerCase() === "true";

  const payload: Record<string, string> = {
    zone,
    url: targetUrl,
    format: "raw",
    method: "GET",
  };
  if (render) payload.render = "true";

  console.log("[fetch-job-url] Bright Data request", { zone, render, url: targetUrl });

  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[fetch-job-url] Bright Data API error", {
      status: response.status,
      body: errBody.slice(0, 1000),
    });
    throw new Error(
      `Bright Data Web Unlocker API error: ${response.status} - ${errBody.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw);
      // Surface API-level errors returned inside a 200 JSON payload.
      if (parsed && typeof parsed === "object" && parsed.error) {
        throw new Error(
          `Bright Data Web Unlocker API error: ${parsed.error}${parsed.message ? " - " + parsed.message : ""}`,
        );
      }
      const unwrapped =
        typeof parsed === "string"
          ? parsed
          : parsed.html ?? parsed.content ?? parsed.result ?? parsed.data ?? "";
      if (typeof unwrapped === "string" && unwrapped.length > 0) return unwrapped;
    } catch {
      // not JSON — treat as raw
    }
  }

  return raw;
}

async function extractWithOpenRouter(text: string): Promise<ScrapeResult> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const model = Deno.env.get("OPENROUTER_MODEL") || "openrouter/free";

  const systemMessage =
    "You are a job page extraction assistant. Extract structured data from job posting HTML converted to text. Always respond with valid JSON only, no markdown formatting.";

  const userMessage = [
    "Extract structured information from the following job posting text.",
    "",
    "Return ONLY valid JSON with these exact fields:",
    "{",
    '  "companyName": "Company name (the hiring company)",',
    '  "companyOverview": "Brief 2-3 sentence description of what the company does (from the page)",',
    '  "techStack": ["List of programming languages, frameworks, tools, and technologies mentioned"],',
    '  "jobDescription": "Full cleaned-up job description text, preserving all details about the role, requirements, benefits, etc.",',
    '  "role": "Job title / role name",',
    '  "seniority": "Seniority level (e.g. Entry Level, Mid Level, Senior, Staff, Principal, Lead, Manager, Intern)",',
    '  "required_skills": ["List of required / must-have skills, technologies, and qualifications"],',
    '  "nice_to_have_skills": ["List of nice-to-have / preferred skills and qualifications"],',
    '  "responsibilities": ["List of key job responsibilities and day-to-day tasks"]',
    "}",
    "",
    "Rules:",
    "- companyName: Extract the name of the company hiring. If not found, use an empty string.",
    "- companyOverview: Extract from 'About us' sections, company descriptions on the page. If not found, use an empty string.",
    "- techStack: List every technology, framework, language, or tool explicitly mentioned. If none, use an empty array.",
    "- jobDescription: The FULL job description text, cleaned up. Include responsibilities, requirements, benefits, about the company section, etc.",
    "- For role, seniority, required_skills, nice_to_have_skills, responsibilities: extract from the job description parts.",
    "",
    "Do not invent data. Use empty string or empty array for missing fields.",
    "",
    "JOB POSTING TEXT:",
    text,
  ].join("\n");

  console.log("[fetch-job-url] OpenRouter request", {
    model,
    textLength: text.length,
    textPreview: text.slice(0, 200),
  });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[fetch-job-url] OpenRouter error", {
      status: response.status,
      body: errBody.slice(0, 1000),
    });
    throw new Error(
      "OpenRouter API error: " + response.status + " - " + errBody.slice(0, 500),
    );
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  const jsonStr = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[fetch-job-url] could not parse JSON", jsonStr.slice(0, 300));
      throw new Error("OpenRouter returned invalid JSON: " + jsonStr.slice(0, 200));
    }
    parsed = JSON.parse(match[0]);
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
    jobDescription: sanitizeText(asString(parsed.jobDescription || "")),
    companyName: sanitizeText(asString(parsed.companyName || "")),
    companyOverview: sanitizeText(asString(parsed.companyOverview || "")),
    techStack: asArray(parsed.techStack || []),
    parsed: {
      role: sanitizeText(asString(parsed.role || parsed.title || parsed.job_title || "")),
      seniority: sanitizeText(asString(parsed.seniority || parsed.level || parsed.seniority_level || "")),
      required_skills: asArray(parsed.required_skills || parsed.requirements || parsed.must_have || []),
      nice_to_have_skills: asArray(parsed.nice_to_have_skills || parsed.preferred_skills || []),
      responsibilities: asArray(parsed.responsibilities || parsed.duties || []),
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: { url?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body", details: "Expected JSON with url" }, 400);
    }

    const { url } = body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return jsonResponse({ error: "url is required" }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return jsonResponse({ error: "Invalid URL", details: "The provided URL is not valid." }, 400);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonResponse({ error: "Invalid URL protocol", details: "Only http and https are supported." }, 400);
    }

    console.log("[fetch-job-url] start", { userId: user.id, url: parsedUrl.toString() });

    if (!Deno.env.get("BRIGHTDATA_API_KEY")) {
      return jsonResponse(
        {
          error: "Bright Data not configured",
          details: "BRIGHTDATA_API_KEY secret is missing. Add your Bright Data API key as the BRIGHTDATA_API_KEY secret.",
        },
        503,
      );
    }

    let html: string;
    try {
      html = await fetchViaBrightData(parsedUrl.toString());
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Unknown fetch error";
      console.error("[fetch-job-url] Bright Data fetch failed", msg);
      return jsonResponse(
        { error: "Failed to fetch job URL", details: msg, hint: "Check that the URL is accessible and the Bright Data API key is correct." },
        502,
      );
    }

    console.log("[fetch-job-url] fetched HTML length", html.length);

    const text = htmlToText(html).slice(0, 12000);
    if (!text || text.length < 50) {
      return jsonResponse(
        {
          error: "Page content too short",
          details: "The fetched page contains very little text. The URL may not be a job posting page, or the page requires JavaScript rendering.",
          textPreview: text.slice(0, 500),
        },
        422,
      );
    }

    console.log("[fetch-job-url] extracted text length", text.length);

    let extracted: ScrapeResult;
    try {
      extracted = await extractWithOpenRouter(text.slice(0, 8000));
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : "Unknown AI error";
      console.error("[fetch-job-url] OpenRouter extraction failed", msg);
      return jsonResponse({ error: "Failed to extract job details", details: msg }, 502);
    }

    const hasContent =
      extracted.jobDescription.length > 0 ||
      extracted.companyName.length > 0 ||
      extracted.techStack.length > 0 ||
      extracted.parsed.role.length > 0;

    if (!hasContent) {
      return jsonResponse(
        { error: "Could not extract job details", details: "The AI was unable to find any job-related content on the page.", textPreview: text.slice(0, 800) },
        422,
      );
    }

    return jsonResponse(extracted);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fetch-job-url] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});