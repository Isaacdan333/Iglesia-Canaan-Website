# Semantic Bible Search Setup

This document describes the deployed semantic Bible search feature, its configuration, and the checks needed before release. It covers the English King James Version (KJV) verse search only.

## Architecture

The topic-search request follows this path:

```text
Browser
  -> js/bible-semantic.js
  -> Supabase Edge Function: bible-semantic-search
  -> OpenAI embeddings API (text-embedding-3-small)
  -> Supabase match_bible_verses() RPC
  -> pgvector cosine search using the HNSW index
  -> ranked Bible verses
  -> browser results list
```

Exact-reference lookup remains a separate path. The Reference Lookup tab calls `bible-passage`, which requests a passage from API.Bible; it does not use `bible_verses`, embeddings, or the semantic-search RPC.

## Database

The migration `supabase/migrations/20260917043119_bible_verses_schema.sql` creates the `public.bible_verses` table and enables the `vector` extension. The table contains the public-domain KJV corpus: 31,102 verse rows, including `book`, `book_code`, `chapter`, `verse`, `reference`, `translation`, `text`, and an `embedding vector(1536)` column.

Embeddings use OpenAI's `text-embedding-3-small` model. The `bible_verses_embedding_hnsw_idx` index uses cosine distance. `match_bible_verses(query_embedding, match_count, match_threshold)` returns ranked verse metadata, text, translation, and similarity. It limits the requested result count to 1 through 100 and defaults to six results and a similarity threshold of 0.5.

Row Level Security is enabled on `public.bible_verses` with no public table policies. Public and authenticated clients cannot read or write the table directly. The RPC is `SECURITY DEFINER`, fixes its search path to `public`, and is the only table access exposed to `anon` and `authenticated` through an explicit execute grant. The migration `20260917175735_tighten_bible_search_acl.sql` removes broader access, and `20260917214926_force_match_bible_verses_index_usage.sql` sets `enable_seqscan=off` for the RPC so the HNSW index is used inside the security-definer function.

## Semantic Search API

The deployed function is `bible-semantic-search`. It accepts both forms below:

```http
POST /functions/v1/bible-semantic-search
Content-Type: application/json

{"query":"loving your enemies"}
```

```http
GET /functions/v1/bible-semantic-search?query=grace
```

The normal response is HTTP 200 with an array of up to six objects:

```json
[
  {
    "book": "Ephesians",
    "book_code": "EPH",
    "chapter": 2,
    "verse": 8,
    "reference": "Ephesians 2:8",
    "translation": "KJV",
    "text": "...",
    "similarity": 0.7
  }
]
```

The function trims the query and accepts at most 1,000 characters. An empty or missing query returns HTTP 400 with `{"error":"Missing 'query'."}`. A query over the limit returns HTTP 400. Malformed JSON returns HTTP 400. Unsupported methods return HTTP 405. OpenAI failures and RPC failures return HTTP 502; missing server configuration or unexpected failures return HTTP 500. A valid query with no verses over the similarity threshold returns HTTP 200 with `[]`.

The local parity endpoint is `/api/bible/semantic-search` on `server.py`. It accepts the same JSON POST body and also accepts a GET `?query=` request. The local server uses `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` from `.env`.

## Configuration and Secrets

Safe browser configuration is kept in `js/supabase-config.js`:

```js
window.SUPABASE_URL = "https://your-project.supabase.co";
window.SUPABASE_ANON_KEY = "your-publishable-or-anon-key";
window.USE_SUPABASE_EDGE_FUNCTION = true;
```

The project URL and publishable/anon key are designed for browser use. They do not grant direct access to the protected `bible_verses` table. Never put a Supabase service-role key in frontend JavaScript.

The Edge Function requires `OPENAI_API_KEY` as a Supabase Edge Function secret. Supabase supplies `SUPABASE_URL`; the function uses `SUPABASE_ANON_KEY` when available and falls back to `SUPABASE_SERVICE_ROLE_KEY`. The current RLS/RPC design does not require exposing a service-role key to the browser. Set secrets through the Supabase CLI or dashboard, never in source files:

```bash
supabase secrets set OPENAI_API_KEY=your_actual_openai_key_here
```

For local development, create an ignored `.env` beside `server.py`:

```text
BIBLE_API_KEY=your_api_bible_key_here
OPENAI_API_KEY=your_openai_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
BIBLE_ID=de4e12af7f28f599-02
PORT=3000
```

`BIBLE_API_KEY` is needed for local exact-reference lookup. `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are needed for local semantic search. `.env` is ignored by Git; do not commit it or print its values.

## Local Development

1. Create the local `.env` described above.
2. Start the standard-library backend from the repository root:

   ```bash
   python server.py
   ```

3. Open `http://localhost:3000/pages/bible.html`.
4. With `window.USE_SUPABASE_EDGE_FUNCTION` set to `false` in the browser configuration, use the Reference Lookup and Search by Topic tabs against the local endpoints.
5. Test the semantic endpoint directly:

   ```bash
   curl -X POST http://localhost:3000/api/bible/semantic-search ^
     -H "Content-Type: application/json" ^
     -d "{\"query\":\"grace\"}"
   ```

   An empty query should return HTTP 400. A configured valid query returns an array; a configured query with no matches returns `[]`.

## Supabase Deployment

Run these commands from the repository root with the Supabase CLI linked to the project:

```bash
supabase db push --linked --yes
supabase secrets set OPENAI_API_KEY=your_actual_openai_key_here
supabase functions deploy bible-semantic-search --no-verify-jwt
supabase functions deploy bible-passage --no-verify-jwt
```

The database push applies the tracked migrations, including the schema, ACL, and HNSW planner-setting migrations. The `bible-passage` deployment is retained because exact-reference lookup is an independent production path. Do not recreate existing tables, indexes, functions, or imported rows.

Read-only checks for deployment readiness:

```bash
supabase functions list
supabase db query --linked "select count(*) from public.bible_verses;"
```

Confirm that both functions are `ACTIVE`, the corpus count is 31,102, and the linked database contains the HNSW index and `match_bible_verses` function with its security-definer settings. Never include secret values in command output or documentation.

## Known Behavior and Release Checks

The semantic threshold is intentionally unchanged from the implementation. Some broad natural-language queries, including `passages about forgiveness`, can return no results even when the pipeline is healthy; this is a known relevance limitation, not a deployment failure.

Before release, verify:

- `John 3:16` still works in Reference Lookup.
- Topic searches for `grace`, `loving your enemies`, `trusting God during difficult times`, and `Jesus rising from the dead` return or clearly report results.
- Empty and overlong queries show the documented validation errors.
- The no-result and error states render without exposing embeddings or secrets.
- Both tabs, loading states, results, and the mobile layout remain usable.
- `python -m py_compile server.py` and `git diff --check` pass.
- `.env`, generated embeddings, temporary SQL imports, and local Python caches are not tracked.