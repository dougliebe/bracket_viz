/**
 * Flat bracket visualization - South above West on left, East above Midwest on right.
 * Click teams to advance them. Reuses logos and team logic from radial bracket.
 */

var LOGO_PATH = '../logos/';
var LOGO_SIZE = 20;   /* 1.5x smaller: 30 / 1.5 */
var CELL_WIDTH = 94;  /* 1.5x smaller: 140 / 1.5 */
var CELL_HEIGHT = 24; /* 1.5x smaller: 36 / 1.5 */

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

function render(root, allNodes, container, width, height) {
  d3.select(container).selectAll('*').remove();

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  var linesGroup = svg.append('g').attr('class', 'lines');
  var cellsGroup = svg.append('g').attr('class', 'cells');
  var labelsGroup = svg.append('g').attr('class', 'labels');

  function update() {
    linesGroup.selectAll('*').remove();
    cellsGroup.selectAll('*').remove();

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

    allNodes.forEach(function(node) {
      if (node.px == null || node.py == null) return;

      var team = node.team;
      var seed = node.round === 1 ? getSeedForGid(node.gid) : '';
      var isRound1 = node.round === 1;
      var label = team ? (seed ? seed + ' ' + team.name : team.name) : (seed ? seed + ' TBD' : '');
      if (!team && node.round > 1) return;

      var g = cellsGroup.append('g')
        .attr('class', 'team-cell')
        .attr('id', 'game' + node.gid)
        .attr('transform', 'translate(' + (node.px - CELL_WIDTH / 2) + ',' + (node.py - CELL_HEIGHT / 2) + ')')
        .style('cursor', team && node.parent ? 'pointer' : 'default');

      var rect = g.append('rect')
        .attr('width', CELL_WIDTH)
        .attr('height', CELL_HEIGHT)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('fill', '#fff')
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      if (team) {
        var img = g.append('image')
          .attr('xlink:href', LOGO_PATH + team.name + '.png')
          .attr('width', LOGO_SIZE)
          .attr('height', LOGO_SIZE)
          .on('error', function() {
            d3.select(this).remove();
            if (!isRound1) {
              g.append('text')
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

      if (isRound1) {
        g.append('text')
          .attr('x', team ? 28 : 6)
          .attr('y', CELL_HEIGHT / 2)
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('fill', '#333')
          .text(label);
      }

      if (team && node.parent) {
        g.on('click', function() {
          advanceTeam(node, update);
        });
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
  }

  update();
  return update;
}

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

  var root = buildtree(teams, size);
  setParents(root, null);
  var allNodes = collectNodes(root);
  computePositions(root, width, height);

  var currentUpdate = render(root, allNodes, '#bracket', width, height);

  window.addEventListener('resize', function onResize() {
    var d = getBracketDimensions();
    computePositions(root, d.width, d.height);
    currentUpdate = render(root, allNodes, '#bracket', d.width, d.height);
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
