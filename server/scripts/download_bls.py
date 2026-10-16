#!/usr/bin/env python3
"""
BLS flat file converter — LE (earnings) and LU (union) series ID files

Download + convert in one shot:
    python bls_convert.py --download          # downloads both, outputs both as CSV
    python bls_convert.py --download --json   # downloads both, outputs both as JSON

Convert a file you already have:
    python bls_convert.py le.series           # → le.csv
    python bls_convert.py le.series --json    # → le.json
    python bls_convert.py lu.series --json    # → lu.json
"""

import sys
import re
import csv
import json
import urllib.request
try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
from pathlib import Path

BLS_FILES = {
    "le.series": "https://download.bls.gov/pub/time.series/le/le.series",
    "lu.series": "https://download.bls.gov/pub/time.series/lu/lu.series",
}


HEADERS = {
    "User-Agent":                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    "Referer":                   "https://www.bls.gov/",
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language":           "en-US,en;q=0.9",
    "Connection":                "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control":             "no-cache",
    "Pragma":                    "no-cache",
    # NOTE: no Accept-Encoding here — let the HTTP client handle decompression
}


def download_file(url: str, dest: Path):
    print(f"  Downloading {url}")
    if HAS_REQUESTS:
        # requests auto-decompresses gzip/br responses
        resp = _requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
    else:
        # urllib fallback — works only if server sends uncompressed response
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
            f.write(resp.read())
    print(f"  Saved -> {dest} ({dest.stat().st_size:,} bytes)")


def parse_bls_flatfile(path: Path) -> tuple[list[str], list[dict]]:
    """
    Parse a BLS flat file. Handles:
    - Tab-separated columns
    - Multi-space-separated columns (collapsed whitespace)
    - Mixed leading/trailing whitespace
    - First row as header
    """
    # detect encoding from BOM
    raw = path.read_bytes()
    if raw[:2] == b"\xff\xfe":
        encoding = "utf-16-le"
        raw = raw[2:]          # strip BOM
    elif raw[:2] == b"\xfe\xff":
        encoding = "utf-16-be"
        raw = raw[2:]          # strip BOM
    elif raw[:3] == b"\xef\xbb\xbf":
        encoding = "utf-8"
        raw = raw[3:]          # strip UTF-8 BOM
    else:
        encoding = "utf-8"

    lines = raw.decode(encoding, errors="replace").splitlines()

    # drop empty lines
    lines = [l for l in lines if l.strip()]

    if not lines:
        raise ValueError(f"File is empty: {path}")

    # detect delimiter: if header has tabs, use tab; else split on 2+ spaces
    header_line = lines[0]
    if "\t" in header_line:
        delimiter = "tab"
        headers = [h.strip() for h in header_line.split("\t")]
    else:
        delimiter = "whitespace"
        headers = header_line.split()

    # remove empty header tokens
    headers = [h for h in headers if h]

    rows = []
    for i, line in enumerate(lines[1:], start=2):
        if not line.strip():
            continue

        if delimiter == "tab":
            parts = [p.strip() for p in line.split("\t")]
        else:
            # BLS whitespace files: series_id has no spaces,
            # but text fields may have multiple words.
            # Strategy: split on 2+ consecutive spaces to preserve text fields.
            parts = re.split(r"  +", line.strip())
            # fallback: if only one part came back, try single-space split
            if len(parts) < len(headers):
                parts = line.split()

        # pad or truncate to match header count
        if len(parts) < len(headers):
            parts += [""] * (len(headers) - len(parts))
        elif len(parts) > len(headers):
            # merge overflow into last column (handles text fields with spaces)
            parts = parts[:len(headers) - 1] + [" ".join(parts[len(headers) - 1:])]

        rows.append(dict(zip(headers, parts)))

    return headers, rows


def to_csv(headers: list[str], rows: list[dict], out_path: Path):
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Wrote {len(rows):,} rows → {out_path}")


def to_json(rows: list[dict], out_path: Path):
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print(f"  Wrote {len(rows):,} rows → {out_path}")


def convert(input_path: Path, use_json: bool):
    print(f"Parsing: {input_path}")
    headers, rows = parse_bls_flatfile(input_path)
    print(f"  Detected {len(headers)} columns: {headers}")
    if use_json:
        to_json(rows, input_path.with_suffix(".json"))
    else:
        to_csv(headers, rows, input_path.with_suffix(".csv"))

def json_strip(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        file = json.load(f)
    newf = []
    for row in file:
        newf.append({
            'id': row['series_id'],
            'title': row['series_title']
        })
    with open(path.with_name(f"{path.name}_strip"), "w", encoding="utf-8") as f:
        json.dump(newf,f,ensure_ascii=False,indent=2)

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    use_json = "--json" in sys.argv
    striping = "--strip-json" in sys.argv
    if striping is True:
        input_path = Path(sys.argv[1])
        json_strip(input_path)
        return
    if "--download" in sys.argv:
        for filename, url in BLS_FILES.items():
            dest = Path(filename)
            download_file(url, dest)
            convert(dest, use_json)
        return

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: file not found — {input_path}")
        sys.exit(1)
    convert(input_path, use_json)


if __name__ == "__main__":
    main()