# Fast Simulation Stage: Teams + Elos Only

This guide describes how to implement the fastest possible tournament simulation given only a list of teams and their Elo ratings. No external data sources or project-specific files are required.

---

## Input

- **teams**: vector of team identifiers (strings or integers)
- **elos**: numeric vector of Elo ratings, same length and order as teams

For a 64-team bracket, you need 64 teams and 64 Elos.

---

## Elo Win Probability

The probability that team A beats team B:

```
P(A beats B) = 1 / (1 + 10^((elo_B - elo_A) / 400))
```

Equivalently, with `scale = 400` and `base = 10`:

```
P(A beats B) = 1 / (1 + base^(-(elo_A - elo_B) / scale))
```

Use whichever form is cheaper in your language. For missing or invalid Elo, treat as 0.5 (coin flip).

---

## Bracket Structure

Single-elimination, power-of-two teams (e.g. 64).

**Round 1**: Pair slots (1,2), (3,4), (5,6), … → 32 games  
**Round 2**: Winners paired (1,2), (3,4), … → 16 games  
**Round 3**: 8 games  
**Round 4**: 4 games (Elite 8)  
**Round 5**: 2 games (Final Four)  
**Round 6**: 1 game (Championship)

Total: 63 games per bracket.

**Pairing rule**: Adjacent slots in current round. Winners advance in game order; slot 1 winner plays slot 2 winner, etc.

---

## Optimization Strategies (Fastest First)

### 1. Use Integer Indices

Map teams to 1..N. Do all simulation with integer indices. Look up team names only when producing output. Avoid string comparisons and hashing in the hot loop.

### 2. Compute Win Probability On-the-Fly

For “full bracket from start” simulations, you do **not** need an N×N win-probability matrix. For each game you know the two team indices; compute:

```
p = 1 / (1 + 10^((elo[b] - elo[a]) / 400))
```

Vectorize this over all games in a round. Avoids O(N²) memory and setup.

### 3. Precompute Round Structure Once

The pairing indices for each round are fixed and do not depend on Elo or simulation. Build them once:

- Round 1: pairs (1,2), (3,4), …, (63,64)
- Round 2: pairs (1,2), (3,4), …, (31,32) — where 1..32 are *slot* indices of round-1 winners
- etc.

Store `pair_idx` per round. Reuse across all simulations.

### 4. Vectorize Per Round

For each round, compute all games at once:

- `a_ids` = team indices for “first” team in each game  
- `b_ids` = team indices for “second” team  
- `p = 1 / (1 + 10^((elo[b_ids] - elo[a_ids]) / 400))`  
- `u = random_uniform(n_games)`  
- `winners = where(u < p, a_ids, b_ids)`

Use native vector/array operations. Avoid per-game loops.

### 5. Output Only What You Need

- **Champion counts**: Store only the champion index per simulation. No need to record every game.
- **Full paths**: Only if you need round-by-round outcomes. Otherwise, a single integer per sim is enough.

### 6. Batch Simulations

- Outer loop: simulations (1 to nsims)
- Inner loop: rounds (1 to 6 for 64 teams)
- Preallocate output (e.g. `champ_ids[nsims]` or `out_mat[126, nsims]` for full paths)
- Avoid growing arrays inside loops

### 7. Native Code (C++ / Rust / etc.)

The inner loop (games × rounds × sims) dominates runtime. Moving it to compiled code typically gives a large speedup (often 10× or more). Pattern:

- For each game: lookup `p`, draw `u`, set `winner = (u < p) ? a : b`
- Use a fast RNG (e.g. xorshift, PCG) if your runtime’s default is slow

### 8. Parallelize Across Simulations

Simulations are independent. Split `nsims` across workers (threads or processes). Each worker runs the same loop over its subset of sims. Linear speedup with core count (up to I/O and scheduling limits).

---

## Pseudocode: Minimal Fast Path

```
Input: teams[1..N], elos[1..N], nsims

# Precompute round structure (once)
rounds = build_rounds(N)   # list of pair matrices per round

# Preallocate
champ_counts[1..N] = 0

For sim = 1 to nsims:
  current_ids = [1, 2, ..., N]   # slot -> team index

  For r = 1 to num_rounds:
    pair = rounds[r]            # (slot_a, slot_b) per game
    a_ids = current_ids[pair[:,1]]
    b_ids = current_ids[pair[:,2]]

    p = 1 / (1 + 10^((elos[b_ids] - elos[a_ids]) / 400))
    u = random_uniform(length(p))
    winners = (u < p) ? a_ids : b_ids

    # Winners become next round's slots (in game order)
    current_ids = winners

  champion = current_ids[1]
  champ_counts[champion] += 1

Return champ_counts / nsims   # championship probabilities
```

---

## Building the Round Structure

For N teams (power of 2):

```
rounds = []
slots = [1, 2, ..., N]

while length(slots) > 1:
  pairs = reshape(slots, 2 columns)   # (1,2), (3,4), ...
  rounds.append(pairs)
  slots = [1, 2, ..., length(pairs)]  # winners as new slots

return rounds
```

Each `pairs` matrix has 2 columns; row `g` is `(slot_a, slot_b)` for game `g`. `current_ids[slot_a]` and `current_ids[slot_b]` are the team indices for that game.

---

## RNG Notes

- Use a single stream with a seed for reproducibility.
- For parallelism, give each worker a different seed or substream (e.g. split by sim index).
- Avoid slow RNGs in the inner loop; a simple LCG or xorshift is usually sufficient.

---

## Summary Checklist

| Optimization | Impact |
|-------------|--------|
| Integer indices only in hot loop | High |
| On-the-fly P(win) from Elo (no N×N matrix) | High |
| Precompute round structure | Medium |
| Vectorize per round | High |
| Minimal output (champion only) | Medium |
| Compiled/native inner loop | Very high |
| Parallelize across sims | High (scales with cores) |
