import json
import csv
import urllib.request
from collections import defaultdict

# --- Load reference codes ---
# Replace these with your actual JSON files or inline data
with open("le-occupation.json") as f:
    occupations = {o["occupation_code"] for o in json.load(f)}

with open("le-indy.json") as f:
    industries = {i["indy_code"] for i in json.load(f)}

# --- Download le.series ---
with open("le.json") as f:
    series = json.load(f)

# --- Base filter criteria ---
BASE = {
    "lfst_code": "25",
    "fips_code": "00",
    "earn_code": "01",
    "class_code": "16",
    "education_code": "00",
    "ages_code": "00",
    "race_code": "00",
    "orig_code": "00",
    "seasonal": "U",
    "cert_code": "00",
    "born_code": "00",
    "unin_code": "0",
}

def matches_base(row):
    return all(row.get(k) == v for k, v in BASE.items())

# --- Series type matchers ---
def is_men(row):
    return row["sexs_code"] == "1" and row["pcts_code"] == "00"

def is_women(row):
    return row["sexs_code"] == "2" and row["pcts_code"] == "00"

def is_pct(row):
    return row["pcts_code"] == "50"

# --- Filter by occupation (indy_code must be 0000) ---
occupation_series = defaultdict(dict)
for row in series:
    if not matches_base(row):
        continue
    if row["indy_code"] != "0000":
        continue
    occ = row["occupation_code"]
    if occ not in occupations:
        continue
    if is_men(row):
        occupation_series[occ]["men"] = row["series_id"]
    elif is_women(row):
        occupation_series[occ]["women"] = row["series_id"]
    elif is_pct(row):
        occupation_series[occ]["women_pct_of_men"] = row["series_id"]

# --- Filter by industry (occupation_code must be 0000) ---
industry_series = defaultdict(dict)
for row in series:
    if not matches_base(row):
        continue
    if row["occupation_code"] != "0000":
        continue
    indy = row["indy_code"]
    if indy not in industries:
        continue
    if is_men(row):
        industry_series[indy]["men"] = row["series_id"]
    elif is_women(row):
        industry_series[indy]["women"] = row["series_id"]
    elif is_pct(row):
        industry_series[indy]["women_pct_of_men"] = row["series_id"]

# --- Output ---
result = {
    "by_occupation": dict(occupation_series),
    "by_industry": dict(industry_series),
}

with open("le_series_index.json", "w") as f:
    json.dump(result, f, indent=2)

# --- Coverage report ---
def coverage_report(series_dict, label, code_to_text):
    full = []
    partial = []
    missing_all = []

    for code in code_to_text:
        entry = series_dict.get(code, {})
        has_men = "men" in entry
        has_women = "women" in entry
        has_pct = "women_pct_of_men" in entry

        if not has_men and not has_women and not has_pct:
            missing_all.append(code)
        elif has_men and has_women and has_pct:
            full.append(code)
        else:
            partial.append((code, {
                "men": has_men,
                "women": has_women,
                "women_pct_of_men": has_pct,
            }))

    print(f"\n=== {label} ===")
    print(f"  Full coverage (all 3):     {len(full)}")
    print(f"  Partial coverage:          {len(partial)}")
    print(f"  No series found:           {len(missing_all)}")

    if partial:
        print("\n  Partial:")
        for code, flags in partial:
            missing = [k for k, v in flags.items() if not v]
            print(f"    {code} ({code_to_text[code]}): missing {missing}")

    if missing_all:
        print("\n  No series at all:")
        for code in missing_all:
            print(f"    {code} ({code_to_text[code]})")

# Rebuild as code -> text dicts for the report
with open("le-occupation.json") as f:
    occ_text = {o["occupation_code"]: o["occupation_text"] for o in json.load(f)}

with open("le-indy.json") as f:
    indy_text = {i["indy_code"]: i["indy_text"] for i in json.load(f)}

coverage_report(occupation_series, "Occupations", occ_text)
coverage_report(industry_series, "Industries", indy_text)