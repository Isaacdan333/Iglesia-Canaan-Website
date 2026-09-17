// Supabase Edge Function: bible-semantic-search
// Deploy with: supabase functions deploy bible-semantic-search --no-verify-jwt
// Set secret: supabase secrets set OPENAI_API_KEY=your_key_here

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MATCH_COUNT = 6;
const MAX_QUERY_LENGTH = 1000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function readQuery(req: Request) {
  if (req.method === "GET") {
    return new URL(req.url).searchParams.get("query") || "";
  }

  const body = await req.json();
  return typeof body?.query === "string" ? body.query : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed. Use POST with a JSON query body." }, 405);
  }

  try {
    let query: string;
    try {
      query = (await readQuery(req)).trim();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON with a string 'query'." }, 400);
    }

    if (!query) {
      return jsonResponse({ error: "Missing 'query'." }, 400);
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return jsonResponse({ error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer.` }, 400);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!openAiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY is not configured in Edge Function secrets." }, 500);
    }
    if (!supabaseUrl || !supabaseKey) {
      return jsonResponse({ error: "Supabase connection settings are not configured." }, 500);
    }

    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: query, model: EMBEDDING_MODEL })
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      return jsonResponse({ error: `OpenAI embeddings request failed (${embeddingResponse.status}): ${errorText}` }, 502);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      return jsonResponse({ error: "OpenAI returned an invalid embedding." }, 502);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc("match_bible_verses", {
      query_embedding: embedding,
      match_count: DEFAULT_MATCH_COUNT
    });

    if (error) {
      return jsonResponse({ error: `Bible search failed: ${error.message}` }, 502);
    }

    return jsonResponse(data || []);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});