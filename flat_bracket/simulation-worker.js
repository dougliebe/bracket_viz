/**
 * Web Worker for bracket simulation - runs a chunk of sims with seeded RNG.
 * Receives: { teams, elos, nsims, rounds, workerId, seed }
 * Returns: { exitCounts, teams }
 */

'use strict';

var N_ROUNDS = 6;

function eloWinProb(eloA, eloB) {
  if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) return 0.5;
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/** xorshift32 - fast seeded RNG */
function createRng(seed) {
  var state = seed || 1;
  return function() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function runSimulations(teams, elos, nsims, rounds, random) {
  var n = teams.length;
  var exitCounts = [];
  for (var t = 0; t < n; t++) {
    exitCounts.push({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, champ: 0 });
  }

  for (var sim = 0; sim < nsims; sim++) {
    var currentIds = [];
    for (var i = 0; i < n; i++) currentIds.push(i);

    for (var r = 1; r <= N_ROUNDS; r++) {
      var pairs = rounds[r];
      var winners = [];
      for (var g = 0; g < pairs.length; g++) {
        var slotA = pairs[g][0];
        var slotB = pairs[g][1];
        var aId = currentIds[slotA];
        var bId = currentIds[slotB];
        var p = eloWinProb(elos[aId], elos[bId]);
        var winner = random() < p ? aId : bId;
        var loser = winner === aId ? bId : aId;
        exitCounts[loser][r]++;
        winners.push(winner);
      }
      currentIds = winners;
    }
    exitCounts[currentIds[0]].champ++;
  }

  return exitCounts;
}

self.onmessage = function(e) {
  var data = e.data;
  var teams = data.teams;
  var elos = data.elos;
  var nsims = data.nsims || 0;
  var rounds = data.rounds;
  var workerId = data.workerId || 0;
  var seed = (data.seed || 12345) + workerId * 1000000;

  if (!rounds) return;
  var random = createRng(seed);
  var exitCounts = runSimulations(teams, elos, nsims, rounds, random);

  self.postMessage({ exitCounts: exitCounts, teams: teams });
};
