revoke execute
on function public.match_bible_verses(vector, integer, double precision)
from public;

grant execute
on function public.match_bible_verses(vector, integer, double precision)
to anon, authenticated, service_role;

revoke all
on table public.bible_verses
from public, anon, authenticated;
