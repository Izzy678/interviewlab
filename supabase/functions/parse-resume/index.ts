import { createClient } from "jsr:@supabase/supabase-js@2";

interface ParsedResume {
  name: string;
  years_experience: string;
  skills: string[];
  companies: string[];
  projects: string[];
  education: string[];
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
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
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

    const rawText = extractPdfText(await fileData.arrayBuffer());

    if (!rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "Could not extract text from the PDF. The file may be scanned or image-based." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = await extractWithGemini(rawText);

    const { data: resumeRecord, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        file_path: filePath,
        file_name: fileName || filePath.split("/").pop() || "resume.pdf",
        raw_text: rawText.slice(0, 10000),
        parsed_name: parsed.name,
        parsed_years_experience: parsed.years_experience,
        parsed_skills: parsed.skills,
        parsed_companies: parsed.companies,
        parsed_projects: parsed.projects,
        parsed_education: parsed.education,
        parsed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
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

async function extractWithGemini(text: string): Promise<ParsedResume> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const systemInstruction = "You are a resume parsing assistant. Extract structured data from resumes. Always respond with valid JSON only.";

  const prompt = [
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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }],
        }],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error("Gemini API error: " + response.status + " - " + errBody);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  const jsonStr = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed: ParsedResume = JSON.parse(jsonStr);

  return {
    name: parsed.name || "",
    years_experience: parsed.years_experience || "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    companies: Array.isArray(parsed.companies) ? parsed.companies : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
  };
}