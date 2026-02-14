/**
 * Interactive radial NCAA bracket - click teams to advance them.
 * Based on roundbracket by Bill Mill (https://github.com/llimllib/roundbracket)
 * All matchups treated as 50/50 - no odds/probabilities.
 */

// Default team color for path styling (when no logo color available)
var DEFAULT_TEAM_COLOR = [66, 133, 244]; // blue

function buildtree(teams) {
  var round = 7;
  var gid = 127;

  var root = {
    gid: gid--,
    region: "south-west-east-midwest",
    round: round--,
    children: [],
  };

  var roundgames = {7: [root]};

  function region(gid) {
    if ((gid >= 1 && gid <= 16) || (gid >= 65 && gid <= 72) ||
        (gid >= 97 && gid <= 100) ||
        (gid == 113 || gid == 114 || gid == 121)) { return "south"; }
    if ((gid >= 17 && gid <= 32) || (gid >= 73 && gid <= 80) ||
        (gid >= 101 && gid <= 104) ||
        (gid == 115 || gid == 116 || gid == 122)) { return "west"; }
    if ((gid >= 33 && gid <= 48) || (gid >= 81 && gid <= 88) ||
        (gid >= 105 && gid <= 108) ||
        (gid == 117 || gid == 118 || gid == 123)) { return "midwest"; }
    if ((gid >= 49 && gid <= 64) || (gid >= 89 && gid <= 96) ||
        (gid >= 109 && gid <= 112) ||
        (gid == 119 || gid == 120 || gid == 124)) { return "east"; }
    if (gid == 125) { return "south-west"; }
    if (gid == 126) { return "east-midwest"; }
    if (gid == 127) { return "south-west-east-midwest"; }
    throw new Error("undefined region for gid " + gid);
  }

  while (round > 0) {
    roundgames[round] = [];
    for (var i=0; i < roundgames[round+1].length; i++) {
      var left = { gid: gid, region: region(gid), round: round, children: [] };
      gid--;
      var right = { gid: gid, region: region(gid), round: round, children: [] };
      gid--;
      roundgames[round+1][i].children.push(left);
      roundgames[round+1][i].children.push(right);
      roundgames[round].push(left);
      roundgames[round].push(right);
    }
    round--;
  }

  var r_to_l = ['1', '16', '8', '9', '5', '12', '4', '13',
                '6', '11', '3', '14', '7', '10', '2', '15'];
  var l_to_r = ["15", "2", "10", "7", "14", "3", "11", "6",
                "13", "4", "12", "5", "9", "8", "16", "1"];
  var regions = ["south", "west", "midwest", "east"];

  function findgame(gid) {
    for (var i = 0; i < roundgames[1].length; i++) {
      if (roundgames[1][i].gid === gid) return roundgames[1][i];
    }
    throw new Error("Unable to find gid " + gid);
  }

  // Normalize team: string -> { name: string }, object with name -> ensure { name, color? }
  function normalizeTeam(t) {
    if (typeof t === 'string') return { name: t };
    if (t && t.name) return t;
    return { name: 'Unknown' };
  }

  var gid = 1;
  for (var r = 0; r < regions.length; r++) {
    var reg = regions[r];
    var order = (reg === "south" || reg === "west") ? r_to_l : l_to_r;
    for (var s = 0; s < order.length; s++) {
      var seed = order[s];
      var game = findgame(gid);
      var raw = teams[reg] && teams[reg][seed];
      game.team = normalizeTeam(raw || 'Team ' + gid);
      gid++;
    }
  }

  return root;
}

function main(teams) {
  var radius = 400,
      numRounds = 7,
      root = buildtree(teams),
      logoheight = 30;

  var partition = d3.layout.partition()
    .sort(null)
    .size([2 * Math.PI, radius])
    .value(function(d) { return 1; });

  var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx; })
    .innerRadius(function(d) { return d.y; })
    .outerRadius(function(d) { return d.y + d.dy; });

  function trans(x, y) { return 'translate('+x+','+y+')'; }

  var xCenter = radius, yCenter = radius;
  var svg = d3.select('#bracket')
    .append('svg')
    .attr('width', radius*2+25)
    .attr('height', radius*2+25)
    .append('g')
    .attr("id", "center")
    .attr('transform', trans(xCenter, yCenter));

  var chart = svg.append('g').attr("id", "chart");
  chart.datum(root).selectAll('.arc')
    .data(partition.nodes)
    .enter()
    .append('g')
    .attr("class", "arc")
    .attr("id", function(d) { return "game" + d.gid; });

  var arcs = d3.selectAll('.arc');

  function rgba(color, alpha) {
    if (alpha.toString().indexOf("e") > -1) alpha = 0;
    return "rgba("+color[0]+","+color[1]+","+color[2]+","+alpha+")";
  }

  var spots = {
    117: [65, 185], 118: [165, 95], 119: [178, -70],
    121: [-104, -104], 122: [-104, 104], 123: [100, 92], 124: [96, -88],
    125: [-80,0], 126: [80,0], 127: [0,20],
  };

  function findLeaf(game) {
    if (!game || !game.team || game.round === 1) return game;
    var children = game.children || [];
    for (var i = 0; i < children.length; i++) {
      if (children[i].team && children[i].team.name === game.team.name) {
        return findLeaf(children[i]);
      }
    }
    return game;
  }

  function fillpath(game) {
    if (!game || !game.team) return;
    var color = game.team.color || DEFAULT_TEAM_COLOR;
    var alpha = 0.6;

    var leaf = findLeaf(game);
    var path = [];
    for (var n = leaf; n && n.gid !== game.gid; n = n.parent) {
      path.push(n);
    }
    path.push(game);

    path.forEach(function(node) {
      var gameg = d3.select("#game" + node.gid);
      if (gameg.node()) gameg.select("path").style("fill", rgba(color, alpha));
    });

    if (game.gid === 127) {
      d3.select("#center").selectAll("#teamname").remove();
      d3.select("#center")
        .append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("fill", "#333")
        .attr("id", "teamname")
        .text(game.team.name);
      d3.selectAll("#game127 .logo").style("opacity", "0.15");
    }
  }

  function clearPaths() {
    d3.selectAll(".arc path").style("fill", "#fff");
    d3.selectAll("#teamname").remove();
    d3.selectAll("#game127 .logo").style("opacity", "1");
  }

  function getTeamColor(team, callback) {
    if (team.color) { callback(team.color); return; }
    if (typeof RGBaster === 'undefined') { callback(DEFAULT_TEAM_COLOR); return; }
    var img = new Image();
    img.onload = function() {
      try {
        RGBaster.colors("logos/"+team.name+".png", function(payload) {
          var m = payload.dominant && payload.dominant.match(/(\d{1,3}),(\d{1,3}),(\d{1,3})/);
          if (m) team.color = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
          else team.color = DEFAULT_TEAM_COLOR;
          callback(team.color);
        });
      } catch (e) {
        team.color = DEFAULT_TEAM_COLOR;
        callback(DEFAULT_TEAM_COLOR);
      }
    };
    img.onerror = function() {
      team.color = DEFAULT_TEAM_COLOR;
      callback(DEFAULT_TEAM_COLOR);
    };
    img.src = "logos/"+team.name+".png";
  }

  function updateDisplay() {
    clearPaths();
    var gamesWithTeam = [];
    for (var i = 1; i < 128; i++) {
      var game = d3.select("#game" + i).datum();
      if (game && game.team && game.round > 1) gamesWithTeam.push(game);
    }
    gamesWithTeam.sort(function(a, b) { return b.round - a.round; });
    gamesWithTeam.forEach(function(game) {
      getTeamColor(game.team, function() {
        fillpath(game);
      });
    });
  }

  function advanceTeam(game) {
    if (!game || !game.team || !game.parent) return;
    game.parent.team = game.team;
    updateDisplay();
    updateLogos();
  }

  function updateLogos() {
    var multipliers = { 4: 1.03, 5: 1.15, 6: 1.4 };
    function logoTransform(d) {
      var pathNode = d3.select("#game"+d.gid+" path").node();
      if (!pathNode) return trans(0,0);
      var bb = pathNode.getBBox();
      var x = bb.x + bb.width/2, y = bb.y + bb.height/2;
      if (multipliers[d.round]) {
        var m = multipliers[d.round];
        x *= m; y *= m;
      }
      x -= logoheight/2; y -= logoheight/2;
      return trans(x, y);
    }

    for (var i = 1; i < 128; i++) {
      var game = d3.select("#game" + i).datum();
      var logoG = d3.select("#game" + i).select(".logo");
      if (logoG.empty()) continue;
      logoG.selectAll("*").remove();

      if (game && game.team) {
        var gid = game.gid;
        var teamName = game.team.name;
        var img = logoG.append("image")
          .attr("xlink:href", "logos/"+teamName+".png")
          .attr("transform", logoTransform(game))
          .attr("width", logoheight)
          .attr("height", logoheight)
          .on("error", function() {
            var g = d3.select(this.parentNode);
            d3.select(this).remove();
            var pathNode = d3.select("#game"+gid+" path").node();
            if (pathNode) {
              var bb = pathNode.getBBox();
              g.append("text")
                .attr("text-anchor", "middle")
                .attr("x", bb.x + bb.width/2)
                .attr("y", bb.y + bb.height/2)
                .style("font-size", "9px")
                .style("fill", "#333")
                .text(teamName);
            }
          });
      }
    }
  }

  arcs.on('click', function(d) {
    if (d.team && d.parent) {
      advanceTeam(d);
    }
  })
  .on('touchstart', function(d) {
    if (d.team && d.parent) {
      d3.event.preventDefault();
      advanceTeam(d);
    }
  })
  .append('path')
  .attr('d', arc)
  .attr("id", function(d) { return "path-game" + d.gid; });

  arcs.append("clipPath")
    .attr("id", function(d) { return "text-clip-game" + d.gid; })
    .append("use")
    .attr("xlink:href", function(d) { return "#path-game" + d.gid; });

  var logos = arcs.append('g')
    .attr("class", "logo")
    .attr("clip-path", function(d) { return "url(#text-clip-game"+d.gid+")"; })
    .attr("id", function(d) { return "logo" + d.gid; });

  var multipliers = { 4: 1.03, 5: 1.15, 6: 1.4 };
  function logoTransform(d) {
    var pathNode = d3.select("#game"+d.gid+" path").node();
    if (!pathNode) return trans(0,0);
    var bb = pathNode.getBBox();
    var x = bb.x + bb.width/2, y = bb.y + bb.height/2;
    if (multipliers[d.round]) { var m = multipliers[d.round]; x *= m; y *= m; }
    x -= logoheight/2; y -= logoheight/2;
    return trans(x, y);
  }

  logos.filter(function(d) { return d.team; })
    .each(function(d) {
      var g = d3.select(this);
      var img = g.append("image")
        .attr("xlink:href", "logos/"+d.team.name+".png")
        .attr("transform", logoTransform(d))
        .attr("width", logoheight)
        .attr("height", logoheight);
      img.on("error", function() {
        d3.select(this).remove();
        var pathNode = d3.select("#game"+d.gid+" path").node();
        if (pathNode) {
          var bb = pathNode.getBBox();
          g.append("text")
            .attr("text-anchor", "middle")
            .attr("x", bb.x + bb.width/2)
            .attr("y", bb.y + bb.height/2)
            .style("font-size", "9px")
            .style("fill", "#333")
            .text(d.team.name);
        }
      });
    });

  var nradius = radius + 30;
  var arcmaker = d3.svg.arc().innerRadius(nradius).outerRadius(nradius);
  var regionarcs = [
    {region: "East", startAngle: 0, endAngle: Math.PI/2},
    {region: "Midwest", startAngle: Math.PI/2, endAngle: Math.PI},
    {region: "West", startAngle: Math.PI, endAngle: 3*Math.PI/2},
    {region: "South", startAngle: 3*Math.PI/2, endAngle: 2*Math.PI}
  ];

  var namearcs = d3.select("#center").append("g").attr("id", "namearcs");
  var namearc = namearcs.selectAll("g").data(regionarcs).enter().append("g").attr("class", "namearc");
  namearc.append("defs").append("path")
    .attr("d", arcmaker)
    .attr("id", function(d) { return "regionpath-" + d.region; })
    .attr("class", "regionpath");
  namearc.append("text").append("textPath")
    .attr("text-anchor", "middle")
    .attr("startOffset", "25%")
    .attr("xlink:href", function(d) { return "#regionpath-" + d.region; })
    .style("fill", "#888")
    .style("font-weight", "bold")
    .style("font-size", "20px")
    .text(function(d) { return d.region; });

  updateDisplay();

  var resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.onclick = function() {
    if (window.bracketReset) window.bracketReset();
  };

  window.bracketReset = function() {
    function clearWinners(node) {
      if (node.round > 1) node.team = undefined;
      if (node.children) {
        node.children.forEach(clearWinners);
      }
    }
    clearWinners(root);
    partition.nodes(root);
    clearPaths();
    updateLogos();
  };
}

function loadTeams(data) {
  var teams = {};
  var regions = ["south", "west", "midwest", "east"];
  for (var r = 0; r < regions.length; r++) {
    var reg = regions[r];
    teams[reg] = {};
    for (var s = 1; s <= 16; s++) {
      var key = String(s);
      var val = data[reg] && data[reg][key];
      teams[reg][key] = (typeof val === 'object' && val.name) ? val : (val || 'Team ' + (r*16 + s));
    }
  }
  return teams;
}

queue()
  .defer(d3.json, 'bracket.json')
  .await(function(err, data) {
    var teams;
    if (err || !data) {
      d3.json('teams.json', function(e2, t) {
        teams = t || loadTeams({});
        main(teams);
      });
    } else {
      teams = (data.south && typeof data.south["1"] === 'object' && data.south["1"].name)
        ? data : loadTeams(data);
      main(teams);
    }
  });
