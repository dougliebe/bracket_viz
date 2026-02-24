#!/usr/bin/env python3
"""
Download NCAA team logo PNGs into the logos folder.
Uses Sports Reference CDN (cdn.ssref.net) as the image source.
Takes university/team names as input and saves logos as logos/{name}.png.
"""

import argparse
import re
import urllib.request
from pathlib import Path

LOGO_DIR = Path(__file__).parent / "logos"
CDN_BASE = "https://cdn.ssref.net/req/202505011/tlogo/ncaa"

# Manual overrides: display name -> sports-reference URL slug
# Add entries when auto-conversion fails
SLUG_OVERRIDES = {
    "Miami FL": "miami-fl",
    "Texas A&M": "texas-am",
    "Wichita St.": "wichita-state",
    "Oregon St.": "oregon-state",
    "Fresno St.": "fresno-state",
    "South Dakota St.": "south-dakota-state",
    "Michigan St.": "michigan-state",
    "Iowa St.": "iowa-state",
    "Weber St.": "weber-state",
    "Cal St. Bakersfield": "cal-state-bakersfield",
    "Stephen F. Austin": "stephen-f-austin",
    "Arkansas Little Rock": "arkansas-little-rock",
    "UNC Asheville": "north-carolina-asheville",
    "UNC Wilmington": "north-carolina-wilmington",
    "Saint Joseph's": "saint-josephs",
    "Florida Gulf Coast": "florida-gulf-coast",
    "Middle Tennessee": "middle-tennessee",
    "Green Bay": "green-bay",
    "Northern Iowa": "northern-iowa",
    "VCU": "virginia-commonwealth",
    "USC": "southern-california",
    "UConn": "connecticut",
    "Connecticut": "connecticut",
    "BYU": "brigham-young",
    "SMU": "southern-methodist",
    "UCLA": "ucla",
    "UNLV": "unlv",
    "St. John's": "st-johns-ny",
    "St John's": "st-johns-ny",  # teams.json/bracket.json spelling (no period)
    "St. Mary's": "saint-marys-ca",
    "Loyola Chicago": "loyola-chicago",
    "Loyola Marymount": "loyola-marymount",
}


def name_to_slug(name: str) -> str:
    """Convert display name to sports-reference URL slug."""
    name = name.strip()
    if name in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[name]

    # Lowercase, replace common abbreviations and special chars
    s = name.lower()
    s = re.sub(r"\s+st\.?\s*$", " st", s)  # "Wichita St." -> "wichita st"
    s = re.sub(r"\s+st\.?\s+", " st ", s)  # "Oregon St." in middle
    s = re.sub(r"&", " ", s)
    s = re.sub(r"['.]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9\-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _try_download(slug: str, out_path: Path) -> bool:
    """Try to download from slug. Returns True if successful."""
    url = f"{CDN_BASE}/{slug}.png"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return False
            data = resp.read()
            if len(data) < 100:  # Likely not a real image
                return False
            LOGO_DIR.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    except Exception:
        return False


def download_logo(name: str) -> bool:
    """Download logo for team name. Returns True if successful."""
    slug = name_to_slug(name)
    out_path = LOGO_DIR / f"{name}.png"

    if _try_download(slug, out_path):
        return True
    # Fallback: try -st -> -state (e.g. wichita-st -> wichita-state)
    if "-st" in slug and not slug.endswith("-state"):
        alt = slug.replace("-st", "-state")
        if _try_download(alt, out_path):
            return True
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Download NCAA team logos into the logos folder."
    )
    parser.add_argument(
        "teams",
        nargs="*",
        help="Team names (e.g. Kansas Gonzaga 'North Carolina')",
    )
    parser.add_argument(
        "-f",
        "--file",
        help="Read team names from file (one per line)",
    )
    parser.add_argument(
        "-b",
        "--bracket",
        action="store_true",
        help="Read team names from bracket.json in this repo",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Only print failures",
    )
    args = parser.parse_args()

    teams = list(args.teams)
    if args.file:
        path = Path(args.file)
        if path.exists():
            teams.extend(path.read_text(encoding="utf-8").strip().splitlines())
        else:
            print(f"File not found: {path}")
            return 1

    if args.bracket:
        import json
        bracket_path = Path(__file__).parent / "bracket.json"
        if bracket_path.exists():
            data = json.loads(bracket_path.read_text(encoding="utf-8"))
            for region_teams in data.values():
                teams.extend(region_teams.values())
        else:
            print(f"bracket.json not found: {bracket_path}")
            return 1

    if not teams:
        parser.print_help()
        return 0

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    ok, fail = 0, 0

    for name in teams:
        name = name.strip()
        if not name:
            continue
        if download_logo(name):
            ok += 1
            if not args.quiet:
                print(f"OK: {name}")
        else:
            fail += 1
            print(f"FAIL: {name} (slug: {name_to_slug(name)})")

    if not args.quiet or fail:
        print(f"\nDone: {ok} downloaded, {fail} failed. Logos saved to {LOGO_DIR}")

    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
