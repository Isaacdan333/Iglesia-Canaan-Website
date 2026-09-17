#!/usr/bin/env python3
"""
Backend proxy server for Iglesia Canaan Bible Passage Lookup.
Protects the API.Bible API key and serves the website locally.
Zero external dependencies required (uses Python standard library).
"""

import http.server
import json
import os
import re
import socketserver
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Load .env file if present
def load_env():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"\"", "'"}:
                        value = value[1:-1]
                    os.environ.setdefault(key.strip(), value)

load_env()

API_KEY = os.environ.get("BIBLE_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pbrphqhuudubcfujlwuk.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
# Default Bible: King James Version (KJV)
BIBLE_ID = os.environ.get("BIBLE_ID", "de4e12af7f28f599-02")
BIBLE_VERSION_NAME = os.environ.get("BIBLE_VERSION_NAME", "King James Version (KJV)")
PORT = int(os.environ.get("PORT", "3000"))

# Mapping of book names to API.Bible USFM 3-letter codes
BOOK_MAP = {
    "genesis": "GEN", "gen": "GEN", "ge": "GEN",
    "exodus": "EXO", "exo": "EXO", "ex": "EXO",
    "leviticus": "LEV", "lev": "LEV", "le": "LEV",
    "numbers": "NUM", "num": "NUM", "nu": "NUM",
    "deuteronomy": "DEU", "deut": "DEU", "dt": "DEU",
    "joshua": "JOS", "josh": "JOS",
    "judges": "JDG", "judg": "JDG",
    "ruth": "RUT", "rut": "RUT",
    "1 samuel": "1SA", "1samuel": "1SA", "1 sam": "1SA", "1sam": "1SA",
    "2 samuel": "2SA", "2samuel": "2SA", "2 sam": "2SA", "2sam": "2SA",
    "1 kings": "1KI", "1kings": "1KI", "1 kgs": "1KI",
    "2 kings": "2KI", "2kings": "2KI", "2 kgs": "2KI",
    "1 chronicles": "1CH", "1chronicles": "1CH", "1 chr": "1CH",
    "2 chronicles": "2CH", "2chronicles": "2CH", "2 chr": "2CH",
    "ezra": "EZR", "ezr": "EZR",
    "nehemiah": "NEH", "neh": "NEH",
    "esther": "EST", "est": "EST",
    "job": "JOB",
    "psalms": "PSA", "psalm": "PSA", "psa": "PSA", "ps": "PSA",
    "proverbs": "PRO", "prov": "PRO", "prv": "PRO",
    "ecclesiastes": "ECC", "eccl": "ECC", "ecc": "ECC",
    "song of solomon": "SNG", "song of songs": "SNG", "canticles": "SNG",
    "isaiah": "ISA", "isa": "ISA",
    "jeremiah": "JER", "jer": "JER",
    "lamentations": "LAM", "lam": "LAM",
    "ezekiel": "EZK", "ezek": "EZK",
    "daniel": "DAN", "dan": "DAN",
    "hosea": "HOS", "hos": "HOS",
    "joel": "JOL", "jol": "JOL",
    "amos": "AMO", "amo": "AMO",
    "obadiah": "OBA", "oba": "OBA",
    "jonah": "JON", "jon": "JON",
    "micah": "MIC", "mic": "MIC",
    "nahum": "NAM", "nah": "NAM",
    "habakkuk": "HAB", "hab": "HAB",
    "zephaniah": "ZEP", "zeph": "ZEP",
    "haggai": "HAG", "hag": "HAG",
    "zechariah": "ZEC", "zech": "ZEC",
    "malachi": "MAL", "mal": "MAL",
    "matthew": "MAT", "matt": "MAT", "mt": "MAT",
    "mark": "MRK", "mrk": "MRK", "mk": "MRK",
    "luke": "LUK", "luk": "LUK", "lk": "LUK",
    "john": "JHN", "jhn": "JHN", "jn": "JHN",
    "acts": "ACT", "act": "ACT",
    "romans": "ROM", "rom": "ROM", "ro": "ROM",
    "1 corinthians": "1CO", "1corinthians": "1CO", "1 cor": "1CO", "1cor": "1CO",
    "2 corinthians": "2CO", "2corinthians": "2CO", "2 cor": "2CO", "2cor": "2CO",
    "galatians": "GAL", "gal": "GAL",
    "ephesians": "EPH", "eph": "EPH",
    "philippians": "PHP", "phil": "PHP", "php": "PHP",
    "colossians": "COL", "col": "COL",
    "1 thessalonians": "1TH", "1thessalonians": "1TH", "1 thess": "1TH",
    "2 thessalonians": "2TH", "2thessalonians": "2TH", "2 thess": "2TH",
    "1 timothy": "1TI", "1timothy": "1TI", "1 tim": "1TI",
    "2 timothy": "2TI", "2timothy": "2TI", "2 tim": "2TI",
    "titus": "TIT", "tit": "TIT",
    "philemon": "PHM", "phm": "PHM",
    "hebrews": "HEB", "heb": "HEB",
    "james": "JAS", "jas": "JAS",
    "1 peter": "1PE", "1peter": "1PE", "1 pet": "1PE",
    "2 peter": "2PE", "2peter": "2PE", "2 pet": "2PE",
    "1 john": "1JN", "1john": "1JN", "1 jn": "1JN",
    "2 john": "2JN", "2john": "2JN", "2 jn": "2JN",
    "3 john": "3JN", "3john": "3JN", "3 jn": "3JN",
    "jude": "JUD", "jud": "JUD",
    "revelation": "REV", "rev": "REV", "revelations": "REV",
    # Spanish book names support
    "juan": "JHN", "san juan": "JHN",
    "genesis": "GEN", "salmos": "PSA", "salmo": "PSA",
    "romanos": "ROM", "1 corintios": "1CO", "2 corintios": "2CO"
}

STANDARD_BOOK_NAMES = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers", "DEU": "Deuteronomy",
    "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel",
    "1KI": "1 Kings", "2KI": "2 Kings", "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra",
    "NEH": "Nehemiah", "EST": "Esther", "JOB": "Job", "PSA": "Psalms", "PRO": "Proverbs",
    "ECC": "Ecclesiastes", "SNG": "Song of Solomon", "ISA": "Isaiah", "JER": "Jeremiah",
    "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel", "HOS": "Hosea", "JOL": "Joel",
    "AMO": "Amos", "OBA": "Obadiah", "JON": "Jonah", "MIC": "Micah", "NAM": "Nahum",
    "HAB": "Habakkuk", "ZEP": "Zephaniah", "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi",
    "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John", "ACT": "Acts",
    "ROM": "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians", "GAL": "Galatians",
    "EPH": "Ephesians", "PHP": "Philippians", "COL": "Colossians", "1TH": "1 Thessalonians",
    "2TH": "2 Thessalonians", "1TI": "1 Timothy", "2TI": "2 Timothy", "TIT": "Titus",
    "PHM": "Philemon", "HEB": "Hebrews", "JAS": "James", "1PE": "1 Peter", "2PE": "2 Peter",
    "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", "JUD": "Jude", "REV": "Revelation"
}

def parse_bible_reference(ref_str):
    """
    Parses a reference string like 'John 3:16', 'John 3:16-18', 'Psalm 23', etc.
    Returns a dict with book_code, book_name, chapter, verse_range, passage_id.
    """
    trimmed = ref_str.strip()
    if not trimmed:
        return None, "Reference cannot be empty."

    # Pattern matches:
    # 1. Optional book prefix number: (1|2|3|I|II|III)?
    # 2. Book name letters
    # 3. Chapter number
    # 4. Optional :verse or :verse-verse or -verse
    pattern = r"^\s*(\d\s*)?([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?|\s*-\s*(\d+))?\s*$"
    match = re.match(pattern, trimmed, re.IGNORECASE)

    if not match:
        return None, f"Invalid reference format '{trimmed}'. Example: John 3:16"

    prefix = match.group(1) or ""
    book_part = match.group(2).strip()
    full_book_input = f"{prefix.strip()} {book_part}".strip().lower()
    chapter = int(match.group(3))
    start_verse = match.group(4)
    end_verse = match.group(5) or match.group(6)

    book_code = BOOK_MAP.get(full_book_input)
    if not book_code:
        return None, f"Unrecognized Bible book '{full_book_input}'. Please check spelling."

    book_name = STANDARD_BOOK_NAMES.get(book_code, book_part.title())

    if start_verse and end_verse:
        verse_display = f"{start_verse}-{end_verse}"
        passage_id = f"{book_code}.{chapter}.{start_verse}-{book_code}.{chapter}.{end_verse}"
    elif start_verse:
        verse_display = str(start_verse)
        # API.Bible /passages/ endpoint requires a range format even for a single verse (e.g. JHN.3.16-JHN.3.16)
        passage_id = f"{book_code}.{chapter}.{start_verse}-{book_code}.{chapter}.{start_verse}"
    else:
        verse_display = None
        passage_id = f"{book_code}.{chapter}"

    return {
        "book_code": book_code,
        "book_name": book_name,
        "chapter": chapter,
        "verse": verse_display,
        "passage_id": passage_id,
        "formatted_reference": f"{book_name} {chapter}:{verse_display}" if verse_display else f"{book_name} {chapter}"
    }, None

def clean_html_scripture(html_content):
    """
    Cleans Scripture HTML by extracting plain text while keeping proper verse spacing.
    """
    # Replace verse tags with readable markers/spaces
    cleaned = re.sub(r'<span[^>]*class="[^"]*v[^"]*"[^>]*>([\d\-]+)</span>', r' [\1] ', html_content)
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', ' ', cleaned)
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def fetch_passage_from_api(passage_id, bible_id=BIBLE_ID, api_key=API_KEY):
    """
    Queries API.Bible for the passage text.
    """
    if not api_key:
        raise ValueError("BIBLE_API_KEY is not configured on the server. Please set it in your .env file.")

    url = (
        f"https://api.scripture.api.bible/v1/bibles/{bible_id}/passages/{urllib.parse.quote(passage_id)}"
        "?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true"
    )

    req = urllib.request.Request(
        url,
        headers={
            "api-key": api_key,
            "Accept": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("data", {})
    except urllib.error.HTTPError as err:
        status_code = err.code
        raw_error = err.read().decode("utf-8")
        print(f"[API.Bible Error {status_code}] URL: {url}")
        print(f"[API.Bible Error Body]: {raw_error}")
        
        error_msg = ""
        try:
            err_json = json.loads(raw_error)
            error_msg = err_json.get("message") or err_json.get("error") or raw_error
        except Exception:
            error_msg = raw_error

        if status_code in (401, 403):
            raise PermissionError(f"API.Bible authorization failed ({error_msg}). Please check your API key.")
        elif status_code == 404:
            raise FileNotFoundError(f"Passage '{passage_id}' not found in Bible '{bible_id}'.")
        elif status_code == 429:
            raise RuntimeError("API.Bible rate limit reached. Please wait a moment and try again.")
        else:
            raise RuntimeError(f"API.Bible returned status {status_code}: {error_msg}")
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not connect to API.Bible: {err.reason}")

def embed_search_query(query):
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured on the server. Please set it in your .env file.")

    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps({"input": query, "model": "text-embedding-3-small"}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        error_text = err.read().decode("utf-8")
        raise RuntimeError(f"OpenAI embeddings request failed ({err.code}): {error_text}")
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not connect to OpenAI: {err.reason}")

    embedding = data.get("data", [{}])[0].get("embedding")
    if not isinstance(embedding, list) or len(embedding) != 1536:
        raise RuntimeError("OpenAI returned an invalid embedding.")
    return embedding

def search_bible_verses(query):
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured on the server. Please set it in your .env file.")
    if not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_ANON_KEY is not configured on the server. Please set it in your .env file.")

    request = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/match_bible_verses",
        data=json.dumps({
            "query_embedding": embed_search_query(query),
            "match_count": 6
        }).encode("utf-8"),
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        error_text = err.read().decode("utf-8")
        raise RuntimeError(f"Bible search failed ({err.code}): {error_text}")
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not connect to Supabase: {err.reason}")

class ChurchSiteHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local testing
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/bible/passage":
            self.handle_passage_lookup(parsed.query)
        elif parsed.path == "/api/bible/semantic-search":
            self.handle_semantic_search(parsed.query)
        else:
            # Fall back to static file serving
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/bible/passage":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                ref = data.get("reference", "")
            except Exception:
                ref = ""
            self.process_reference(ref)
        elif parsed.path == "/api/bible/semantic-search":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                query = data.get("query", "")
            except Exception:
                query = ""
            self.process_semantic_search(query)
        else:
            self.send_error(404, "Endpoint not found")

    def handle_passage_lookup(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        reference = params.get("reference", [""])[0]
        self.process_reference(reference)

    def handle_semantic_search(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        query = params.get("query", [""])[0]
        self.process_semantic_search(query)

    def process_reference(self, reference):
        if not reference:
            self.send_json_response(400, {"error": "Missing 'reference' parameter. Example: John 3:16"})
            return

        parsed_ref, error = parse_bible_reference(reference)
        if error:
            self.send_json_response(400, {"error": error})
            return

        try:
            api_data = fetch_passage_from_api(parsed_ref["passage_id"])
            html_content = api_data.get("content", "")
            plain_text = clean_html_scripture(html_content)

            result = {
                "book": parsed_ref["book_name"],
                "book_code": parsed_ref["book_code"],
                "chapter": parsed_ref["chapter"],
                "verse": parsed_ref["verse"],
                "reference": parsed_ref["formatted_reference"],
                "text": plain_text,
                "html": html_content,
                "version": BIBLE_VERSION_NAME,
                "copyright": api_data.get("copyright", "")
            }
            self.send_json_response(200, result)
        except PermissionError as e:
            self.send_json_response(401, {"error": str(e)})
        except FileNotFoundError as e:
            self.send_json_response(404, {"error": str(e)})
        except RuntimeError as e:
            self.send_json_response(502, {"error": str(e)})
        except ValueError as e:
            self.send_json_response(500, {"error": str(e)})
        except Exception as e:
            self.send_json_response(500, {"error": f"Unexpected server error: {str(e)}"})

    def process_semantic_search(self, query):
        query = query.strip() if isinstance(query, str) else ""
        if not query:
            self.send_json_response(400, {"error": "Missing 'query'."})
            return
        if len(query) > 1000:
            self.send_json_response(400, {"error": "Query must be 1000 characters or fewer."})
            return

        try:
            results = search_bible_verses(query)
            self.send_json_response(200, results)
        except ValueError as e:
            self.send_json_response(500, {"error": str(e)})
        except RuntimeError as e:
            self.send_json_response(502, {"error": str(e)})
        except Exception as e:
            self.send_json_response(500, {"error": f"Unexpected server error: {str(e)}"})

    def send_json_response(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run():
    os.chdir(Path(__file__).parent)
    with socketserver.TCPServer(("", PORT), ChurchSiteHandler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print(f"Bible API Endpoint: http://localhost:{PORT}/api/bible/passage?reference=John 3:16")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run()
