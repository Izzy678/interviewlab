/**
 * Shared Gemini caller for InterviewLab edge functions.
 * Prefer Gemini for all AI work — OpenRouter is rate-limited on free tier.
 */

const DEFAULT_MODEL = "gemini-2.5-flash";

export function geminiModel(): string {
  return Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;
}

export function requireGeminiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY secret is missing. Set it in Supabase project secrets.",
    );
  }
  return key;
}

/** Join all text parts from a Gemini candidate (handles multi-part replies). */
export function extractGeminiText(data: unknown): string {
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };

  if (root?.error?.message) {
    throw new Error(`Gemini API error: ${root.error.message}`);
  }

  const candidate = root?.candidates?.[0];
  if (!candidate) {
    throw new Error(
      "Gemini returned no candidates (empty response). Check API key, model name, and quota.",
    );
  }

  const parts = candidate.content?.parts || [];
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();

  const finishReason = candidate.finishReason || "unknown";

  if (!text) {
    throw new Error(
      `Gemini returned empty text (finishReason=${finishReason}). Try increasing maxOutputTokens or setting thinkingBudget to 0.`,
    );
  }

  if (finishReason === "MAX_TOKENS") {
    // Still return text — caller may attempt repair — but log loudly.
    console.warn(
      "[gemini] Response truncated (finishReason=MAX_TOKENS). Output may be incomplete JSON.",
    );
  }

  return text;
}

export async function callGeminiText(options: {
  system: string;
  user: string;
  apiKey?: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** Set 0 to disable Gemini 2.5 thinking (recommended for JSON). */
  thinkingBudget?: number;
  /** When true, ask Gemini to emit application/json. */
  jsonMode?: boolean;
}): Promise<string> {
  const apiKey = options.apiKey || requireGeminiKey();
  const model = geminiModel();
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const temperature = options.temperature ?? 0.2;
  // Default: disable thinking so output tokens aren't eaten on 2.5 models.
  const thinkingBudget = options.thinkingBudget ?? 0;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
    temperature,
    thinkingConfig: { thinkingBudget },
  };

  if (options.jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: options.system }] },
        contents: [{ role: "user", parts: [{ text: options.user }] }],
        generationConfig,
      }),
    },
  );

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(
      `Gemini API error: ${res.status} - ${rawBody.slice(0, 400)}`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Gemini returned non-JSON body: ${rawBody.slice(0, 200)}`,
    );
  }

  return extractGeminiText(data);
}

/** Strip markdown fences and extract the first JSON object. */
export function extractJsonObject(raw: string): string {
  let s = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  const match = s.match(/\{[\s\S]*\}/);
  if (match) s = match[0];
  return s;
}

/** True if a string looks like truncated / unparseable JSON. */
export function isValidJson(raw: string): boolean {
  try {
    JSON.parse(extractJsonObject(raw));
    return true;
  } catch {
    return false;
  }
}
