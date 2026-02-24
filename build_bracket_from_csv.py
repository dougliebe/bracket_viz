#!/usr/bin/env python3
"""
Build teams.json for the flat bracket from NCAA Kaggle CSV data.
Replicates the R logic from READ_CSVS.md: load 2025 seeds, join with team names,
filter play-in losers, and output in NCAA bracket order for south/west/midwest/east.
"""

import csv
import json
import re
from pathlib import Path

# CSV paths (from user's R script)
DATA_DIR = Path("D:/ANALYTICS/ncaa/data")
SEEDS_CSV = DATA_DIR / "MNCAATourneySeeds.csv"
TEAMS_CSV = DATA_DIR / "MTeams.csv"
SPELLINGS_CSV = DATA_DIR / "MTeamSpellings.csv"
ELO_CSV = DATA_DIR / "data-KjK2N.csv"

# Play-in losers to exclude (elo row IDs from data-KjK2N.csv)
EXCLUDE_ELO_IDS = {208, 55, 43, 282}

# NCAA bracket order: regions W,X,Y,Z; seeds 1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15
SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]
REGION_ORDER = ["W", "X", "Y", "Z"]

# Flat bracket region mapping: CSV order is East(W), Midwest(X), South(Y), West(Z)
NCAA_TO_FLAT = {"W": "east", "X": "midwest", "Y": "south", "Z": "west"}


def load_csv(path):
    """Load CSV as list of dicts."""
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    season = 2025

    # Load seeds for 2025
    seeds = load_csv(SEEDS_CSV)
    seeds = [r for r in seeds if int(r["Season"]) == season]

    # Load team names
    teams_df = {int(r["TeamID"]): r["TeamName"] for r in load_csv(TEAMS_CSV)}

    # Build TeamID -> elo_row_id via spellings
    spellings = load_csv(SPELLINGS_CSV)
    spelling_to_team_id = {}
    for r in spellings:
        tid = int(r["TeamID"])
        key = r["TeamNameSpelling"].strip().lower()
        spelling_to_team_id[key] = tid

    # Load elo data with row ID (1-based)
    elo_rows = load_csv(ELO_CSV)
    # First column may be unnamed; pandas/R names it X1 or similar
    elo_by_team = {}
    for i, r in enumerate(elo_rows):
        row_id = i + 1  # 1-based
        team_raw = r.get("Team", r.get("team", ""))
        if not team_raw:
            # Try first column as fallback
            cols = list(r.keys())
            if cols and cols[0] and cols[0] != "Team":
                continue
        team_lower = team_raw.strip().lower()
        elo_by_team[team_lower] = {"row_id": row_id, "team_raw": team_raw}

    # Build TeamID -> elo row_id
    team_id_to_elo_id = {}
    for spelling, tid in spelling_to_team_id.items():
        if spelling in elo_by_team:
            team_id_to_elo_id[tid] = elo_by_team[spelling]["row_id"]

    # Process seeds: strip trailing letters (W16a -> W16), get TeamID, TeamName
    seed_to_teams = {}  # "W01" -> [(TeamID, TeamName), ...] for play-ins
    for r in seeds:
        raw_seed = r["Seed"]
        seed = re.sub(r"[a-z]", "", raw_seed)  # W16a -> W16
        tid = int(r["TeamID"])
        tname = teams_df.get(tid, f"Team{tid}")

        if seed not in seed_to_teams:
            seed_to_teams[seed] = []
        seed_to_teams[seed].append((tid, tname))

    # Create bracket order: W01..W16, X01..X16, Y01..Y16, Z01..Z16
    bracket_seeds = []
    for reg in REGION_ORDER:
        for s in SEED_ORDER:
            bracket_seeds.append(f"{reg}{s:02d}")

    # For each bracket slot, pick the team (filter play-in losers)
    ordered_teams = []
    for seed in bracket_seeds:
        candidates = seed_to_teams.get(seed, [])
        if not candidates:
            ordered_teams.append(None)
            continue
        # Filter out excluded (play-in losers)
        kept = [
            (tid, tname)
            for tid, tname in candidates
            if team_id_to_elo_id.get(tid, -1) not in EXCLUDE_ELO_IDS
        ]
        # If all excluded (shouldn't happen), take first
        if not kept:
            kept = candidates
        ordered_teams.append(kept[0][1])  # TeamName

    # Build flat bracket format: { south: {"1": team, "2": team, ...}, west, midwest, east }
    # Keys are actual seed numbers (1-16), not slot indices. Flat bracket looks up by seed.
    result = {"south": {}, "west": {}, "midwest": {}, "east": {}}
    for i, team in enumerate(ordered_teams):
        reg_idx = i // 16
        seed_idx = i % 16
        ncaa_reg = REGION_ORDER[reg_idx]
        flat_reg = NCAA_TO_FLAT[ncaa_reg]
        seed_key = str(SEED_ORDER[seed_idx])  # actual seed: "1", "16", "8", "9", ...
        result[flat_reg][seed_key] = team or f"TBD{seed_key}"

    base = Path(__file__).parent
    for name in ("teams.json", "bracket.json"):
        out_path = base / name
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        print(f"Wrote {out_path} with 2025 bracket (64 teams)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
