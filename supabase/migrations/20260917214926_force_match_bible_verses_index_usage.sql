-- match_bible_verses is SECURITY DEFINER, which PostgreSQL never inlines, so the
-- planner does not favor the HNSW index for its internal query and falls back to a
-- sequential scan over bible_verses. That exceeds the anon (3s) / authenticated (8s)
-- statement_timeout, surfacing as RPC/Edge Function timeouts. Forcing enable_seqscan
-- off for just this function's execution context restores HNSW index usage.
alter function public.match_bible_verses(vector, integer, double precision)
  set enable_seqscan = off;
