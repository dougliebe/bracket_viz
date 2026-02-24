# Reading Teams from CSV and Ordering for Bracket Building

This document explains how to read teams from CSV files in this project and how to order them correctly for building a bracket. There are two main data paths: a **simple team/elo CSV** and the **full Kaggle NCAA data**.

---

## 1. Simple CSV Format (`team,elo`)

### File Format

The simplest format is a two-column CSV:

```csv
team,elo
Gonzaga,1500
Baylor,1500
Illinois,1500
Michigan,1500
...
```

- **team**: Team name (string)
- **elo**: Elo rating (numeric). Used for win probability calculations.

A sample file is provided at `sample-teams.csv`. The header row (`team,elo`) is optional; the parser accepts both.

### Reading in R

```r
# Read the CSV
df <- read.csv("sample-teams.csv", stringsAsFactors = FALSE)

# Ensure you have team and elo columns
teams <- df$team
elos  <- as.numeric(df$elo)

# For MCTS, you need a data.frame(team, elo) with exactly 64 teams
bracket_df <- data.frame(team = teams, elo = elos, stringsAsFactors = FALSE)
```

### Reading in JavaScript (Web App)

The `index.html` app uses `parseTeamsCsv()` in `app.js`:

```javascript
function parseTeamsCsv(text) {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const maybeHeader = /^team\s*,\s*elo/i.test(lines[0]);
  const rows = maybeHeader ? lines.slice(1) : lines;
  const teams = [];
  for (const line of rows) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const elo = Number(parts[1]);
    if (!name || !Number.isFinite(elo)) continue;
    teams.push({ name, elo });
  }
  return teams;
}
```

### Bracket Order for Simple CSV (Elo-Based Seeding)

When using the simple CSV, the bracket is built by **seeding teams by Elo**:

1. **Sort teams by Elo descending** (highest Elo = seed 1).
2. **Pair for Round 1**: seed 1 vs seed 16, seed 2 vs seed 15, …, seed 8 vs seed 9.

This is implemented in `app.js` as `seedFirstRound()`:

```javascript
function seedFirstRound(teams) {
  const sorted = [...teams].sort((a, b) => b.elo - a.elo);
  const n = sorted.length;
  const matches = [];
  for (let i = 0; i < n / 2; i++) {
    const teamA = sorted[i];           // higher seed
    const teamB = sorted[n - 1 - i];   // lower seed
    matches.push({ teamA, teamB, ... });
  }
  return matches;
}
```

**Requirements for simple CSV:**
- Team count must be a power of two (2, 4, 8, 16, 32, 64).
- No duplicate team names.
- All rows must have non-empty team and numeric elo.

---

## 2. Full Kaggle NCAA Data (64-Team Bracket)

The MCTS survivor solver (`mcts64/`, `variable_round/`) uses the full NCAA data pipeline when available.

### Required Files

| File | Purpose |
|------|---------|
| `MNCAATourneySeeds.csv` | Tournament seeds (Season, TeamID, Seed) |
| `MTeams.csv` | Team IDs and names |
| `MTeamSpellings.csv` | Alternate spellings for matching to Elo |
| `data-KjK2N.csv` | Elo ratings (e.g. "Season Max." or "Current Elo") |

### Reading and Ordering

The function `load_b64_bracket_from_elo()` in `mcts64/b64_bracket_config.R` handles the full pipeline:

1. **Read seeds** for the target season (e.g. 2025).
2. **Merge** seeds → teams → spellings → Elo.
3. **Order** by NCAA bracket slot order (see below).
4. **Return** `data.frame(team, elo)` with 64 rows in bracket order.

### NCAA Bracket Slot Order

The 64-team bracket follows the standard NCAA structure:

- **Regions**: East (W), South (X), Midwest (Y), West (Z)
- **Slots 1–16**: East  
- **Slots 17–32**: South  
- **Slots 33–48**: Midwest  
- **Slots 49–64**: West  

Within each region, seeds are ordered for bracket matchups:

```
1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15
```

So slot 1 = 1-seed, slot 2 = 16-seed (1 vs 16), slot 3 = 8-seed, slot 4 = 9-seed (8 vs 9), etc.

### R Code for Bracket Order

From `b64_bracket_config.R`:

```r
# NCAA bracket order: W,X,Y,Z regions, each with seeds 1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15
seed_order <- c(1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15)
region_order <- c("W", "X", "Y", "Z")
bracket_seeds <- paste0(rep(region_order, each = 16), sprintf("%02d", rep(seed_order, 4)))

# ordered has rows in bracket slot order 1..64
ordered <- merged[match(bracket_seeds, merged$Seed), ]
```

### Round 1 Matchups

`build_b64_round1_matchups()` creates the 32 first-round games by pairing consecutive slots:

- Game 1: slots 1 vs 2 (1-seed vs 16-seed in East)
- Game 2: slots 3 vs 4 (8-seed vs 9-seed in East)
- … and so on for all 32 games.

---

## 3. Summary

| Data Source | Ordering Logic | Use Case |
|-------------|----------------|----------|
| Simple `team,elo` CSV | Sort by Elo descending; pair 1 vs N, 2 vs N−1, … | Web app, custom brackets |
| Full Kaggle data | NCAA bracket order (regions W,X,Y,Z; seeds 1,16,8,9,… per region) | MCTS survivor solver |

For the **simple CSV**, teams are ordered by strength (Elo) and paired in a standard 1–16, 2–15, … bracket.  
For the **full NCAA data**, teams are ordered by official bracket slots so that matchups and day splits (1a/1b, 2a/2b, etc.) match the real tournament structure.
