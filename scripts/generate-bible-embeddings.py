#!/usr/bin/env python3
"""Generate a CSV of KJV verse embeddings for the Phase 2 Supabase import.

This one-time utility reads data/kjv.json, requests OpenAI embeddings in batches,
and writes book, book_code, chapter, verse, text, and embedding CSV columns.
It never writes the API key to disk.
"""

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = PROJECT_ROOT / "data" / "kjv.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "generated" / "kjv_embeddings.csv"
EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
DEFAULT_RETRY_DELAY_SECONDS = 5

# Canonical USFM-style codes and display names used by server.py.
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
    "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", "JUD": "Jude", "REV": "Revelation",
}

BOOK_CODES_BY_NORMALIZED_NAME = {
    " ".join(name.lower().split()): code for code, name in STANDARD_BOOK_NAMES.items()
}
BOOK_CODES_BY_NORMALIZED_NAME.update({
    "psalm": "PSA",
    "song of songs": "SNG",
    "canticles": "SNG",
    "revelations": "REV",
})


def load_env_file(env_path: Path) -> None:
    """Load missing environment variables from the local, ignored .env file."""
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def normalize_verse(raw_verse: object, row_number: int) -> dict:
    if not isinstance(raw_verse, dict):
        raise ValueError(f"Verse row {row_number} must be an object.")

    raw_book = raw_verse.get("book")
    normalized_book = " ".join(str(raw_book or "").lower().split())
    book_code = BOOK_CODES_BY_NORMALIZED_NAME.get(normalized_book)
    if not book_code:
        raise ValueError(f"Verse row {row_number} has an unknown book: {raw_book!r}.")

    try:
        chapter = int(raw_verse["chapter"])
        verse = int(raw_verse["verse"])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"Verse row {row_number} has an invalid chapter or verse.") from error

    text = " ".join(str(raw_verse.get("text") or "").split())
    if chapter < 1 or verse < 1 or not text:
        raise ValueError(f"Verse row {row_number} must have positive chapter/verse and non-empty text.")

    return {
        "book": STANDARD_BOOK_NAMES[book_code],
        "book_code": book_code,
        "chapter": chapter,
        "verse": verse,
        "text": text,
    }


def load_verses(input_path: Path) -> list[dict]:
    try:
        payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as error:
        raise ValueError(f"Dataset not found: {input_path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Dataset is not valid JSON: {error}") from error

    rows = payload.get("verses") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ValueError("Dataset must be an object containing a 'verses' array.")

    verses = [normalize_verse(row, index) for index, row in enumerate(rows, start=1)]
    if len(verses) != 31102:
        raise ValueError(f"Expected 31,102 KJV verses but found {len(verses)}.")

    references = {(row["book_code"], row["chapter"], row["verse"]) for row in verses}
    if len(references) != len(verses):
        raise ValueError("Dataset contains duplicate book, chapter, and verse references.")
    return verses


def fetch_embeddings(inputs: list[str], api_key: str, retries: int) -> list[list[float]]:
    body = json.dumps({"model": EMBEDDING_MODEL, "input": inputs}).encode("utf-8")
    request = urllib.request.Request(
        EMBEDDINGS_URL,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )

    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
            rows = payload.get("data")
            if not isinstance(rows, list) or len(rows) != len(inputs):
                raise ValueError("OpenAI returned an unexpected number of embeddings.")
            embeddings = [row.get("embedding") if isinstance(row, dict) else None for row in rows]
            if any(not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIMENSIONS for embedding in embeddings):
                raise ValueError(f"OpenAI returned an embedding with dimensions other than {EMBEDDING_DIMENSIONS}.")
            return embeddings
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                try:
                    error_detail = error.read().decode("utf-8")
                except OSError:
                    error_detail = ""
                message = f"OpenAI authorization failed (HTTP {error.code}). Check OPENAI_API_KEY."
                if error_detail:
                    message = f"{message} OpenAI response: {error_detail}"
                raise RuntimeError(message) from error
            try:
                error_detail = error.read().decode("utf-8")
            except OSError:
                error_detail = ""
            if attempt == retries:
                message = f"OpenAI embeddings request failed after {attempt + 1} attempt(s): HTTP {error.code}."
                if error_detail:
                    message = f"{message} OpenAI response: {error_detail}"
                raise RuntimeError(message) from error
            retry_after = error.headers.get("Retry-After")
            try:
                delay_seconds = max(float(retry_after), DEFAULT_RETRY_DELAY_SECONDS) if retry_after else DEFAULT_RETRY_DELAY_SECONDS * (2 ** attempt)
            except ValueError:
                delay_seconds = DEFAULT_RETRY_DELAY_SECONDS * (2 ** attempt)
            print(f"Embedding request failed (HTTP {error.code}); retrying in {delay_seconds:g}s...", file=sys.stderr)
            time.sleep(delay_seconds)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            if attempt == retries:
                raise RuntimeError(f"OpenAI embeddings request failed after {attempt + 1} attempt(s): {error}") from error
            delay_seconds = 2 ** attempt
            print(f"Embedding request failed ({error}); retrying in {delay_seconds}s...", file=sys.stderr)
            time.sleep(delay_seconds)

    raise AssertionError("Unreachable")


def write_csv(verses: list[dict], output_path: Path, api_key: str, batch_size: int, retries: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.partial")
    if temporary_path.exists():
        temporary_path.unlink()

    try:
        with temporary_path.open("w", encoding="utf-8", newline="") as output_file:
            writer = csv.DictWriter(output_file, fieldnames=["book", "book_code", "chapter", "verse", "text", "embedding"])
            writer.writeheader()
            for start in range(0, len(verses), batch_size):
                batch = verses[start:start + batch_size]
                embeddings = fetch_embeddings([row["text"] for row in batch], api_key, retries)
                for verse, embedding in zip(batch, embeddings, strict=True):
                    writer.writerow({**verse, "embedding": json.dumps(embedding, separators=(",", ":"))})
                print(f"Embedded {min(start + len(batch), len(verses))}/{len(verses)} verses.")
        temporary_path.replace(output_path)
    except Exception:
        if temporary_path.exists():
            temporary_path.unlink()
        raise


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate OpenAI embeddings for the local KJV corpus.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help=f"KJV corpus path (default: {DEFAULT_INPUT})")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help=f"CSV output path (default: {DEFAULT_OUTPUT})")
    parser.add_argument("--batch-size", type=int, default=100, help="Verses per embeddings request (default: 100)")
    parser.add_argument("--retries", type=int, default=3, help="Retries for a failed request (default: 3)")
    parser.add_argument("--validate-only", action="store_true", help="Validate the local corpus without calling OpenAI.")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    if arguments.batch_size < 1 or arguments.batch_size > 1000:
        print("--batch-size must be between 1 and 1000.", file=sys.stderr)
        return 2
    if arguments.retries < 0:
        print("--retries cannot be negative.", file=sys.stderr)
        return 2

    try:
        verses = load_verses(arguments.input)
        print(f"Validated {len(verses)} KJV verses from {arguments.input}.")
        if arguments.validate_only:
            return 0

        load_env_file(PROJECT_ROOT / ".env")
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set. Add it to the local .env file or environment before running this script.")
        if api_key.lower() in {"your_openai_key", "your_openai_api_key", "replace_me"}:
            raise ValueError("OPENAI_API_KEY still contains an example placeholder. Replace it with an active OpenAI API key.")

        write_csv(verses, arguments.output, api_key, arguments.batch_size, arguments.retries)
        print(f"Wrote import CSV to {arguments.output}.")
        return 0
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())