#!/usr/bin/env python3
"""One-time helper: convert a slice of data/generated/kjv_embeddings.csv rows into a
SQL file of INSERT statements for public.bible_verses, for use with
`supabase db query --linked -f <output>`. Not part of the deployed app.
"""

import argparse
import csv
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = PROJECT_ROOT / "data" / "generated" / "kjv_embeddings.csv"


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start", type=int, default=0, help="0-based row offset")
    parser.add_argument("--limit", type=int, required=True)
    parser.add_argument("--translation", default="KJV")
    args = parser.parse_args()

    csv.field_size_limit(sys.maxsize)

    rows_written = 0
    with args.input.open("r", encoding="utf-8", newline="") as infile, \
         args.output.open("w", encoding="utf-8") as outfile:
        reader = csv.DictReader(infile)
        outfile.write(
            "insert into public.bible_verses "
            "(translation, book, book_code, chapter, verse, reference, text, embedding) values\n"
        )
        values_lines = []
        for index, row in enumerate(reader):
            if index < args.start:
                continue
            if rows_written >= args.limit:
                break
            reference = f"{row['book']} {row['chapter']}:{row['verse']}"
            values_lines.append(
                "("
                f"{sql_quote(args.translation)}, "
                f"{sql_quote(row['book'])}, "
                f"{sql_quote(row['book_code'])}, "
                f"{int(row['chapter'])}, "
                f"{int(row['verse'])}, "
                f"{sql_quote(reference)}, "
                f"{sql_quote(row['text'])}, "
                f"{sql_quote(row['embedding'])}::vector"
                ")"
            )
            rows_written += 1
        outfile.write(",\n".join(values_lines))
        outfile.write("\non conflict (translation, book_code, chapter, verse) do nothing;\n")

    print(f"Wrote {rows_written} rows to {args.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
