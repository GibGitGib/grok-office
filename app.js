/* Static port of the Grok Bot Page "Core Tech Studio Labs Office".
   Data lives in data.js (a snapshot); this file is the rendering code. */
(function () {
  "use strict";

  /* ---------- derived data ---------- */
  function moodOf(a) {
    if (a.items.some(function (i) { return i.you; })) return "waiting";
    if (a.items.length > 0) return "busy";
    return "idle";
  }
  function asksOf(a) { return a.items.filter(function (i) { return i.you; }).length; }
  var MOOD_LABEL = { waiting: "Waiting on you", busy: "Busy", idle: "Idle" };
  var COUNTS = { waiting: 0, busy: 0, idle: 0 };
  AGENTS.forEach(function (a) { COUNTS[moodOf(a)] += 1; });
  var FILTERS = [
    { v: "all", l: "All", n: AGENTS.length },
    { v: "waiting", l: "Waiting on you", n: COUNTS.waiting },
    { v: "busy", l: "Busy", n: COUNTS.busy },
    { v: "idle", l: "Idle", n: COUNTS.idle },
  ];
  var INBOX = (function () {
    var map = new Map();
    AGENTS.forEach(function (a) {
      a.items.filter(function (i) { return i.you; }).forEach(function (i) {
        var k = i.key != null ? i.key : a.id + ":" + i.text;
        var cur = map.get(k);
        if (cur) cur.agents.push(a.name);
        else map.set(k, { text: i.text, asOf: i.asOf, agents: [a.name] });
      });
    });
    function order(d) {
      var p = d.split(" "), mon = p[0], day = p[1];
      return (mon === "Oct" ? 1000 : mon === "Nov" ? 1100 : mon === "Dec" ? 1200 : 900) + Number(day);
    }
    return Array.from(map.values()).sort(function (x, y) { return order(y.asOf) - order(x.asOf); });
  })();
  function shortOf(n) { return n.split(" · ")[0]; }
  function plate(n) {
    var w = shortOf(n).toUpperCase().split(" ");
    return w.length <= 1 ? w : [w[0], w.slice(1).join(" ")];
  }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return h;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- floor layout (shared by both themes) ---------- */
  var U = 40, KX = U * 0.866, KY = U * 0.5, PITCH_X = 2.4, PITCH_Y = 4.2, DW = 1.1, DD = 0.9, DH = 14;
  function iso(x, y, z) { z = z || 0; return [(x - y) * KX, (x + y) * KY - z]; }
  function P(a) { return a.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" "); }
  var SPOTS = [], ZBOX = [];
  ZONES.forEach(function (z, r) {
    var ds = AGENTS.filter(function (a) { return a.zone === z; });
    ds.forEach(function (a, j) { SPOTS.push({ a: a, x: j * PITCH_X, y: r * PITCH_Y, i: SPOTS.length }); });
    ZBOX.push({ zone: z, x0: -0.6, y0: r * PITCH_Y - 0.6, x1: (Math.max(ds.length, 1) - 1) * PITCH_X + DW + 0.6, y1: r * PITCH_Y + DD + 1.0 });
  });
  var CONF_X0 = (ZBOX[0] ? ZBOX[0].x1 : 0) + 0.8;
  var CONF = { x0: CONF_X0, y0: -1.4, x1: CONF_X0 + 9.0, y1: 2.1 };
  var TABLES = ROOMS.map(function (r, k) { return { room: r, cx: CONF_X0 + 1.5 + k * 3.0, cy: 0.6 }; });
  var VIEW = (function () {
    var pts = [];
    SPOTS.forEach(function (s) {
      var c = iso(s.x + DW / 2, s.y + DD / 2);
      pts.push([c[0] - 80, c[1] - 100], [c[0] + 80, c[1] + 70]);
    });
    ZBOX.forEach(function (z) {
      var l = iso(z.x0, z.y0);
      pts.push([l[0] - 150, l[1] - 20], iso(z.x1, z.y0), iso(z.x0, z.y1), iso(z.x1, z.y1));
    });
    pts.push(iso(CONF.x0, CONF.y0), iso(CONF.x1, CONF.y0), iso(CONF.x0, CONF.y1), iso(CONF.x1, CONF.y1));
    TABLES.forEach(function (t) {
      var c = iso(t.cx, t.cy);
      pts.push([c[0] - 80, c[1] - 50], [c[0] + 80, c[1] + 90]);
    });
    var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs) - 16, y0 = Math.min.apply(null, ys) - 16;
    return {
      box: x0.toFixed(0) + " " + y0.toFixed(0) + " " + (Math.max.apply(null, xs) - x0 + 16).toFixed(0) + " " + (Math.max.apply(null, ys) - y0 + 16).toFixed(0),
      maxX: CONF.x1, maxY: ZBOX.length * PITCH_Y,
    };
  })();

  /* ---------- theme tokens (light / dark, follows the system) ---------- */
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  var SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var LIGHT = {
    bgBase: "#FCFCFC", bgElevated: "#FFFFFF", bgSubtle: "#F2F2F2",
    bSubtle: "#14141414", bDefault: "#1414141F", bStrong: "#14141452", bFocus: "#141414",
    t1: "#141414", t2: "#14141499", t3: "#1414145C",
    cat0: "#2F6FEB", cat1: "#E8A200", other: "#9A9A9A",
  };
  var DARK = {
    bgBase: "#070707", bgElevated: "#151515", bgSubtle: "#1B1B1B",
    bSubtle: "#FCFCFC14", bDefault: "#FCFCFC1F", bStrong: "#FCFCFC52", bFocus: "#FCFCFC",
    t1: "#FCFCFC", t2: "#FCFCFC99", t3: "#FCFCFC5C",
    cat0: "#5B8FF9", cat1: "#F5B92E", other: "#6B6B6B",
  };
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function T() { return mq && mq.matches ? DARK : LIGHT; }

  /* ---------- Arcade palette (own surface) ---------- */
  var AR = { bg: "#0E1116", tileA: "#151A22", tileB: "#121720", carpet: "#1B2230", edge: "#2E3A4D", ink: "#F2EFE6", dim: "#8A93A3", yellow: "#FFD23F", green: "#7BD389", gray: "#5A6372" };
  var SPRITE = ["..HHHH..", ".HHHHHH.", "HHSSSSHH", "HSESSESH", "HSSSSSSH", ".SSMMSS.", "..SSSS..", ".BBBBBB."];
  var HAIR = ["#2B1D14", "#E8C547", "#B5562F", "#1B1B1B", "#7A4E2D", "#D9D2C5"];
  var SKIN = ["#F1C9A5", "#C68A5E", "#8D5A3B", "#F5D6BA"];
  var SHIRT = ["#3E7CB1", "#7BD389", "#EE4266", "#FFD23F", "#F78C40", "#9AA5B1"];
  function arcadeScreen(m) { return m === "waiting" ? AR.yellow : m === "busy" ? AR.green : AR.gray; }

  /* ---------- state ---------- */
  var S = { theme: /[?&]theme=iso\b/.test(location.search) ? "iso" : "arcade", filter: "all", sel: "que", motion: true, replay: 0, score: 0 };
  var lastFrameKey = null;
  var scoreTimer = null;

  function poly(pts, fill, stroke, sw, extra) {
    return '<polygon points="' + P(pts) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : "") + (extra || "") + "/>";
  }

  function deskArt(s, kind, on, sel) {
    var t = T();
    var a = s.a, x = s.x, y = s.y;
    var m = moodOf(a), asks = asksOf(a), arcade = kind === "arcade";
    var status = arcade ? arcadeScreen(m) : m === "waiting" ? t.cat1 : m === "busy" ? t.cat0 : t.other;
    var foot = iso(x + DW / 2, y + DD + 0.45);
    var mt = iso(x + 0.55, y + 0.18, DH + 22);
    var lines = plate(a.name);
    var top = arcade ? "#8A6A4F" : t.bgElevated;
    var front = arcade ? "#6B4F3A" : t.bDefault;
    var side = arcade ? "#4E3A2B" : t.bStrong;
    var ink = arcade ? "#000" : t.bStrong;
    var sw = arcade ? 2 : 1;
    var hid = hash(a.id);
    var col = { H: HAIR[hid % HAIR.length], S: SKIN[hid % SKIN.length], E: "#111", M: "#7A2E2E", B: SHIRT[hid % SHIRT.length] };
    var px = 3;
    var b = "<g>";
    b += poly([iso(x + DW, y, DH), iso(x + DW, y + DD, DH), iso(x + DW, y + DD), iso(x + DW, y)], side, ink, sw);
    b += poly([iso(x, y + DD, DH), iso(x + DW, y + DD, DH), iso(x + DW, y + DD), iso(x, y + DD)], front, ink, sw);
    b += poly([iso(x, y, DH), iso(x + DW, y, DH), iso(x + DW, y + DD, DH), iso(x, y + DD, DH)], top, sel ? (arcade ? AR.yellow : t.bFocus) : ink, sel ? 3 : sw);
    if (arcade) {
      b += poly([iso(x + 0.25, y + 0.18, DH), iso(x + 0.85, y + 0.18, DH), iso(x + 0.85, y + 0.18, DH + 22), iso(x + 0.25, y + 0.18, DH + 22)], "#232A35", "#000", 2);
      b += poly([iso(x + 0.31, y + 0.18, DH + 4), iso(x + 0.79, y + 0.18, DH + 4), iso(x + 0.79, y + 0.18, DH + 18), iso(x + 0.31, y + 0.18, DH + 18)], status);
    } else {
      b += poly([iso(x + 0.25, y + 0.18, DH), iso(x + 0.85, y + 0.18, DH), iso(x + 0.85, y + 0.18, DH + 22), iso(x + 0.25, y + 0.18, DH + 22)], status, t.t1, 1, m === "idle" ? ' opacity="0.5"' : "");
    }
    for (var k = 0; k < Math.min(asks, 3); k++) {
      b += poly([iso(x + 0.12 + k * 0.28, y + 0.5, DH), iso(x + 0.32 + k * 0.28, y + 0.5, DH), iso(x + 0.32 + k * 0.28, y + 0.72, DH), iso(x + 0.12 + k * 0.28, y + 0.72, DH)],
        arcade ? AR.yellow : t.cat1, arcade ? "#000" : t.t1, arcade ? 1 : 0.6);
    }
    if (arcade) {
      SPRITE.forEach(function (row, ry) {
        row.split("").forEach(function (ch, rx) {
          if (ch === ".") return;
          b += '<rect x="' + (foot[0] - 12 + rx * px) + '" y="' + (foot[1] - 24 + ry * px) + '" width="' + px + '" height="' + px + '" fill="' + col[ch] + '"/>';
        });
      });
    } else {
      b += '<circle cx="' + foot[0] + '" cy="' + (foot[1] - 11) + '" r="11" fill="' + t.bgBase + '" stroke="' + t.t1 + '" stroke-width="1.5"/>';
      b += '<text x="' + foot[0] + '" y="' + (foot[1] - 7.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + t.t1 + '" font-family=\'' + SANS + "'>" + esc(a.initials) + "</text>";
    }
    lines.forEach(function (ln, k2) {
      b += '<text class="' + (arcade ? "om-name" : "") + '" x="' + foot[0] + '" y="' + (foot[1] + 15 + k2 * 14) + '" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="' + (arcade ? "0.06em" : "0.02em") +
        '" fill="' + (arcade ? (sel ? AR.yellow : AR.ink) : t.t1) + '" font-family=\'' + (arcade ? MONO : SANS) + "'>" + esc(ln) + "</text>";
    });
    if (arcade && m === "waiting") {
      b += '<g class="om-bob" style="animation-delay:' + (700 + (s.i % 5) * 120) + 'ms">' +
        '<rect x="' + (mt[0] - 3) + '" y="' + (mt[1] - 32) + '" width="7" height="14" fill="' + AR.yellow + '" stroke="#000" stroke-width="2"/>' +
        '<rect x="' + (mt[0] - 3) + '" y="' + (mt[1] - 14) + '" width="7" height="7" fill="' + AR.yellow + '" stroke="#000" stroke-width="2"/></g>';
    }
    if (!arcade && m === "waiting") {
      var l = iso(x + DW - 0.05, y + 0.05, DH + 36);
      b += '<circle class="om-ring" cx="' + l[0] + '" cy="' + l[1] + '" r="5" fill="none" stroke="' + status + '" stroke-width="2" style="animation-delay:' + (700 + s.i * 40) + 'ms"/>';
      b += '<circle cx="' + l[0] + '" cy="' + l[1] + '" r="5" fill="' + status + '" stroke="' + t.t1 + '" stroke-width="1"/>';
    }
    b += "</g>";
    var label = ' role="button" tabindex="0" aria-label="' + esc(a.name + ": " + MOOD_LABEL[m]) + '" data-pick="' + a.id + '"';
    if (arcade) {
      return '<g class="om-hx"' + label + ' style="cursor:pointer;opacity:' + (on ? 1 : 0.2) + ';transition:opacity 200ms ease-out">' +
        poly([iso(x - 0.3, y - 0.3), iso(x + DW + 0.3, y - 0.3), iso(x + DW + 0.3, y + DD + 0.9), iso(x - 0.3, y + DD + 0.9)], status, null, 0, ' class="om-glow' + (sel ? " sel" : "") + '"') +
        '<g class="om-rise" style="animation-delay:' + (120 + s.i * 35) + 'ms"><g class="om-hlift">' + b + "</g></g></g>";
    }
    return '<g class="om-lift"' + label + ' style="cursor:pointer;opacity:' + (on ? 1 : 0.16) + '"><g class="om-rise" style="animation-delay:' + (120 + s.i * 35) + 'ms">' + b + "</g></g>";
  }

  function floor(kind) {
    var t = T();
    var arcade = kind === "arcade";
    var ordered = SPOTS.slice().sort(function (m, n) { return m.x + m.y - (n.x + n.y); });
    var out = '<div class="floor-scroll"><svg viewBox="' + VIEW.box + '" width="100%" role="img" aria-label="Isometric office floor plan" style="display:block;shape-rendering:' + (arcade ? "crispEdges" : "auto") + '">';
    if (arcade) {
      for (var gx = -2; gx < Math.ceil(VIEW.maxX) + 2; gx++) for (var gy = -3; gy < Math.ceil(VIEW.maxY) + 1; gy++) {
        out += poly([iso(gx, gy), iso(gx + 1, gy), iso(gx + 1, gy + 1), iso(gx, gy + 1)], (((gx + gy) % 2) + 2) % 2 === 0 ? AR.tileA : AR.tileB);
      }
    }
    var labelFill = arcade ? AR.dim : t.t3;
    var labelFont = arcade ? MONO : SANS;
    ZBOX.forEach(function (z, zi) {
      var l = iso(z.x0, z.y0);
      out += '<g class="om-fade" style="animation-delay:' + zi * 60 + 'ms">' +
        poly([iso(z.x0, z.y0), iso(z.x1, z.y0), iso(z.x1, z.y1), iso(z.x0, z.y1)], arcade ? AR.carpet : t.bgSubtle, arcade ? AR.edge : t.bDefault, arcade ? 4 : 1) +
        '<text x="' + (l[0] - 10) + '" y="' + (l[1] + 4) + '" text-anchor="end" font-size="13" font-weight="700" letter-spacing="0.08em" fill="' + labelFill + '" font-family=\'' + labelFont + "'>" + esc(z.zone.toUpperCase()) + "</text></g>";
    });
    out += '<g class="om-fade" style="animation-delay:300ms">';
    out += poly([iso(CONF.x0, CONF.y0), iso(CONF.x1, CONF.y0), iso(CONF.x1, CONF.y1), iso(CONF.x0, CONF.y1)], arcade ? AR.carpet : "none", arcade ? AR.edge : t.bStrong, arcade ? 4 : 1.5, ' stroke-dasharray="' + (arcade ? "12 8" : "8 6") + '"');
    var cl = iso(CONF.x0 + 0.3, CONF.y0 + 0.35);
    out += '<text x="' + cl[0] + '" y="' + cl[1] + '" transform="rotate(30 ' + cl[0] + " " + cl[1] + ')" font-size="12" font-weight="700" letter-spacing="0.1em" fill="' + labelFill + '" font-family=\'' + labelFont + "'>" + (arcade ? "MEETING ROOMS" : "CONFERENCE ROOMS") + "</text>";
    TABLES.forEach(function (tb) {
      var cx = tb.cx, cy = tb.cy, room = tb.room, sz = 0.65, hh = 10;
      var words = room.name.toUpperCase().split(" ");
      var lab = iso(cx, cy + 1.55);
      out += "<g>";
      if (arcade) {
        out += poly([iso(cx + sz, cy - sz, hh), iso(cx + sz, cy + sz, hh), iso(cx + sz, cy + sz), iso(cx + sz, cy - sz)], "#4E3A2B", "#000", 2);
        out += poly([iso(cx - sz, cy + sz, hh), iso(cx + sz, cy + sz, hh), iso(cx + sz, cy + sz), iso(cx - sz, cy + sz)], "#6B4F3A", "#000", 2);
        out += poly([iso(cx - sz, cy - sz, hh), iso(cx + sz, cy - sz, hh), iso(cx + sz, cy + sz, hh), iso(cx - sz, cy + sz, hh)], "#8A6A4F", "#000", 2);
      } else {
        var ring = [];
        for (var k = 0; k < 24; k++) ring.push(iso(cx + 0.8 * Math.cos((k / 24) * Math.PI * 2), cy + 0.8 * Math.sin((k / 24) * Math.PI * 2), 6));
        out += poly(ring, t.bgElevated, t.bStrong, 1);
      }
      room.members.forEach(function (mb, k3) {
        var ang = (k3 / room.members.length) * Math.PI * 2;
        var q = iso(cx + 1.15 * Math.cos(ang), cy + 1.15 * Math.sin(ang), 4);
        out += arcade
          ? '<rect x="' + (q[0] - 5) + '" y="' + (q[1] - 5) + '" width="10" height="10" fill="' + SHIRT[hash(mb) % SHIRT.length] + '" stroke="#000" stroke-width="2"/>'
          : '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6" fill="' + t.bgBase + '" stroke="' + t.cat0 + '" stroke-width="2"/>';
      });
      [words[0], words.slice(1).join(" ")].filter(function (w) { return w.length > 0; }).forEach(function (w, k4) {
        out += '<text x="' + lab[0] + '" y="' + (lab[1] + 10 + k4 * 14) + '" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="0.06em" fill="' + (arcade ? AR.ink : t.t2) + '" font-family=\'' + labelFont + "'>" + esc(w) + "</text>";
      });
      out += "</g>";
    });
    out += "</g>";
    ordered.forEach(function (s) {
      out += deskArt(s, kind, S.filter === "all" || moodOf(s.a) === S.filter, S.sel === s.a.id);
    });
    return out + "</svg></div>";
  }

  function selAgent() { return AGENTS.find(function (a) { return a.id === S.sel; }) || AGENTS[0]; }

  function arcadeFrame() {
    var selA = selAgent();
    function hud(label, value, roll) {
      return '<div class="hud"><span class="hud-l">' + label + '</span><span ' + (roll ? 'id="score" ' : "") + 'class="hud-v">' + String(value).padStart(2, "0") + "</span></div>";
    }
    var mine = selA.items.filter(function (i) { return i.you; });
    var h = '<div class="arcade">';
    h += '<div class="hudrow">' + hud("ASKS FOR YOU", S.score, true) + hud("DESKS", AGENTS.length) + hud("WAITING DESKS", COUNTS.waiting) + hud("ROOMS", ROOMS.length) +
      '<span class="snap">SNAPSHOT ' + esc(AS_OF.toUpperCase()) + "</span></div>";
    h += '<div class="pxkeys">';
    FILTERS.forEach(function (f) {
      h += '<button type="button" class="om-press om-pxkey pxkey' + (S.filter === f.v ? " on" : "") + '" aria-pressed="' + (S.filter === f.v) + '" data-filter="' + f.v + '">' + esc(f.l.toUpperCase() + " " + f.n) + "</button>";
    });
    h += "</div>" + floor("arcade");
    h += '<div class="arc-foot"><div class="arc-player"><span>PLAYER</span><span class="arc-name">' + esc(shortOf(selA.name).toUpperCase()) + "</span><span>" +
      esc(MOOD_LABEL[moodOf(selA)].toUpperCase()) + " · " + mine.length + " QUESTS FOR YOU · LAST " + esc(selA.lastSeen.toUpperCase()) + "</span></div>";
    h += '<div class="arc-items"><span class="arc-cap">' + (selA.items.length > 0 ? "ON THIS DESK" : "PROJECTS") + "</span>";
    selA.items.slice(0, 3).forEach(function (it) {
      h += '<div class="arc-item"><span class="sq" style="background:' + (it.you ? AR.yellow : AR.gray) + '"></span><span class="grow">' + esc(it.text) + '</span><span class="arc-date">' + esc(it.asOf.toUpperCase()) + "</span></div>";
    });
    if (selA.items.length === 0) selA.projects.slice(0, 2).forEach(function (pr) { h += '<div class="arc-proj">' + esc(pr.name) + "</div>"; });
    if (selA.items.length === 0 && selA.projects.length === 0) h += '<div class="arc-proj" style="color:' + AR.dim + '">' + esc(selA.role) + "</div>";
    h += '<span class="arc-more">FULL DESK DETAILS BELOW</span></div></div></div>';
    return h;
  }

  function isoFrame() {
    var t = T();
    var selA = selAgent(), m = moodOf(selA);
    var mine = selA.items.filter(function (i) { return i.you; });
    var status = m === "waiting" ? t.cat1 : m === "busy" ? t.cat0 : t.other;
    var h = '<div class="isof"><div class="keys">';
    FILTERS.forEach(function (f) {
      h += '<button type="button" class="om-press om-key key' + (S.filter === f.v ? " on" : "") + '" aria-pressed="' + (S.filter === f.v) + '" data-filter="' + f.v + '">' + esc(f.l + " " + f.n) + "</button>";
    });
    h += "</div>" + floor("iso");
    h += '<div class="iso-foot"><div class="iso-who"><div class="iso-name">' + esc(shortOf(selA.name)) + '</div><div class="sec">' + esc(selA.role) + "</div>" +
      '<div class="iso-stat"><span class="dot" style="background:' + status + '"></span>' + esc(MOOD_LABEL[m]) + " · " + mine.length + " for you · last active " + esc(selA.lastSeen) + "</div></div>";
    h += '<div class="iso-items">';
    selA.items.slice(0, 3).forEach(function (it) {
      h += '<div class="iso-item"><span class="tag" style="background:' + (it.you ? t.cat1 : t.bDefault) + '"></span><span class="grow">' + esc(it.text) + '</span><span class="ter lbl">' + esc(it.asOf) + "</span></div>";
    });
    if (selA.items.length === 0) selA.projects.slice(0, 2).forEach(function (pr) { h += '<div class="sec">Project: ' + esc(pr.name) + "</div>"; });
    h += '<div class="ter lbl">Full desk details below</div></div></div></div>';
    return h;
  }

  function rows(list) {
    return '<ul class="rows">' + list.map(function (r) {
      return '<li class="row-i"><div class="row-main">' + (r.lead ? '<div class="row-lead">' + esc(r.lead) + "</div>" : "") +
        '<div class="row-title">' + esc(r.title) + "</div>" + (r.detail ? '<div class="row-detail">' + esc(r.detail) + "</div>" : "") +
        '</div><div class="row-meta">' + esc(r.meta) + "</div></li>";
    }).join("") + "</ul>";
  }
  function section(heading, body, opts) {
    opts = opts || {};
    var tag = opts.sub ? "h3" : "h2";
    return '<section class="sec-block' + (opts.sub ? " sub" : "") + '"' + (opts.id ? ' id="' + opts.id + '"' : "") + '><div class="sec-head"><div><' + tag + ">" + esc(heading) + "</" + tag + ">" +
      (opts.caption ? '<p class="caption">' + esc(opts.caption) + "</p>" : "") + "</div>" + (opts.actions || "") + "</div>" + body + "</section>";
  }

  function render() {
    var selected = selAgent(), selMood = moodOf(selected);
    var yourItems = selected.items.filter(function (i) { return i.you; });
    var ownItems = selected.items.filter(function (i) { return !i.you; });
    var rooms = ROOMS.filter(function (r) { return r.members.some(function (m) { return selected.name.indexOf(m) === 0; }); }).map(function (r) { return r.name; });

    var frameKey = S.theme + "-" + S.replay;
    var settled = frameKey === lastFrameKey;
    lastFrameKey = frameKey;

    var seg = '<div class="seg" role="radiogroup" aria-label="Theme">' +
      [["arcade", "Arcade × Isometric"], ["iso", "Isometric"]].map(function (o) {
        return '<button type="button" role="radio" aria-checked="' + (S.theme === o[0]) + '" class="seg-b' + (S.theme === o[0] ? " on" : "") + '" data-theme="' + o[0] + '">' + esc(o[1]) + "</button>";
      }).join("") + "</div>";

    var h = '<header class="page-head"><h1>Core Tech Studio Labs Office</h1><p class="summary">' +
      esc("An office floor of your " + AGENTS.length + " agents: " + INBOX.length + " items are waiting on you across " + COUNTS.waiting + " desks. Hover or click a desk to see its projects and pending actions. Snapshot as of " + AS_OF + ".") + "</p></header>";

    var floorBody = '<div class="om' + (S.motion ? "" : " om-still") + (settled ? " om-settled" : "") + '">' + (S.theme === "arcade" ? arcadeFrame() : isoFrame()) + "</div>" +
      '<div class="ctrls"><label class="toggle"><input type="checkbox" id="motion"' + (S.motion ? " checked" : "") + '><span class="sw" aria-hidden="true"></span>Motion</label>' +
      '<button type="button" class="btn" id="replay">Replay motion</button></div>';
    h += section("Office floor", floorBody, { actions: seg });

    var props = [["Role", esc(selected.role)],
      ["Status", '<span class="status ' + (selMood === "waiting" ? "warning" : selMood === "busy" ? "accent" : "neutral") + '">' + esc(MOOD_LABEL[selMood]) + "</span>"],
      ["Last active", esc(selected.lastSeen)]];
    if (rooms.length > 0) props.push(["Rooms", esc(rooms.join(", "))]);
    var desk = '<dl class="props">' + props.map(function (p) { return "<dt>" + p[0] + "</dt><dd>" + p[1] + "</dd>"; }).join("") + "</dl>";
    if (yourItems.length) desk += section("Waiting on you", rows(yourItems.map(function (i) { return { title: i.text, meta: i.asOf }; })), { sub: true });
    if (ownItems.length) desk += section("On the agent's plate", rows(ownItems.map(function (i) { return { title: i.text, meta: i.asOf }; })), { sub: true });
    if (selected.projects.length) desk += section("Projects", rows(selected.projects.map(function (pr) { return { title: pr.name, detail: pr.detail, meta: pr.asOf }; })), { sub: true });
    h += section("Desk: " + selected.name, desk, { id: "desk" });

    h += section("Inbox tray: waiting on you", rows(INBOX.map(function (r) { return { lead: r.agents.join(" + "), title: r.text, meta: "Asked " + r.asOf }; })), { caption: "Recorded snapshot as of " + AS_OF + "; newest asks first." });
    h += section("Conference rooms", rows(ROOMS.map(function (r) { return { title: r.name, detail: r.topic + ". Members: " + r.members.join(", ") + ".", meta: "As of " + r.asOf }; })));
    h += section("About this snapshot", '<p class="about">' + esc(ABOUT) + "</p>");

    var root = document.getElementById("app");
    var focusSel = document.activeElement && document.activeElement.getAttribute ? (document.activeElement.getAttribute("data-pick") ? '[data-pick="' + document.activeElement.getAttribute("data-pick") + '"]' : document.activeElement.id ? "#" + document.activeElement.id : document.activeElement.getAttribute("data-filter") ? '[data-filter="' + document.activeElement.getAttribute("data-filter") + '"]' : document.activeElement.getAttribute("data-theme") ? '[data-theme="' + document.activeElement.getAttribute("data-theme") + '"]' : null) : null;
    root.innerHTML = h;
    if (focusSel) { var el = root.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
    if (!settled) startScore();
  }

  function setScoreText(n, roll) {
    S.score = n;
    var el = document.getElementById("score");
    if (!el) return;
    el.textContent = String(n).padStart(2, "0");
    if (roll) { el.classList.remove("om-roll"); void el.offsetWidth; el.classList.add("om-roll"); }
  }
  function startScore() {
    if (scoreTimer) { clearInterval(scoreTimer); scoreTimer = null; }
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!S.motion || reduced) { setScoreText(INBOX.length, false); return; }
    setScoreText(0, false);
    var n = 0;
    scoreTimer = setInterval(function () {
      n += 1;
      setScoreText(n, true);
      if (n >= INBOX.length) { clearInterval(scoreTimer); scoreTimer = null; }
    }, 80);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-pick],[data-filter],[data-theme],#replay");
    if (!el) return;
    if (el.hasAttribute("data-pick")) S.sel = el.getAttribute("data-pick");
    else if (el.hasAttribute("data-filter")) S.filter = el.getAttribute("data-filter");
    else if (el.hasAttribute("data-theme")) S.theme = el.getAttribute("data-theme");
    else if (el.id === "replay") S.replay += 1;
    render();
  });
  document.addEventListener("keydown", function (e) {
    var el = e.target.closest && e.target.closest("[data-pick]");
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); S.sel = el.getAttribute("data-pick"); render(); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "motion") { S.motion = e.target.checked; render(); startScore(); }
  });
  if (mq) {
    var onScheme = function () { lastFrameKey = S.theme + "-" + S.replay; render(); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme); else if (mq.addListener) mq.addListener(onScheme);
  }
  render();
})();
