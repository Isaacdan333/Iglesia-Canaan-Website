// Supabase Edge Function: bible-passage
// Deploy with: supabase functions deploy bible-passage --no-verify-jwt
// Set secret: supabase secrets set BIBLE_API_KEY=your_key_here

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOK_MAP: Record<string, string> = {
  "genesis": "GEN", "gen": "GEN",
  "exodus": "EXO", "exo": "EXO",
  "psalms": "PSA", "psalm": "PSA", "psa": "PSA",
  "john": "JHN", "jhn": "JHN", "jn": "JHN",
  "romans": "ROM", "rom": "ROM",
  "1 corinthians": "1CO", "1corinthians": "1CO",
  "juan": "JHN", "salmos": "PSA", "romanos": "ROM"
};

const STANDARD_BOOK_NAMES: Record<string, string> = {
  "GEN": "Genesis", "EXO": "Exodus", "PSA": "Psalms",
  "JHN": "John", "ROM": "Romans", "1CO": "1 Corinthians"
};

function parseBibleReference(refStr: string) {
  const pattern = /^\s*(\d\s*)?([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?|\s*-\s*(\d+))?\s*$/i;
  const match = refStr.trim().match(pattern);
  if (!match) return { error: `Invalid reference format '${refStr}'. Example: John 3:16` };

  const prefix = match[1] || "";
  const bookPart = match[2].trim();
  const fullBookInput = `${prefix.trim()} ${bookPart}`.trim().toLowerCase();
  const chapter = parseInt(match[3], 10);
  const startVerse = match[4];
  const endVerse = match[5] || match[6];

  const bookCode = BOOK_MAP[fullBookInput];
  if (!bookCode) return { error: `Unrecognized Bible book '${fullBookInput}'.` };

  const bookName = STANDARD_BOOK_NAMES[bookCode] || bookPart;
  let verseDisplay = null;
  let passageId = `${bookCode}.${chapter}`;

  if (startVerse && endVerse) {
    verseDisplay = `${startVerse}-${endVerse}`;
    passageId = `${bookCode}.${chapter}.${startVerse}-${bookCode}.${chapter}.${endVerse}`;
  } else if (startVerse) {
    verseDisplay = startVerse;
    // API.Bible /passages/ endpoint requires a range format for single verse
    passageId = `${bookCode}.${chapter}.${startVerse}-${bookCode}.${chapter}.${startVerse}`;
  }

  return {
    book: bookName,
    bookCode,
    chapter,
    verse: verseDisplay,
    passageId,
    formattedReference: verseDisplay ? `${bookName} ${chapter}:${verseDisplay}` : `${bookName} ${chapter}`
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing 'reference' query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const parsed = parseBibleReference(reference);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const apiKey = Deno.env.get("BIBLE_API_KEY");
    const bibleId = Deno.env.get("BIBLE_ID") || "de4e12af7f28f599-02"; // KJV default

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "BIBLE_API_KEY is not configured in Edge Function secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const apiRes = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${encodeURIComponent(parsed.passageId)}?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true`,
      {
        headers: {
          "api-key": apiKey,
          "Accept": "application/json"
        }
      }
    );

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return new Response(JSON.stringify({ error: `API.Bible returned status ${apiRes.status}: ${errText}` }), {
        status: apiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await apiRes.json();
    const content = data.data?.content || "";
    const cleanText = content.replace(/<span[^>]*class="[^"]*v[^"]*"[^>]*>([\d\-]+)<\/span>/g, " [$1] ")
                             .replace(/<[^>]+>/g, " ")
                             .replace(/\s+/g, " ")
                             .trim();

    const responsePayload = {
      book: parsed.book,
      chapter: parsed.chapter,
      verse: parsed.verse,
      reference: parsed.formattedReference,
      text: cleanText,
      html: content,
      version: "King James Version (KJV)",
      copyright: data.data?.copyright || ""
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
