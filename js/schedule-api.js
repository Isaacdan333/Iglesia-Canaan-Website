const scheduleDays = new Set([0, 2, 4]);

function getSupabaseClient() {
  if (!window.supabase || !window.SUPABASE_URL || window.SUPABASE_URL.startsWith("YOUR_")) {
    throw new Error("Supabase is not configured yet. Add the project URL and publishable key in supabase-config.js.");
  }
  if (!window.scheduleSupabase) {
    window.scheduleSupabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
  return window.scheduleSupabase;
}

function validateScheduleEntry(entry) {
  if (!entry.service_date) return "Choose a date.";
  const weekday = new Date(`${entry.service_date}T12:00:00`).getDay();
  if (!scheduleDays.has(weekday)) return "Schedule entries must be on Sunday, Tuesday, or Thursday.";
  if (!entry.title) return "Enter a service title.";
  if (!entry.start_time || !entry.end_time) return "Enter a start and end time.";
  if (entry.end_time <= entry.start_time) return "The end time must be after the start time.";
  return "";
}

async function fetchPublishedSchedule() {
  const { data, error } = await getSupabaseClient().from("schedule_entries").select("*").eq("published", true).order("service_date").order("start_time");
  if (error) throw error;
  return data;
}

async function fetchStaffSchedule() {
  const { data, error } = await getSupabaseClient().from("schedule_entries").select("*").order("service_date").order("start_time");
  if (error) throw error;
  return data;
}

async function saveScheduleEntry(entry) {
  const validationError = validateScheduleEntry(entry);
  if (validationError) throw new Error(validationError);
  const client = getSupabaseClient();
  const payload = {
    title: entry.title,
    service_date: entry.service_date,
    start_time: entry.start_time,
    end_time: entry.end_time,
    location: entry.location || null,
    highlight: entry.highlight || null,
    notes: entry.notes || null,
    moderator: entry.moderator || null,
    worship_leader: entry.worship_leader || null,
    tiempos: entry.tiempos || null,
    preacher: entry.preacher || null,
    published: Boolean(entry.published)
  };
  const query = entry.id
    ? client.from("schedule_entries").update(payload).eq("id", entry.id).select().single()
    : client.from("schedule_entries").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function deleteScheduleEntry(id) {
  const { error } = await getSupabaseClient().from("schedule_entries").delete().eq("id", id);
  if (error) throw error;
}

async function signInStaff(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function signOutStaff() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}