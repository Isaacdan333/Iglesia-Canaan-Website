# Schedule dashboard setup

The schedule uses Supabase Auth and PostgreSQL so the static site can remain hosted on GitHub Pages.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor** and run [`supabase-schema.sql`](supabase-schema.sql).
3. Open **Authentication > Providers** and enable Email.
4. Invite each church staff member from **Authentication > Users > Add user**. Keep public sign-up disabled unless you intentionally want members to create accounts.

## 2. Configure the website

Open [`js/supabase-config.js`](js/supabase-config.js) and replace the two placeholders with the Supabase project URL and the browser-safe publishable/anon key from **Project Settings > API**:

```js
window.SUPABASE_URL = "https://your-project.supabase.co";
window.SUPABASE_ANON_KEY = "your-publishable-key";
```

The publishable/anon key is intended for browser use. Never put a Supabase service-role key in this file.

## 3. Add schedule entries

Open [`schedule-dashboard.html`](schedule-dashboard.html), sign in with an invited staff account, and add entries one date at a time. Dates are restricted to Sunday, Tuesday, and Thursday. Save as a draft when an entry is not ready for visitors, or publish it to show it on [`main-schedule.html`](main-schedule.html).

## 4. Deploy

Upload the website files, including the new JavaScript, HTML, and SQL files, to the GitHub Pages branch or repository. The Supabase project remains the database and authentication service; the static site only uses the publishable browser key.

## Security model

- Visitors can read published schedule entries without signing in.
- Signed-in staff can view and manage all entries.
- The database rejects dates outside Sunday, Tuesday, and Thursday and rejects an end time before the start time.
- Supabase Row Level Security protects all writes.
