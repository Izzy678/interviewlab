import { createClient } from "jsr:@supabase/supabase-js@2";

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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch the Speechmatics API key from secrets
    const apiKey = Deno.env.get("SPEECHMATICS_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "Speechmatics not configured", details: "SPEECHMATICS_API_KEY secret is missing." },
        503,
      );
    }

    // Exchange the permanent API key for a short-lived temporary JWT
    const smResponse = await fetch(
      "https://mp.speechmatics.com/v1/api_keys?type=rt",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
      },
    );

    if (!smResponse.ok) {
      const errBody = await smResponse.text();
      console.error("[speechmatics-token] Speechmatics error", {
        status: smResponse.status,
        body: errBody.slice(0, 500),
      });
      return jsonResponse(
        { error: "Failed to obtain Speechmatics token", details: `${smResponse.status} – ${errBody.slice(0, 300)}` },
        502,
      );
    }

    const smData = await smResponse.json();
    const jwt = smData.key_value;

    if (!jwt) {
      return jsonResponse(
        { error: "Speechmatics returned no token" },
        502,
      );
    }

    console.log("[speechmatics-token] Token issued for user", user.id);

    return jsonResponse({ token: jwt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[speechmatics-token] unhandled error", message);
    return jsonResponse({ error: message }, 500);
  }
});