# Bracket Day Indexing (Day 1 vs Day 2 Color Scheme)

This document explains how game days are mapped for the flat bracket visualization's color scheme (light blue = day 2, light yellow = day 1).

## Key Concept: GID vs Game

**Each R64 matchup has 2 gids** (2 team slots). The bracket displays 64 leaf cells—one per team slot. Consecutive gids form a game:
- gids 1,2 = game 1; gids 3,4 = game 2; etc.

**Both slots in a game must return the same day** or opponents will show different colors. Use `gameIdx = floor((gid - base) / 2)` to get the game index within a region.

## GID Ranges by Region

| Region   | GIDs    | Games |
|----------|---------|-------|
| South    | 1–16    | 8     |
| West     | 17–32   | 8     |
| Midwest  | 33–48   | 8     |
| East     | 49–64   | 8     |

## Seed Order (Bracket Games)

Bracket games 1–8 within each region (in display order):
- **Game 1:** 1v16
- **Game 2:** 8v9
- **Game 3:** 5v12
- **Game 4:** 4v13
- **Game 5:** 6v11
- **Game 6:** 3v14
- **Game 7:** 7v10
- **Game 8:** 2v15

## GID-to-Game Mapping

### South & West (r_to_l order)

Seeds iterate: 1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15.

- gids 1,2 → game 1 (1v16)
- gids 3,4 → game 2 (8v9)
- gids 5,6 → game 3 (5v12)
- …continuing in order

Day lookup uses `flatToRslot(gid)` and the shared `r64` array.

### East & Midwest (l_to_r order)

Seeds iterate: 15, 2, 10, 7, 14, 3, 11, 6, 13, 4, 12, 5, 9, 8, 16, 1.

GID pairs map to bracket games in reverse order:

| gameIdx | GIDs    | Bracket Game |
|---------|---------|--------------|
| 0       | 49, 50  | Game 8 (2v15)|
| 1       | 51, 52  | Game 7 (7v10)|
| 2       | 53, 54  | Game 6 (3v14)|
| 3       | 55, 56  | Game 4 (4v13)|
| 4       | 57, 58  | Game 3 (5v12)|
| 5       | 59, 60  | Game 5 (6v11)|
| 6       | 61, 62  | Game 2 (8v9) |
| 7       | 63, 64  | Game 1 (1v16)|

## Day Assignments by Region (2026)

Game indices follow East, South, Midwest, West order (1–8 per region).

### R64 (32 games)
```r
B64_R64_DAY1_GAMES <- c(1L, 2L, 5L, 6L, 11L, 12L, 13L, 14L, 15L, 16L, 17L, 18L, 27L, 28L, 29L, 30L)
B64_R64_DAY2_GAMES <- c(3L, 4L, 7L, 8L, 9L, 10L, 19L, 20L, 21L, 22L, 23L, 24L, 25L, 26L, 31L, 32L)
```

### East (games 1–8)
- **Day 1 (yellow):** Games 1, 2, 5, 6
- **Day 2 (blue):** Games 3, 4, 7, 8

### South (games 9–16)
- **Day 1 (yellow):** Games 11, 12, 13, 14, 15, 16
- **Day 2 (blue):** Games 9, 10

### Midwest (games 17–24)
- **Day 1 (yellow):** Games 17, 18
- **Day 2 (blue):** Games 19, 20, 21, 22, 23, 24

### West (games 25–32)
- **Day 1 (yellow):** Games 27, 28, 29, 30
- **Day 2 (blue):** Games 25, 26, 31, 32

### R32 (16 games)
```r
B64_R32_DAY1_GAMES <- c(1L, 3L, 6L, 7L, 8L, 9L, 14L, 15L)
B64_R32_DAY2_GAMES <- c(4L, 2L, 5L, 10L, 11L, 12L, 13L, 16L)
```

### S16 (8 games)
```r
B64_S16_DAY1_GAMES <- c(3L, 4L, 5L, 6L)  # South, Midwest
B64_S16_DAY2_GAMES <- c(1L, 2L, 7L, 8L)  # East, West
```

## R32 Inheritance

R32 games inherit their day from the R64 games that feed into them. If both R64 children are day 1, the R32 game is day 1. The tree structure ensures both R64 children of an R32 node are from the same session.

## Implementation (getGameDay)

1. **Round 1:** Compute `gameIdx = floor((gid - base) / 2)` so both slots in a game share the same index.
2. **East/Midwest:** Map `gameIdx` → bracket game → day via region-specific lookup.
3. **South/West:** Use `flatToRslot` + `r64` array.
4. **Round 2:** Derive day from R64 children when the node is available; fallback to `r32` array.
5. **Round 3:** Use fixed day-by-region (South/Midwest day 1, East/West day 2 for 2026 Sweet 16).
