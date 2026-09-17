-- Semantic Bible search: bible_verses table, pgvector index, and match_bible_verses RPC.
-- Independent of the existing exact-reference lookup (bible-passage Edge Function calls
-- API.Bible directly and does not touch this table).

create extension if not exists vector;

create table public.bible_verses (
  id bigserial primary key,
  translation text not null default 'KJV',
  book text not null,
  book_code text not null,
  chapter int not null check (chapter > 0),
  verse int not null check (verse > 0),
  reference text not null,
  text text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  -- Extensible for future translations: same (book_code, chapter, verse) can repeat per translation.
  constraint bible_verses_unique_verse unique (translation, book_code, chapter, verse)
);

create index bible_verses_translation_idx on public.bible_verses (translation);

create index bible_verses_embedding_hnsw_idx
  on public.bible_verses
  using hnsw (embedding vector_cosine_ops);

-- RLS enabled with no policies: blocks anon/authenticated access entirely.
-- Only the service role (imports) and SECURITY DEFINER functions below can read this table.
alter table public.bible_verses enable row level security;

create or replace function public.match_bible_verses(
  query_embedding vector(1536),
  match_count int default 6,
  match_threshold float default 0.5
)
returns table (
  book text,
  book_code text,
  chapter int,
  verse int,
  reference text,
  translation text,
  text text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bv.book,
    bv.book_code,
    bv.chapter,
    bv.verse,
    bv.reference,
    bv.translation,
    bv.text,
    1 - (bv.embedding <=> query_embedding) as similarity
  from public.bible_verses bv
  where 1 - (bv.embedding <=> query_embedding) >= match_threshold
  order by bv.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 100);
$$;

-- Only expose the RPC (not the raw table) to frontend-facing roles.
grant execute on function public.match_bible_verses(vector(1536), int, float) to anon, authenticated;
