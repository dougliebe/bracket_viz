/**
 * Flat bracket visualization - South above West on left, East above Midwest on right.
 * Click teams to advance them. Reuses logos and team logic from radial bracket.
 */

var LOGO_PATH = '/logos/';
var LOGO_SIZE = 20;   /* 1.5x smaller: 30 / 1.5 */
var CELL_WIDTH = 94;  /* 1.5x smaller: 140 / 1.5 */
var CELL_HEIGHT = 24; /* 1.5x smaller: 36 / 1.5 */

function eloWinProb(eloA, eloB) {
  if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) return null;
  if (eloB === 0) return 1;
  if (eloA === 0) return 0;
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function indexToLetter(index) {
  var result = '';
  index++;
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

var SIZE_CONFIG = {
  64: { startRound: 1, leafGids: [1, 64] },
  32: { startRound: 2, leafGids: [65, 96] },
  16: { startRound: 3, leafGids: [97, 112] },
  8: { startRound: 4, leafGids: [113, 120] },
  4: { startRound: 5, leafGids: [121, 124] }
};

var r_to_l = ['1', '16', '8', '9', '5', '12', '4', '13',
              '6', '11', '3', '14', '7', '10', '2', '15'];
var l_to_r = ['15', '2', '10', '7', '14', '3', '11', '6',
              '13', '4', '12', '5', '9', '8', '16', '1'];

function getSeedForGid(gid) {
  if (gid >= 1 && gid <= 16) return r_to_l[(gid - 1) % 16];
  if (gid >= 17 && gid <= 32) return r_to_l[(gid - 17) % 16];
  if (gid >= 33 && gid <= 48) return l_to_r[(gid - 33) % 16];
  if (gid >= 49 && gid <= 64) return l_to_r[(gid - 49) % 16];
  return '';
}

function regionFromGid(gid) {
  if ((gid >= 1 && gid <= 16) || (gid >= 65 && gid <= 72) ||
      (gid >= 97 && gid <= 100) ||
      (gid == 113 || gid == 114 || gid == 121)) return 'south';
  if ((gid >= 17 && gid <= 32) || (gid >= 73 && gid <= 80) ||
      (gid >= 101 && gid <= 104) ||
      (gid == 115 || gid == 116 || gid == 122)) return 'west';
  if ((gid >= 33 && gid <= 48) || (gid >= 81 && gid <= 88) ||
      (gid >= 105 && gid <= 108) ||
      (gid == 117 || gid == 118 || gid == 123)) return 'midwest';
  if ((gid >= 49 && gid <= 64) || (gid >= 89 && gid <= 96) ||
      (gid >= 109 && gid <= 112) ||
      (gid == 119 || gid == 120 || gid == 124)) return 'east';
  return null;
}

function flatToRslot(gid) {
  if (gid >= 49 && gid <= 64) return gid - 48;
  if (gid >= 33 && gid <= 48) return gid - 16;
  if (gid >= 1 && gid <= 16) return gid + 32;
  if (gid >= 17 && gid <= 32) return gid + 32;
  return gid;
}

function getGameDay(gid, round, size, node) {
  if (size !== 64) return null;
  if (round === 1) {
    /* Each R64 game has 2 gids (2 team slots). Both must return same day. Use gameIdx = floor((gid - base) / 2). */
    var reg = regionFromGid(gid);
    if (reg === 'east') {
      var gameIdx = Math.floor((gid - 49) / 2);
      var eastBracketGame = [8, 7, 6, 4, 3, 5, 2, 1];
      var bracketGame = eastBracketGame[gameIdx];
      var eastDayByBracket = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 2 };
      return eastDayByBracket[bracketGame] === 1 ? 'day1' : 'day2';
    }
    if (reg === 'midwest') {
      var gameIdx = Math.floor((gid - 33) / 2);
      var mwBracketGame = [8, 7, 6, 4, 3, 5, 2, 1];
      var bracketGame = mwBracketGame[gameIdx];
      var mwDayByBracket = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 1 };
      return mwDayByBracket[bracketGame] === 1 ? 'day1' : 'day2';
    }
    var rSlot = flatToRslot(gid);
    var gameIdx = Math.floor((rSlot - 1) / 2);
    var r64 = [2,2,2,2,1,1,2,2,1,1,1,1,2,2,1,1, 1,1,1,1,2,2,2,2,2,2,2,2,1,1,1,1];
    return r64[gameIdx] === 1 ? 'day1' : 'day2';
  }
  if (round === 2) {
    /* R32 game inherits day from its R64 children: if both R64 games are day 1, R32 is day 1 */
    if (node && node.children && node.children.length === 2) {
      var c0 = node.children[0], c1 = node.children[1];
      if (c0.round === 1 && c1.round === 1) {
        return getGameDay(c0.gid, 1, size);
      }
    }
    var r32 = [4,4,3,4,3,3,4,3,3,3,4,4,4,4,3,3];
    var gameIdx = gid - 65;
    return r32[Math.floor(gameIdx / 2)] === 3 ? 'day1' : 'day2';
  }
  if (round === 3) {
    var reg = regionFromGid(gid);
    if (!reg) return null;
    var dayByRegion = { south: 'day2', west: 'day1', midwest: 'day2', east: 'day1' };
    return dayByRegion[reg] || null;
  }
  return null;
}

function buildtree(teams, size) {
  size = size || 64;
  var config = SIZE_CONFIG[size] || SIZE_CONFIG[64];
  var startRound = config.startRound;
  var leafMin = config.leafGids[0];
  var leafMax = config.leafGids[1];

  var round = 7;
  var gid = 127;

  var root = {
    gid: gid--,
    region: 'south-west-east-midwest',
    round: round--,
    children: []
  };

  var roundgames = { 7: [root] };

  function region(gid) {
    if ((gid >= 1 && gid <= 16) || (gid >= 65 && gid <= 72) ||
        (gid >= 97 && gid <= 100) ||
        (gid == 113 || gid == 114 || gid == 121)) return 'south';
    if ((gid >= 17 && gid <= 32) || (gid >= 73 && gid <= 80) ||
        (gid >= 101 && gid <= 104) ||
        (gid == 115 || gid == 116 || gid == 122)) return 'west';
    if ((gid >= 33 && gid <= 48) || (gid >= 81 && gid <= 88) ||
        (gid >= 105 && gid <= 108) ||
        (gid == 117 || gid == 118 || gid == 123)) return 'midwest';
    if ((gid >= 49 && gid <= 64) || (gid >= 89 && gid <= 96) ||
        (gid >= 109 && gid <= 112) ||
        (gid == 119 || gid == 120 || gid == 124)) return 'east';
    if (gid == 125) return 'south-west';
    if (gid == 126) return 'east-midwest';
    if (gid == 127) return 'south-west-east-midwest';
    throw new Error('undefined region for gid ' + gid);
  }

  while (round >= startRound) {
    roundgames[round] = [];
    for (var i = 0; i < roundgames[round + 1].length; i++) {
      var left = { gid: gid, region: region(gid), round: round, children: [] };
      gid--;
      var right = { gid: gid, region: region(gid), round: round, children: [] };
      gid--;
      roundgames[round + 1][i].children.push(left);
      roundgames[round + 1][i].children.push(right);
      roundgames[round].push(left);
      roundgames[round].push(right);
    }
    round--;
  }

  function normalizeTeam(t) {
    if (typeof t === 'string') return { name: t };
    if (t && t.name) return t;
    return { name: 'Unknown' };
  }

  var leafGames = roundgames[startRound] || [];

  function findgame(leafList, gid) {
    for (var i = 0; i < leafList.length; i++) {
      if (leafList[i].gid === gid) return leafList[i];
    }
    return null;
  }

  if (size === 64 && teams && teams.south) {
    var regions = ['south', 'west', 'midwest', 'east'];
    var gid = 1;
    for (var r = 0; r < regions.length; r++) {
      var reg = regions[r];
      var order = (reg === 'south' || reg === 'west') ? r_to_l : l_to_r;
      for (var s = 0; s < order.length; s++) {
        var seed = order[s];
        var game = findgame(leafGames, gid);
        if (game) {
          var raw = teams[reg] && teams[reg][seed];
          game.team = normalizeTeam(raw || indexToLetter(gid - 1));
        }
        gid++;
      }
    }
  } else {
    for (var i = 0; i < leafGames.length; i++) {
      var game = leafGames[i];
      var raw = teams && teams[game.gid];
      game.team = normalizeTeam(raw || indexToLetter(i));
    }
  }

  return root;
}

function setParents(node, parent) {
  node.parent = parent;
  (node.children || []).forEach(function(c) { setParents(c, node); });
}

function collectNodes(root) {
  var nodes = [];
  function visit(n) {
    if (!n) return;
    nodes.push(n);
    (n.children || []).forEach(visit);
  }
  visit(root);
  return nodes;
}

function isLeftSide(gid) {
  var r = (gid >= 1 && gid <= 16) || (gid >= 17 && gid <= 32) ||
          (gid >= 65 && gid <= 80) || (gid >= 97 && gid <= 104) ||
          (gid >= 113 && gid <= 116) || (gid >= 121 && gid <= 122) || gid == 125;
  return r;
}

function computePositions(root, width, height) {
  var pad = 12;
  var centerX = width / 2;
  var leftEdge = pad + 80;
  var rightEdge = width - pad - 80;

  var regionBands = {
    south: { y0: 0.03, y1: 0.47 },
    west: { y0: 0.53, y1: 0.97 },
    east: { y0: 0.03, y1: 0.47 },
    midwest: { y0: 0.53, y1: 0.97 }
  };

  function roundToX(round, left) {
    if (round === 1) return left ? leftEdge : rightEdge;
    if (round === 7) return centerX;
    var t = (round - 1) / 6;
    return left ? leftEdge + t * (centerX - leftEdge) : rightEdge - t * (rightEdge - centerX);
  }

  function slotToY(slot, totalSlots, y0, y1) {
    var bandHeight = (y1 - y0) * height;
    return pad + y0 * height + (slot + 0.5) / totalSlots * bandHeight;
  }

  var leafGamesByRegion = { south: [], west: [], east: [], midwest: [] };
  var leafGames = collectNodes(root).filter(function(n) { return n.round === 1; });
  leafGames.forEach(function(g) {
    var r = g.region;
    if (leafGamesByRegion[r]) leafGamesByRegion[r].push(g);
  });

  leafGamesByRegion.south.sort(function(a, b) { return a.gid - b.gid; });
  leafGamesByRegion.west.sort(function(a, b) { return a.gid - b.gid; });
  leafGamesByRegion.east.sort(function(a, b) { return a.gid - b.gid; });
  leafGamesByRegion.midwest.sort(function(a, b) { return a.gid - b.gid; });

  leafGamesByRegion.south.forEach(function(g, i) {
    g.px = roundToX(1, true);
    g.py = slotToY(i, 16, regionBands.south.y0, regionBands.south.y1);
  });
  leafGamesByRegion.west.forEach(function(g, i) {
    g.px = roundToX(1, true);
    g.py = slotToY(i, 16, regionBands.west.y0, regionBands.west.y1);
  });
  leafGamesByRegion.east.forEach(function(g, i) {
    g.px = roundToX(1, false);
    g.py = slotToY(15 - i, 16, regionBands.east.y0, regionBands.east.y1);
  });
  leafGamesByRegion.midwest.forEach(function(g, i) {
    g.px = roundToX(1, false);
    g.py = slotToY(15 - i, 16, regionBands.midwest.y0, regionBands.midwest.y1);
  });

  var nodesByRound = {};
  collectNodes(root).forEach(function(n) {
    if (!nodesByRound[n.round]) nodesByRound[n.round] = [];
    nodesByRound[n.round].push(n);
  });

  for (var r = 2; r <= 7; r++) {
    (nodesByRound[r] || []).forEach(function(node) {
      var children = node.children || [];
      if (children.length === 2) {
        node.px = roundToX(r, isLeftSide(node.gid));
        node.py = (children[0].py + children[1].py) / 2;
      }
    });
  }

  root.px = centerX;
  root.py = height / 2;
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

function getSibling(node) {
  if (!node || !node.parent) return null;
  var children = node.parent.children || [];
  return children[0] === node ? children[1] : children[0];
}

function clipConflictingSelections(advancingGame) {
  var parent = advancingGame.parent;
  if (!parent) return;
  var sibling = getSibling(advancingGame);
  var losingTeams = getTeamsInSubtree(sibling);

  var node = parent;
  while (node) {
    if (node.team && losingTeams[node.team.name]) {
      node.team = undefined;
    }
    node = node.parent;
  }
}

function advanceTeam(game, updateFn) {
  if (!game || !game.team || !game.parent) return;
  var parent = game.parent;
  var isResetting = parent.team && parent.team.name === game.team.name;
  if (isResetting) {
    var node = parent;
    while (node) {
      if (node.team && node.team.name === game.team.name) {
        node.team = undefined;
      }
      node = node.parent;
    }
  } else {
    clipConflictingSelections(game);
    parent.team = game.team;
    var node = parent.parent;
    while (node) {
      if (node.team && node.team.name === game.team.name) {
        node.team = undefined;
      }
      node = node.parent;
    }
  }
  if (updateFn) updateFn();
}

function loadTeams(data) {
  var teams = {};
  var regions = ['south', 'west', 'midwest', 'east'];
  for (var r = 0; r < regions.length; r++) {
    var reg = regions[r];
    teams[reg] = {};
    for (var s = 1; s <= 16; s++) {
      var key = String(s);
      var val = data[reg] && data[reg][key];
      teams[reg][key] = (typeof val === 'object' && val.name) ? val : (val || indexToLetter(r * 16 + s - 1));
    }
  }
  return teams;
}

/**
 * Serialize bracket state for export.
 * Returns { version, advances, grayed } where advances is { gid: teamName }.
 */
function serializeState(root, grayedTeams) {
  var advances = {};
  collectNodes(root).forEach(function(node) {
    if (node.children && node.children.length > 0 && node.team && node.team.name) {
      advances[node.gid] = node.team.name;
    }
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    advances: advances,
    grayed: Array.from(grayedTeams || [])
  };
}

/**
 * Build map of team name -> team object from leaf nodes.
 */
function buildTeamNameToTeam(allNodes) {
  var map = {};
  allNodes.forEach(function(n) {
    if (n.round === 1 && n.team && n.team.name) {
      map[n.team.name] = n.team;
    }
  });
  return map;
}

/**
 * Validate imported state. Returns { valid: boolean, error?: string }.
 */
function validateState(state, allNodes) {
  if (!state || typeof state !== 'object') {
    return { valid: false, error: 'Invalid state: not an object' };
  }
  var advances = state.advances;
  var grayed = state.grayed;
  if (!advances || typeof advances !== 'object') {
    return { valid: false, error: 'Invalid state: missing or invalid advances' };
  }
  if (state.version !== 1 && state.version !== undefined) {
    return { valid: false, error: 'Unsupported state version' };
  }
  if (grayed != null && !Array.isArray(grayed)) {
    return { valid: false, error: 'Invalid state: grayed must be an array' };
  }
  var validGids = {};
  allNodes.forEach(function(n) { validGids[n.gid] = true; });
  for (var gid in advances) {
    var g = parseInt(gid, 10);
    if (isNaN(g) || !validGids[g]) {
      return { valid: false, error: 'Invalid state: unknown gid ' + gid };
    }
    if (typeof advances[gid] !== 'string') {
      return { valid: false, error: 'Invalid state: advances values must be team names' };
    }
  }
  return { valid: true };
}

/**
 * Apply imported state to bracket. Call currentUpdate() after.
 */
function applyState(root, grayedTeams, state, allNodes) {
  var valid = validateState(state, allNodes);
  if (!valid.valid) return valid;

  function clearWinners(node) {
    if (node.children && node.children.length > 0) node.team = undefined;
    (node.children || []).forEach(clearWinners);
  }
  clearWinners(root);

  grayedTeams.clear();
  if (state.grayed && Array.isArray(state.grayed)) {
    state.grayed.forEach(function(name) {
      if (typeof name === 'string') grayedTeams.add(name);
    });
  }

  var teamNameToTeam = buildTeamNameToTeam(allNodes);
  var gidToNode = {};
  allNodes.forEach(function(n) { gidToNode[n.gid] = n; });

  var rounds = [2, 3, 4, 5, 6, 7];
  rounds.forEach(function(r) {
    allNodes.filter(function(n) { return n.round === r; }).forEach(function(node) {
      var teamName = state.advances[node.gid];
      if (teamName) {
        var team = teamNameToTeam[teamName] || { name: teamName };
        node.team = team;
      }
    });
  });

  return { valid: true };
}

function isFrontierMatchup(node, size) {
  var config = SIZE_CONFIG[size] || SIZE_CONFIG[64];
  if (!node || !node.children || node.children.length !== 2) return false;
  if (node.round <= config.startRound) return false;
  if (node.team) return false;
  return node.children[0].team && node.children[1].team;
}

function isDeepestAdvancedNode(node) {
  if (!node || !node.team) return false;
  if (!node.parent) return true;
  return !node.parent.team || node.parent.team.name !== node.team.name;
}

function buildTeamNameToElo(allNodes) {
  var map = {};
  allNodes.forEach(function(n) {
    if (n.team && n.team.name && n.team.elo != null && Number.isFinite(n.team.elo)) {
      map[n.team.name] = n.team.elo;
    }
  });
  return map;
}

var ROUND_LABELS = ['Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Reach championship', 'Win it all'];

function showSimTooltip(teamName, node, evt) {
  var tooltip = document.getElementById('simTooltip');
  if (!tooltip) return;
  var results = window.bracketSimResults;
  if (!results || !results.reachAtLeast || !results.reachAtLeast[teamName]) return;
  var ra = results.reachAtLeast[teamName];
  var lines = [teamName];
  for (var i = 0; i < ra.length && i < ROUND_LABELS.length; i++) {
    lines.push(ROUND_LABELS[i] + ': ' + Math.round(ra[i] * 100) + '%');
  }
  if (node && isDeepestAdvancedNode(node) && results.winRoundLoseNext && results.winRoundLoseNext[teamName]) {
    var wln = results.winRoundLoseNext[teamName];
    var pLoseNext = null;
    if (node.round >= 1 && node.round <= 5 && wln['r' + node.round] != null) {
      pLoseNext = wln['r' + node.round];
    } else if (node.round === 6 && ra[5] != null) {
      pLoseNext = Math.max(0, ra[5] - (wln.champ || 0));
    }
    if (pLoseNext != null) {
      lines.push('P(lose next): ' + Math.round(pLoseNext * 100) + '%');
    }
  }
  tooltip.innerHTML = lines.join('<br>');
  tooltip.classList.add('visible');
  var x = (evt && evt.clientX != null) ? evt.clientX : 0;
  var y = (evt && evt.clientY != null) ? evt.clientY : 0;
  var offset = 12;
  var left = x + offset;
  var top = y + offset;
  if (left + 220 > window.innerWidth) left = x - 220 - offset;
  if (top + 120 > window.innerHeight) top = y - 120 - offset;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function hideSimTooltip() {
  var tooltip = document.getElementById('simTooltip');
  if (tooltip) tooltip.classList.remove('visible');
}

function render(root, allNodes, container, width, height, grayedTeams, size) {
  grayedTeams = grayedTeams || new Set();
  size = size || 64;
  d3.select(container).selectAll('*').remove();

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  var dayBgGroup = svg.append('g').attr('class', 'day-backgrounds');
  var linesGroup = svg.append('g').attr('class', 'lines');
  var cellsGroup = svg.append('g').attr('class', 'cells');
  var labelsGroup = svg.append('g').attr('class', 'labels');
  var legendGroup = svg.append('g').attr('class', 'day-legend');

  var DAY_COLORS = { day1: '#e0f2fe', day2: '#fef3c7' };

  function getCellDayColor(node) {
    if (size !== 64) return null;
    var day = getGameDay(node.gid, node.round, size, node);
    return day ? DAY_COLORS[day] : null;
  }

  function updateGrayState() {
    cellsGroup.selectAll('g.team-cell').each(function() {
      var g = d3.select(this);
      var gid = parseInt(g.attr('id').replace('game', ''), 10);
      var node = allNodes.filter(function(n) { return n.gid === gid; })[0];
      if (!node) return;
      var baseFill = getCellDayColor(node) || '#fff';
      if (node.team) {
        var isGrayed = grayedTeams.has(node.team.name);
        g.select('rect').attr('fill', isGrayed ? '#b4b4b4' : baseFill);
      } else if (isFrontierMatchup(node, size)) {
        g.selectAll('g.frontier-logo').each(function() {
          var teamName = d3.select(this).attr('data-team');
          var isGrayed = grayedTeams.has(teamName);
          d3.select(this)
            .style('opacity', isGrayed ? '0.4' : '1')
            .style('filter', isGrayed ? 'grayscale(100%)' : 'none');
        });
      }
    });
  }

  function update() {
    linesGroup.selectAll('*').remove();

    allNodes.forEach(function(node) {
      var children = node.children || [];
      if (children.length !== 2) return;
      var c1 = children[0], c2 = children[1];
      if (c1.px == null || c2.px == null || node.px == null) return;

      var x1 = c1.px, y1 = c1.py;
      var x2 = c2.px, y2 = c2.py;
      var xp = node.px, yp = node.py;
      var yMid = (y1 + y2) / 2;
      var xMid = (x1 + x2) / 2;

      linesGroup.append('line')
        .attr('x1', x1).attr('y1', y1).attr('x2', x1).attr('y2', yMid)
        .attr('stroke', '#333').attr('stroke-width', 1);
      linesGroup.append('line')
        .attr('x1', x2).attr('y1', y2).attr('x2', x2).attr('y2', yMid)
        .attr('stroke', '#333').attr('stroke-width', 1);
      linesGroup.append('line')
        .attr('x1', x1).attr('y1', yMid).attr('x2', x2).attr('y2', yMid)
        .attr('stroke', '#333').attr('stroke-width', 1);
      linesGroup.append('line')
        .attr('x1', xMid).attr('y1', yMid).attr('x2', xp).attr('y2', yp)
        .attr('stroke', '#333').attr('stroke-width', 1);
    });

    var cellNodes = allNodes.filter(function(node) {
      return node.px != null && node.py != null &&
        (node.team || node.round === 1 || isFrontierMatchup(node, size));
    });
    var cells = cellsGroup.selectAll('g.team-cell').data(cellNodes, function(d) { return d.gid; });

    var teamNameToElo = buildTeamNameToElo(allNodes);
    var hasElo = Object.keys(teamNameToElo).length > 0;

    function addCellContent(g, node) {
      var team = node.team;
      var isRound1 = node.round === 1;
      var isFrontier = hasElo && isFrontierMatchup(node, size);

      if (isFrontier) {
        var c0 = node.children[0].team;
        var c1 = node.children[1].team;
        var elo0 = teamNameToElo[c0.name];
        var elo1 = teamNameToElo[c1.name];
        var p0 = (elo0 != null && elo1 != null) ? eloWinProb(elo0, elo1) : null;
        var p1 = (elo0 != null && elo1 != null) ? eloWinProb(elo1, elo0) : null;
        var smallLogo = 12;
        var pad = 6;
        [0, 1].forEach(function(slot) {
          var t = slot === 0 ? c0 : c1;
          var x = slot === 0 ? pad : CELL_WIDTH - pad - smallLogo;
          var imgWrap = g.append('g')
            .attr('class', 'frontier-logo')
            .attr('data-team', t.name)
            .attr('transform', 'translate(' + x + ', 2)')
            .style('cursor', 'pointer');
          imgWrap.style('opacity', grayedTeams.has(t.name) ? '0.4' : '1');
          imgWrap.style('filter', grayedTeams.has(t.name) ? 'grayscale(100%)' : 'none');
          imgWrap.on('mouseenter', function() {
            showSimTooltip(t.name, node.children[slot], d3.event);
          });
          imgWrap.on('mouseleave', hideSimTooltip);
          var img = imgWrap.append('image')
            .attr('xlink:href', LOGO_PATH + t.name + '.png')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', smallLogo)
            .attr('height', smallLogo)
            .on('error', function() {
              d3.select(this).remove();
            });
        });
        if (p0 != null && p1 != null) {
          g.append('text')
            .attr('class', 'win-prob')
            .attr('x', CELL_WIDTH / 2)
            .attr('y', CELL_HEIGHT / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '11px')
            .style('fill', '#333')
            .text(Math.round(p0 * 100) + '% – ' + Math.round(p1 * 100) + '%');
        }
        return;
      }

      if (!team) return;
      var img = g.append('image')
        .attr('xlink:href', LOGO_PATH + team.name + '.png')
        .attr('width', LOGO_SIZE)
        .attr('height', LOGO_SIZE)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .on('error', function() {
          d3.select(this).remove();
          if (!isRound1) {
            g.append('text')
              .attr('class', 'logo-fallback')
              .attr('x', CELL_WIDTH / 2)
              .attr('y', CELL_HEIGHT / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .style('font-size', '9px')
              .style('fill', '#333')
              .text(team.name);
          }
        });
      if (isRound1) {
        img.attr('x', 2).attr('y', 2);
      } else {
        img.attr('x', (CELL_WIDTH - LOGO_SIZE) / 2).attr('y', (CELL_HEIGHT - LOGO_SIZE) / 2);
      }
    }

    var cellEnter = cells.enter().append('g')
      .attr('class', 'team-cell')
      .attr('id', function(d) { return 'game' + d.gid; })
      .attr('transform', function(d) { return 'translate(' + (d.px - CELL_WIDTH / 2) + ',' + (d.py - CELL_HEIGHT / 2) + ')'; })
      .style('cursor', function(d) { return d.team ? 'pointer' : 'default'; });

    cellEnter.append('rect')
      .attr('width', CELL_WIDTH)
      .attr('height', CELL_HEIGHT)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', function(d) {
        if (d.team && grayedTeams.has(d.team.name)) return '#b4b4b4';
        return getCellDayColor(d) || '#ffffff';
      })
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    cellEnter.each(function(node) {
      var g = d3.select(this);
      addCellContent(g, node);
      var seed = node.round === 1 ? getSeedForGid(node.gid) : '';
      var isFrontier = isFrontierMatchup(node, size);
      var label = !isFrontier && node.team ? (seed ? seed + ' ' + node.team.name : node.team.name) : (seed ? seed + ' TBD' : '');
      if (node.round === 1) {
        g.append('text')
          .attr('class', 'seed-label')
          .attr('x', node.team ? 28 : 6)
          .attr('y', CELL_HEIGHT / 2)
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('fill', '#333')
          .text(label);
      }
      if (node.team) {
        g.on('click', function() {
          if (d3.event.ctrlKey || d3.event.metaKey) {
            if (grayedTeams.has(node.team.name)) {
              grayedTeams.delete(node.team.name);
            } else {
              grayedTeams.add(node.team.name);
            }
            updateGrayState();
          } else if (node.parent) {
            advanceTeam(node, update);
          }
        });
        g.on('mouseenter', function() { showSimTooltip(node.team.name, node, d3.event); });
        g.on('mouseleave', hideSimTooltip);
      }
    });

    cells.exit().remove();

    cells
      .attr('transform', function(d) { return 'translate(' + (d.px - CELL_WIDTH / 2) + ',' + (d.py - CELL_HEIGHT / 2) + ')'; })
      .style('cursor', function(d) { return d.team ? 'pointer' : 'default'; });

    cells.select('rect').attr('fill', function(d) {
      if (d.team && grayedTeams.has(d.team.name)) return '#b4b4b4';
      return getCellDayColor(d) || '#fff';
    });

    cells.each(function(node) {
      var g = d3.select(this);
      g.on('click', null);
      g.on('mouseenter', null);
      g.on('mouseleave', null);
      if (node.team) {
        g.on('click', function() {
          if (d3.event.ctrlKey || d3.event.metaKey) {
            if (grayedTeams.has(node.team.name)) {
              grayedTeams.delete(node.team.name);
            } else {
              grayedTeams.add(node.team.name);
            }
            updateGrayState();
          } else if (node.parent) {
            advanceTeam(node, update);
          }
        });
        g.on('mouseenter', function() { showSimTooltip(node.team.name, node, d3.event); });
        g.on('mouseleave', hideSimTooltip);
      }
    });

    cells.each(function(node) {
      var g = d3.select(this);
      var isFrontier = isFrontierMatchup(node, size);
      var cacheKey = isFrontier && node.children && node.children.length === 2
        ? 'frontier:' + (node.children[0].team ? node.children[0].team.name : '') + ':' + (node.children[1].team ? node.children[1].team.name : '')
        : (node.team ? node.team.name : null);
      if (node._lastCellTeam !== cacheKey) {
        node._lastCellTeam = cacheKey;
        g.selectAll('image, text.logo-fallback, text.win-prob, g.frontier-logo').remove();
        if (node.team || isFrontier) {
          addCellContent(g, node);
        }
        if (node.round === 1) {
          var seed = getSeedForGid(node.gid);
          var label = !isFrontier && node.team ? (seed ? seed + ' ' + node.team.name : node.team.name) : (seed ? seed + ' TBD' : '');
          var labelEl = g.select('text.seed-label');
          if (labelEl.empty()) {
            g.append('text')
              .attr('class', 'seed-label')
              .attr('x', node.team ? 28 : 6)
              .attr('y', CELL_HEIGHT / 2)
              .attr('dy', '0.35em')
              .style('font-size', '10px')
              .style('fill', '#333')
              .text(label);
          } else {
            labelEl.attr('x', node.team ? 28 : 6).text(label);
          }
        }
      }
    });

    labelsGroup.selectAll('*').remove();
    var rightEdge = width - 12 - 80;
    var labelOffset = CELL_WIDTH / 2 + 25;
    var labelData = [
      { text: 'South', x: 14, y: height * 0.25, rot: -90 },
      { text: 'West', x: 14, y: height * 0.75, rot: -90 },
      { text: 'East', x: rightEdge + labelOffset, y: height * 0.25, rot: 90 },
      { text: 'Midwest', x: rightEdge + labelOffset, y: height * 0.75, rot: 90 }
    ];
    labelsGroup.selectAll('text.region').data(labelData).enter()
      .append('text')
      .attr('class', 'region')
      .attr('x', function(d) { return d.x; })
      .attr('y', function(d) { return d.y; })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('transform', function(d) { return 'rotate(' + d.rot + ', ' + d.x + ', ' + d.y + ')'; })
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#555')
      .text(function(d) { return d.text; });

    legendGroup.selectAll('*').remove();
    if (size === 64) {
      var legendTop = height - LEGEND_HEIGHT;
      var legendCenterX = width / 2;
      var boxSize = 18;
      var boxGap = 8;
      var rowHeight = 28;
      var labelWidth = 90;
      var totalLegendWidth = labelWidth + boxGap + boxSize + boxGap + boxSize;
      var legendLeft = legendCenterX - totalLegendWidth / 2;
      var legendRows = [
        { label: 'Round of 64', y: legendTop + 22 },
        { label: 'Round of 32', y: legendTop + 22 + rowHeight },
        { label: 'Sweet 16', y: legendTop + 22 + rowHeight * 2 }
      ];
      legendRows.forEach(function(row) {
        var day1X = legendLeft + labelWidth + boxGap;
        var day2X = day1X + boxSize + boxGap;
        legendGroup.append('text')
          .attr('class', 'legend-label')
          .attr('x', legendLeft + labelWidth)
          .attr('y', row.y)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '12px')
          .style('fill', '#333')
          .text(row.label);
        legendGroup.append('rect')
          .attr('class', 'legend-box legend-day1')
          .attr('x', day1X)
          .attr('y', row.y - boxSize / 2)
          .attr('width', boxSize)
          .attr('height', boxSize)
          .attr('rx', 2)
          .attr('fill', DAY_COLORS.day1)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        legendGroup.append('rect')
          .attr('class', 'legend-box legend-day2')
          .attr('x', day2X)
          .attr('y', row.y - boxSize / 2)
          .attr('width', boxSize)
          .attr('height', boxSize)
          .attr('rx', 2)
          .attr('fill', DAY_COLORS.day2)
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
      });
      legendGroup.append('text')
        .attr('x', legendLeft + labelWidth + boxGap + boxSize / 2)
        .attr('y', legendTop + 8)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#555')
        .text('Day 1');
      legendGroup.append('text')
        .attr('x', legendLeft + labelWidth + boxGap + boxSize + boxGap + boxSize / 2)
        .attr('y', legendTop + 8)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#555')
        .text('Day 2');
    }
  }

  update();
  return update;
}

var LEGEND_HEIGHT = 100;

function getBracketDimensions() {
  var controlsHeight = 52;
  return {
    width: Math.max(1200, window.innerWidth),
    height: Math.max(800, window.innerHeight - controlsHeight)
  };
}

function main(teams, size) {
  size = size || 64;
  var dims = getBracketDimensions();
  var width = dims.width;
  var height = dims.height;
  var contentHeight = height - (size === 64 ? LEGEND_HEIGHT : 0);
  var grayedTeams = new Set();

  var root = buildtree(teams, size);
  setParents(root, null);
  var allNodes = collectNodes(root);
  computePositions(root, width, contentHeight);

  var currentUpdate = render(root, allNodes, '#bracket', width, height, grayedTeams, size);

  window.addEventListener('resize', function onResize() {
    var d = getBracketDimensions();
    var ch = d.height - (size === 64 ? LEGEND_HEIGHT : 0);
    computePositions(root, d.width, ch);
    currentUpdate = render(root, allNodes, '#bracket', d.width, d.height, grayedTeams, size);
  });

  window.bracketRandom = function() {
    window.bracketReset();
    var nodesWithChildren = allNodes.filter(function(n) {
      return n.children && n.children.length > 0;
    });
    nodesWithChildren.sort(function(a, b) { return a.round - b.round; });
    nodesWithChildren.forEach(function(node) {
      var idx = Math.random() < 0.5 ? 0 : 1;
      node.team = node.children[idx].team;
    });
    currentUpdate();
  };

  window.bracketReset = function() {
    grayedTeams.clear();
    function clearWinners(node) {
      var hasChildren = node.children && node.children.length > 0;
      if (hasChildren) node.team = undefined;
      if (node.children) {
        node.children.forEach(clearWinners);
      }
    }
    clearWinners(root);
    currentUpdate();
  };

  window.bracketExportState = function() {
    return serializeState(root, grayedTeams);
  };
  window.bracketImportState = function(state) {
    var result = applyState(root, grayedTeams, state, allNodes);
    if (result.valid) {
      currentUpdate();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  var simulateBtn = document.getElementById('simulateBtn');
  var simulateStatus = document.getElementById('simulateStatus');
  if (simulateBtn && simulateStatus) {
    simulateBtn.onclick = function() {
      simulateBtn.disabled = true;
      simulateStatus.textContent = 'Running…';
      var done = function(result) {
        if (result && result.error) {
          simulateStatus.textContent = result.error;
        } else {
          window.bracketSimResults = result;
          var msg = 'Done (' + (result ? result.nsims : 0) + ' sims';
          if (result && result.fromPartialState) msg += ', from current bracket';
          msg += ')';
          simulateStatus.textContent = msg;
        }
        simulateBtn.disabled = false;
      };
      window.BracketSimulation.run(allNodes, 100000, function(err, result) {
        if (err) {
          simulateStatus.textContent = 'Workers failed, running on main thread…';
          setTimeout(function() {
            done(window.BracketSimulation.run(allNodes, 100000));
          }, 0);
        } else {
          done(result);
        }
      });
    };
  }
}

var fullTeams = null;

queue()
  .defer(d3.json, '../bracket.json')
  .await(function(err, data) {
    if (err || !data) {
      d3.json('../teams.json', function(e2, t) {
        fullTeams = t ? loadTeams(t) : loadTeams({});
        main(fullTeams, 64);
      });
    } else {
      fullTeams = (data.south && typeof data.south['1'] === 'object' && data.south['1'].name)
        ? data : loadTeams(data);
      main(fullTeams, 64);
    }
  });

document.getElementById('resetBtn').onclick = function() {
  if (window.bracketReset) window.bracketReset();
};

document.getElementById('randomBtn').onclick = function() {
  if (window.bracketRandom) window.bracketRandom();
};

(function setupExportImport() {
  var exportBtn = document.getElementById('exportBtn');
  var importBtn = document.getElementById('importBtn');
  var importModal = document.getElementById('importModal');
  var importPasteArea = document.getElementById('importPasteArea');
  var importFileInput = document.getElementById('importFileInput');
  var importError = document.getElementById('importError');
  var importApplyBtn = document.getElementById('importApplyBtn');
  var importCancelBtn = document.getElementById('importCancelBtn');

  if (exportBtn) {
    exportBtn.onclick = function() {
      if (!window.bracketExportState) return;
      var state = window.bracketExportState();
      var json = JSON.stringify(state, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bracket-state.json';
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  function tryImport(jsonStr) {
    var errEl = importError;
    errEl.style.display = 'none';
    errEl.textContent = '';
    try {
      var state = JSON.parse(jsonStr);
      if (!window.bracketImportState) {
        errEl.textContent = 'Bracket not ready yet.';
        errEl.style.display = 'block';
        return;
      }
      var result = window.bracketImportState(state);
      if (result.success) {
        importModal.classList.remove('visible');
        importPasteArea.value = '';
        importFileInput.value = '';
      } else {
        errEl.textContent = result.error || 'Import failed.';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Invalid JSON: ' + (e.message || String(e));
      errEl.style.display = 'block';
    }
  }

  if (importBtn) {
    importBtn.onclick = function() {
      importModal.classList.add('visible');
      importError.style.display = 'none';
      importPasteArea.value = '';
      importFileInput.value = '';
      importPasteArea.focus();
    };
  }

  if (importFileInput) {
    importFileInput.onchange = function() {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        importPasteArea.value = reader.result || '';
      };
      reader.readAsText(file);
    };
  }

  if (importApplyBtn) {
    importApplyBtn.onclick = function() {
      var text = importPasteArea.value.trim();
      if (!text) {
        importError.textContent = 'Paste JSON or select a file.';
        importError.style.display = 'block';
        return;
      }
      tryImport(text);
    };
  }

  if (importCancelBtn) {
    importCancelBtn.onclick = function() {
      importModal.classList.remove('visible');
      importPasteArea.value = '';
      importFileInput.value = '';
      importError.style.display = 'none';
    };
  }

  if (importModal) {
    importModal.onclick = function(evt) {
      if (evt.target === importModal) {
        importCancelBtn && importCancelBtn.click();
      }
    };
  }
})();
