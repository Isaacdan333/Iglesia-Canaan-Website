# Bible Passage Lookup Setup

This guide explains how to get your free API.Bible key and run the Bible passage lookup locally or on Supabase.

---

## 1. Get a Free API.Bible Key

1. Go to [https://scripture.api.bible/signup](https://scripture.api.bible/signup) and create a free account.
2. Sign in, go to your dashboard / **Applications**, and click **Create New Application**.
3. Copy your **API Key** (e.g. `abc123xyz...`).

---

## 2. Option A: Local Setup (Quick & Easy)

The project includes a built-in Python backend server ([server.py](server.py)) using only the Python standard library (no extra package installations needed).

### Step 1: Create your `.env` file
Create a file named `.env` in the root folder of your project (same folder as `index.html`), or copy [.env.example](.env.example) to `.env`:

```text
BIBLE_API_KEY=your_actual_api_key_here
BIBLE_ID=de4e12af7f28f599-02
PORT=3000
```

> **Note:** `de4e12af7f28f599-02` is the King James Version (KJV). Other free public IDs include `06125ad019124483-01` (ASV) and `592420522e16049f-01` (Reina Valera 1909 Spanish).

### Step 2: Start the server
Open your terminal in VS Code and run:

```bash
python server.py
```

You will see:
```text
Server started at http://localhost:3000
Bible API Endpoint: http://localhost:3000/api/bible/passage?reference=John 3:16
```

### Step 3: Test the Bible page
1. Open your browser and navigate to:
   `http://localhost:3000/pages/bible.html`
2. Enter **John 3:16** (or click the **John 3:16** chip) and click **Look Up**.

---

## 3. Option B: Deploy with Supabase Edge Functions (For GitHub Pages Production)

If your website is hosted statically on GitHub Pages and you want to use Supabase as the serverless backend:

### Step 1: Set the API Key Secret in Supabase
Run the following in the Supabase CLI, or configure it under **Project Settings > Edge Functions > Secrets**:

```bash
supabase secrets set BIBLE_API_KEY=your_actual_api_key_here
```

### Step 2: Deploy the Edge Function
Deploy the function located at [supabase/functions/bible-passage/index.ts](supabase/functions/bible-passage/index.ts):

```bash
supabase functions deploy bible-passage --no-verify-jwt
```

### Step 3: Enable the Edge Function in your Frontend Config
Open [js/supabase-config.js](js/supabase-config.js) and add:

```js
window.USE_SUPABASE_EDGE_FUNCTION = true;
```

When this flag is enabled, [js/bible.js](js/bible.js) routes requests to your Supabase Edge Function instead of the local server.
