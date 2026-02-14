# Interactive Radial NCAA Bracket

An interactive radial NCAA tournament bracket. Click on teams to advance them through rounds. Based on [roundbracket](https://github.com/llimllib/roundbracket) by Bill Mill.

## How to Run

1. Serve the folder with a local HTTP server (required for loading JSON):
   ```bash
   npx serve -p 3000
   ```
2. Open http://localhost:3000 in your browser.

## Features

- **Click to advance:** Click any team to advance them to the next round
- **Re-selection:** Click the other team in a matchup to change the winner
- **Path visualization:** Advancing teams show a colored path through the bracket
- **Reset:** Clear all selections and start over

## Data

Uses `bracket.json` for team names (simple format: `{ region: { seed: "TeamName" } }`). Falls back to `teams.json` if needed. All matchups are treated as 50/50—no odds or probabilities.
