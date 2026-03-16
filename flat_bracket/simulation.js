/**
 * Bracket simulation engine - runs 100k Elo-based simulations from bracket state.
 * Outputs: reachAtLeast, roundExit, winRoundLoseNext for hover and team views.
 */

(function(global) {
  'use strict';

  var N_TEAMS = 64;
  var N_ROUNDS = 6;

  function eloWinProb(eloA, eloB) {
    if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) return 0.5;
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 1200));
  }

  /**
   * Build round structure from bracket tree so pairings match the actual bracket.
   * rounds[r] = array of [slotA, slotB] pairs for round r (1-based).
   */
  function buildRoundsFromTree(allNodes) {
    var rounds = {};
    var nodesByRound = {};
    for (var i = 0; i < allNodes.length; i++) {
      var n = allNodes[i];
      if (!nodesByRound[n.round]) nodesByRound[n.round] = [];
      nodesByRound[n.round].push(n);
    }
    for (var r in nodesByRound) {
      nodesByRound[r].sort(function(a, b) { return a.gid - b.gid; });
    }

    var round2Nodes = nodesByRound[2] || [];
    var pairs1 = [];
    for (var j = 0; j < round2Nodes.length; j++) {
      var n2 = round2Nodes[j];
      var c0 = n2.children && n2.children[0];
      var c1 = n2.children && n2.children[1];
      if (c0 && c1) pairs1.push([c0.gid - 1, c1.gid - 1]);
    }
    rounds[1] = pairs1;

    var nodeToSlot = {};
    for (var k = 0; k < round2Nodes.length; k++) nodeToSlot[round2Nodes[k].gid] = k;

    for (var round = 2; round <= N_ROUNDS; round++) {
      var parentNodes = nodesByRound[round + 1] || [];
      parentNodes.sort(function(a, b) { return a.gid - b.gid; });
      var pairs = [];
      for (var p = 0; p < parentNodes.length; p++) {
        var parent = parentNodes[p];
        var ch0 = parent.children && parent.children[0];
        var ch1 = parent.children && parent.children[1];
        if (ch0 && ch1) {
          var s0 = nodeToSlot[ch0.gid];
          var s1 = nodeToSlot[ch1.gid];
          if (s0 != null && s1 != null) pairs.push([s0, s1]);
        }
      }
      rounds[round] = pairs;
      nodeToSlot = {};
      for (var q = 0; q < parentNodes.length; q++) nodeToSlot[parentNodes[q].gid] = q;
    }
    return rounds;
  }

  /**
   * Extract teams and elos from bracket tree (leaf nodes, gid 1-64 in order).
   * Returns { teams: string[], elos: number[], teamIndexByName: {} } or null if invalid.
   */
  function extractState(allNodes) {
    var leafNodes = [];
    for (var i = 0; i < allNodes.length; i++) {
      var n = allNodes[i];
      if (n.round === 1 && n.gid >= 1 && n.gid <= N_TEAMS) {
        leafNodes.push(n);
      }
    }
    leafNodes.sort(function(a, b) { return a.gid - b.gid; });
    if (leafNodes.length !== N_TEAMS) return null;

    var teams = [];
    var elos = [];
    var teamIndexByName = {};
    for (var j = 0; j < leafNodes.length; j++) {
      var node = leafNodes[j];
      var team = node.team;
      var name = (team && team.name) ? team.name : 'Unknown';
      var elo = (team && team.elo != null && Number.isFinite(team.elo)) ? team.elo : 1500;
      teams.push(name);
      elos.push(elo);
      teamIndexByName[name] = j;
    }
    return { teams: teams, elos: elos, teamIndexByName: teamIndexByName };
  }

  function getSibling(node) {
    if (!node || !node.parent) return null;
    var children = node.parent.children || [];
    return children[0] === node ? children[1] : children[0];
  }

  function getTeamsInSubtree(node) {
    var teams = {};
    if (!node) return teams;
    var children = node.children || [];
    if (children.length === 0 && node.team) {
      teams[node.team.name] = true;
      return teams;
    }
    for (var i = 0; i < children.length; i++) {
      var sub = getTeamsInSubtree(children[i]);
      for (var t in sub) teams[t] = true;
    }
    return teams;
  }

  /**
   * Extract partial state when user has advanced some teams.
   * Returns { teams, elos, teamIndexByName, alreadyEliminated, isPartial } or null.
   * alreadyEliminated: { teamName: exitRound } - teams eliminated by user advances
   */
  function extractPartialState(allNodes) {
    var fullState = extractState(allNodes);
    if (!fullState) return null;

    var alreadyEliminated = {};
    var hasAdvances = false;

    for (var i = 0; i < allNodes.length; i++) {
      var node = allNodes[i];
      if (node.team && node.children && node.children.length === 2) {
        hasAdvances = true;
        /* Use the losing child's subtree, not the parent's sibling. The parent's sibling
         * would be the other half of the region (16 teams); we only want the loser of
         * this specific game. */
        var c0 = node.children[0], c1 = node.children[1];
        var winnerName = node.team.name;
        var losingChild = (c0.team && c0.team.name === winnerName) ? c1 : c0;
        /* Only pre-fill when the losing child is a leaf (round-1 game). When the
         * losing child has children (e.g. Sweet 16 node), we don't know which
         * specific team lost—only one could have. Pre-filling the whole subtree
         * would overcount and cause negative probabilities. The simulation will
         * record the actual loser when it skips the game (winner already there). */
        if (losingChild && (!losingChild.children || losingChild.children.length === 0)) {
          var losingTeams = getTeamsInSubtree(losingChild);
          var exitRound = node.round - 1;
          for (var t in losingTeams) {
            alreadyEliminated[t] = exitRound;
          }
        }
      }
    }

    return {
      teams: fullState.teams,
      elos: fullState.elos,
      teamIndexByName: fullState.teamIndexByName,
      alreadyEliminated: alreadyEliminated,
      isPartial: hasAdvances
    };
  }

  /**
   * Run simulations from partial bracket state (some teams already advanced).
   * Uses tree traversal; runs on main thread (no workers for partial).
   */
  function runPartialSimulations(allNodes, state, nsims) {
    var teams = state.teams;
    var elos = state.elos;
    var teamIndexByName = state.teamIndexByName;
    var alreadyEliminated = state.alreadyEliminated;
    var n = teams.length;

    var teamNameToElo = {};
    for (var i = 0; i < n; i++) {
      teamNameToElo[teams[i]] = elos[i];
    }

    var exitCounts = [];
    for (var t = 0; t < n; t++) {
      exitCounts.push({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, champ: 0 });
    }

    for (var teamName in alreadyEliminated) {
      var idx = teamIndexByName[teamName];
      if (idx != null) {
        var r = alreadyEliminated[teamName];
        exitCounts[idx][r] += nsims;
      }
    }

    var nodesByRound = {};
    for (var i = 0; i < allNodes.length; i++) {
      var nd = allNodes[i];
      if (!nodesByRound[nd.round]) nodesByRound[nd.round] = [];
      nodesByRound[nd.round].push(nd);
    }

    var root = allNodes.filter(function(n) { return n.round === 7; })[0];
    if (!root) return exitCounts;

    for (var sim = 0; sim < nsims; sim++) {
      var stateMap = {};
      for (var j = 0; j < allNodes.length; j++) {
        var nd = allNodes[j];
        if (nd.team && nd.team.name) stateMap[nd.gid] = nd.team.name;
      }

      for (var r = 2; r <= 7; r++) {
        var roundNodes = nodesByRound[r] || [];
        for (var k = 0; k < roundNodes.length; k++) {
          var node = roundNodes[k];
          var children = node.children || [];
          if (children.length !== 2) continue;
          var c0 = children[0], c1 = children[1];
          var teamA = stateMap[c0.gid], teamB = stateMap[c1.gid];
          if (stateMap[node.gid]) {
            /* Winner already advanced—record the loser for this sim */
            if (teamA && teamB) {
              var winner = stateMap[node.gid];
              var loser = (winner === teamA) ? teamB : teamA;
              var exitRound = r - 1;
              var loserIdx = teamIndexByName[loser];
              if (loserIdx != null) exitCounts[loserIdx][exitRound]++;
            }
            continue;
          }
          if (!teamA || !teamB) continue;

          var eloA = teamNameToElo[teamA];
          var eloB = teamNameToElo[teamB];
          if (eloA == null) eloA = 1500;
          if (eloB == null) eloB = 1500;
          var p = eloWinProb(eloA, eloB);
          var winner = Math.random() < p ? teamA : teamB;
          var loser = winner === teamA ? teamB : teamA;
          stateMap[node.gid] = winner;
          var exitRound = r - 1;
          var loserIdx = teamIndexByName[loser];
          if (loserIdx != null) exitCounts[loserIdx][exitRound]++;
        }
      }
      var champ = stateMap[root.gid];
      if (champ) {
        var champIdx = teamIndexByName[champ];
        if (champIdx != null) exitCounts[champIdx].champ++;
      }
    }

    return exitCounts;
  }

  /**
   * Run nsims simulations. Returns raw counts for merging.
   * rounds: from buildRoundsFromTree(allNodes)
   */
  function runSimulations(teams, elos, nsims, rounds) {
    var n = teams.length;
    var exitCounts = [];
    for (var t = 0; t < n; t++) {
      var row = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, champ: 0 };
      exitCounts.push(row);
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
          var winner = Math.random() < p ? aId : bId;
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

  /**
   * Convert raw exitCounts to reachAtLeast, roundExit, winRoundLoseNext.
   */
  function buildOutputs(teams, exitCounts, nsims) {
    var reachAtLeast = {};
    var roundExit = {};
    var winRoundLoseNext = {};
    var n = teams.length;

    for (var t = 0; t < n; t++) {
      var name = teams[t];
      var counts = exitCounts[t];
      var r1 = counts[1] || 0, r2 = counts[2] || 0, r3 = counts[3] || 0;
      var r4 = counts[4] || 0, r5 = counts[5] || 0, r6 = counts[6] || 0;
      var champ = counts.champ || 0;

      roundExit[name] = [r1, r2, r3, r4, r5, r6, champ];

      var cum = nsims;
      reachAtLeast[name] = [
        Math.max(0, (cum -= r1) / nsims),
        Math.max(0, (cum -= r2) / nsims),
        Math.max(0, (cum -= r3) / nsims),
        Math.max(0, (cum -= r4) / nsims),
        Math.max(0, (cum -= r5) / nsims),
        Math.max(0, (cum -= r6) / nsims)
      ];

      winRoundLoseNext[name] = {
        r1: r2 / nsims,
        r2: r3 / nsims,
        r3: r4 / nsims,
        r4: r5 / nsims,
        r5: r6 / nsims,
        champ: champ / nsims
      };
    }

    return {
      reachAtLeast: reachAtLeast,
      roundExit: roundExit,
      winRoundLoseNext: winRoundLoseNext,
      nsims: nsims
    };
  }

  /**
   * Merge raw exitCounts from multiple workers.
   */
  function mergeExitCounts(teams, chunks) {
    var n = teams.length;
    var merged = [];
    for (var t = 0; t < n; t++) {
      var row = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, champ: 0 };
      for (var c = 0; c < chunks.length; c++) {
        var cnt = chunks[c][t];
        for (var r = 1; r <= 6; r++) row[r] += cnt[r] || 0;
        row.champ += cnt.champ || 0;
      }
      merged.push(row);
    }
    return merged;
  }

  /**
   * Run nsims using Web Workers. Returns a Promise that resolves to outputs.
   */
  function runWithWorkers(teams, elos, nsims, rounds, workerUrl, seed) {
    seed = seed || 12345;
    var nWorkers = Math.min(4, typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4);
    nWorkers = Math.min(nWorkers, Math.ceil(nsims / 100));
    var chunkSize = Math.ceil(nsims / nWorkers);
    var chunks = [];
    for (var w = 0; w < nWorkers; w++) {
      var size = w < nWorkers - 1 ? chunkSize : nsims - (nWorkers - 1) * chunkSize;
      chunks.push(size);
    }

    return new Promise(function(resolve, reject) {
      var results = [];
      var done = 0;
      var hasError = false;

      function onDone() {
        done++;
        if (done === nWorkers && !hasError) {
          var merged = mergeExitCounts(teams, results);
          var result = buildOutputs(teams, merged, nsims);
          resolve(result);
        }
      }

      for (var i = 0; i < nWorkers; i++) {
        try {
          var worker = new Worker(workerUrl);
          worker.onmessage = function(idx) {
            return function(msg) {
              results[idx] = msg.data.exitCounts;
              onDone();
            };
          }(i);
          worker.onerror = function() {
            hasError = true;
            reject(new Error('Worker failed'));
          };
          worker.postMessage({
            teams: teams,
            elos: elos,
            nsims: chunks[i],
            rounds: rounds,
            workerId: i,
            seed: seed
          });
        } catch (err) {
          hasError = true;
          reject(err);
          break;
        }
      }
    });
  }

  /**
   * Main entry: extract state from allNodes, run nsims, return outputs.
   * If bracket has advances, runs partial simulation from current state.
   * If callback provided and full bracket, runs async with workers; otherwise sync.
   */
  function run(allNodes, nsims, callback) {
    nsims = nsims || 100000;
    var state = extractPartialState(allNodes);
    if (!state) {
      var err = { error: 'Invalid bracket state: need 64 teams in round 1' };
      if (callback) callback(err);
      return err;
    }

    if (state.isPartial) {
      var exitCounts = runPartialSimulations(allNodes, state, nsims);
      var result = buildOutputs(state.teams, exitCounts, nsims);
      result.fromPartialState = true;
      if (callback) {
        setTimeout(function() { callback(null, result); }, 0);
        return undefined;
      }
      return result;
    }

    var rounds = buildRoundsFromTree(allNodes);
    if (!rounds) {
      var err = { error: 'Could not build round structure from bracket' };
      if (callback) callback(err);
      return err;
    }

    if (typeof callback === 'function') {
      var scripts = typeof document !== 'undefined' && document.getElementsByTagName('script');
      var workerUrl = 'simulation-worker.js';
      for (var s = 0; scripts && s < scripts.length; s++) {
        var src = scripts[s].src || '';
        if (src.indexOf('simulation.js') >= 0 && src.indexOf('worker') < 0) {
          workerUrl = src.replace(/simulation\.js$/, 'simulation-worker.js');
          break;
        }
      }
      runWithWorkers(state.teams, state.elos, nsims, rounds, workerUrl)
        .then(function(result) { callback(null, result); })
        .catch(function(err) { callback(err, null); });
      return undefined;
    }

    var exitCounts = runSimulations(state.teams, state.elos, nsims, rounds);
    return buildOutputs(state.teams, exitCounts, nsims);
  }

  global.BracketSimulation = {
    extractState: extractState,
    extractPartialState: extractPartialState,
    buildRoundsFromTree: buildRoundsFromTree,
    run: run,
    runSimulations: runSimulations,
    runPartialSimulations: runPartialSimulations,
    buildOutputs: buildOutputs,
    mergeExitCounts: mergeExitCounts
  };
})(typeof window !== 'undefined' ? window : this);
