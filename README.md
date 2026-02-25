# Interactive Radial NCAA Bracket

An interactive radial NCAA tournament bracket. Click on teams to advance them through rounds. Based on [roundbracket](https://github.com/llimllib/roundbracket) by Bill Mill.

## How to Run

1. Serve the folder with a local HTTP server (required for loading JSON):
   ```bash
   npx serve -p 3000
   ```
2. Open http://localhost:3000 in your browser.

## Features

- **Bracket sizes:** Choose 8, 16, 32, or 64 teams. Smaller brackets show only the inner rings.
- **Click to advance:** Click any team to advance them to the next round
- **Re-selection:** Click the other team in a matchup to change the winner
- **Path visualization:** Advancing teams show a colored path through the bracket
- **Reset:** Clear all selections and start over

## Data

Uses `bracket.json` for team names (simple format: `{ region: { seed: "TeamName" } }`). Falls back to `teams.json` if needed. All matchups are treated as 50/50—no odds or probabilities.

### Building bracket.json from Kaggle CSVs

To refresh the bracket for a new season, run `build_bracket_from_csv.py` with your Kaggle data folder:

```bash
# Option 1: Environment variable
set NCAA_DATA_DIR=C:\path\to\kaggle\ncaa\data
py build_bracket_from_csv.py

# Option 2: Command-line argument
py build_bracket_from_csv.py --data-dir C:\path\to\kaggle\ncaa\data
```

The script expects `MNCAATourneySeeds.csv`, `MTeams.csv`, `MTeamSpellings.csv`, and Elo data in that folder. See `READ_CSVS.md` for details.

### Team logos

To download team logo PNGs into the `logos/` folder:

```bash
# From bracket.json
py download_logos.py --bracket

# From command line (quote multi-word names)
py download_logos.py Kansas Gonzaga "North Carolina"

# From a file (one team per line)
py download_logos.py -f teams.txt
```
