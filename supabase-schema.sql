create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  service_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  highlight text,
  notes text,
  moderator text,
  worship_leader text,
  tiempos text,
  preacher text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_allowed_days check (extract(dow from service_date) in (0, 2, 4)),
  constraint schedule_time_order check (end_time > start_time)
);

alter table public.schedule_entries enable row level security;

create policy "Anyone can view published schedule entries"
  on public.schedule_entries for select
  using (published = true or auth.role() = 'authenticated');

create policy "Staff can create schedule entries"
  on public.schedule_entries for insert to authenticated
  with check (true);

create policy "Staff can update schedule entries"
  on public.schedule_entries for update to authenticated
  using (true) with check (true);

create policy "Staff can delete schedule entries"
  on public.schedule_entries for delete to authenticated
  using (true);

create or replace function public.set_schedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger schedule_entries_updated_at
before update on public.schedule_entries
for each row execute function public.set_schedule_updated_at();
