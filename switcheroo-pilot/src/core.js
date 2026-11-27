"use strict";
/* Switcheroo! AAA pilot - deterministic core.
   Pure logic, no Phaser dependency: runs in the browser (plain script
   tag, after src/data.js) and in Node (module.exports) so tests can
   drive whole games headlessly.
   Ported faithfully from the live game (current-switcheroo-source.html)
   with ONE change: Math.random is replaced by a seeded mulberry32 RNG,
   so setSeed(n) replays an exact game. Nothing else about the rules
   changed: same levels, same switch types, same unlock rule (4 of 6),
   same 6 rounds, same Together/Versus flow. */

/* Data lives in src/data.js. In the browser it loads first as a classic
   script, so its vars are globals and this block is skipped. In Node,
   require it so headless tests work (see TEST-HOOK.md). */
if (typeof THEMES === "undefined") {
  var _pilotData = require("./data.js");
  var THEMES = _pilotData.THEMES;
  var SMALLS = _pilotData.SMALLS;
  var DISTRACTOR_TILES = _pilotData.DISTRACTOR_TILES;
  var LEVELS = _pilotData.LEVELS;
  var SWITCH_TYPES = _pilotData.SWITCH_TYPES;
  var MODES = _pilotData.MODES;
  var ROUNDS_PER_GAME = _pilotData.ROUNDS_PER_GAME;
  var UNLOCK_SCORE = _pilotData.UNLOCK_SCORE;
  var PILOT_STORE_KEY = _pilotData.PILOT_STORE_KEY;
  var PILOT_VERSION = _pilotData.PILOT_VERSION;
}

/* ---- seeded RNG (mulberry32) ---- */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- state ---- */
var S = {
  screen: "boot", mode: 0, level: 1, themePick: 6, themeIdx: 0,
  round: 0, rounds: [], score: 0, p1score: 0, p2score: 0,
  spotter: 0, switcherOptions: null, switcherChoice: null,
  tapped: null, distractorPicked: [], distractorTiles: [],
  progress: null, unlocked: null,
  seed: 1, rng: mulberry32(1), log: []
};
function rand() { return S.rng(); }
function logEvent(event, detail) {
  S.log.push({ event: event, detail: detail || null, round: S.round });
  if (S.log.length > 200) S.log.shift();
}
function setSeed(seed) {
  S.seed = seed >>> 0;
  S.rng = mulberry32(S.seed);
  logEvent("seed", { seed: S.seed });
  return S.seed;
}

/* ---- helpers (seeded) ---- */
function shuffle(a) {
  var r = a.slice();
  for (var i = r.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = r[i]; r[i] = r[j]; r[j] = t;
  }
  return r;
}
function pickOne(a) { return a[Math.floor(rand() * a.length)]; }
function itemShown(slot) {
  if (!slot) return null;
  if (slot.item.vars) return slot.item.vars[slot.variant || 0];
  return slot.item;
}
function slotKey(slot) {
  if (!slot) return "empty";
  var shown = itemShown(slot);
  return shown.n + "|" + (slot.added ? slot.added.n : "");
}
function theme() { return THEMES[S.themePick === 6 ? S.themeIdx : S.themePick]; }
function levelDef() { return LEVELS[S.level]; }

/* ---- progress (pilot key only - never the live key) ---- */
function loadProgress() {
  try {
    if (typeof localStorage === "undefined") return { unlocked: 1, caught: {}, cleared: {} };
    var raw = localStorage.getItem(PILOT_STORE_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p.unlocked === "number") {
        if (!p.caught || typeof p.caught !== "object") p.caught = {};
        if (!p.cleared || typeof p.cleared !== "object") p.cleared = {};
        return p;
      }
    }
  } catch (e) {}
  return { unlocked: 1, caught: {}, cleared: {} };
}
function saveProgress() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(PILOT_STORE_KEY, JSON.stringify(S.progress));
  } catch (e) {}
}
function recordCaught(sw) {
  if (!sw || !sw.type) return;
  if (!S.progress.caught || typeof S.progress.caught !== "object") S.progress.caught = {};
  if (!S.progress.caught[sw.type]) { S.progress.caught[sw.type] = true; saveProgress(); }
}
function isUnlocked(l) { return l <= S.progress.unlocked; }
S.progress = loadProgress();

/* ---- round dealing ---- */
function dealRound() {
  var t = theme(), L = levelDef();
  var cellIdx = shuffle([0,1,2,3,4,5,6,7,8,9,10,11]).slice(0, L.items);
  var slots = new Array(12).fill(null);
  cellIdx.forEach(function (ci) {
    slots[ci] = { cell: ci, item: pickOne(t.cells[ci].items), variant: 0, added: null };
  });
  var r = { themeId: t.id, slots: slots, changed: null, switches: [], changedCells: [],
    picked: null, correct: null, spotted: null, p1pick: null, p1correct: null, p2pick: null, p2correct: null };
  S.rounds[S.round] = r;
  logEvent("deal", { round: S.round, theme: t.id, level: S.level,
    placed: cellIdx.slice().sort(function (a, b) { return a - b; }) });
  return r;
}
function freeCells(slots) {
  var free = [];
  for (var i = 0; i < 12; i++) if (!slots[i]) free.push(i);
  return free;
}
function placedCells(slots, excludeSwitched) {
  var out = [];
  for (var i = 0; i < 12; i++) {
    if (slots[i] && (!excludeSwitched || !slots[i].switched)) out.push(i);
  }
  return out;
}
function makeSwitch(type, slots) {
  var t = theme();
  var placed = placedCells(slots, true);
  if (type === "remove") {
    if (!placed.length) return null;
    var cell = pickOne(placed);
    var it = itemShown(slots[cell]);
    return { type: "remove", cell: cell, item: it.n, place: t.cells[cell].place,
      desc: "The " + it.n + " was " + t.cells[cell].place + ". Now it is gone." };
  }
  if (type === "move") {
    var free = freeCells(slots);
    if (!placed.length || !free.length) return null;
    var from = pickOne(placed);
    var to = pickOne(free);
    var it2 = itemShown(slots[from]);
    return { type: "move", cell: from, toCell: to, item: it2.n,
      fromPlace: t.cells[from].place, toPlace: t.cells[to].place,
      desc: "The " + it2.n + " was " + t.cells[from].place + ". Now it is " + t.cells[to].place + "." };
  }
  if (type === "swap") {
    if (placed.length < 2) return null;
    var two = shuffle(placed).slice(0, 2);
    var a = itemShown(slots[two[0]]), b = itemShown(slots[two[1]]);
    if (a.n === b.n && a.e === b.e) return null;
    return { type: "swap", cell: two[0], otherCell: two[1], item: a.n, other: b.n,
      desc: "The " + a.n + " and the " + b.n + " swapped places." };
  }
  if (type === "colour") {
    var colourable = placed.filter(function (ci) {
      return slots[ci].item.vars && slots[ci].item.vars.length > 1;
    });
    if (!colourable.length) return null;
    var ccell = pickOne(colourable);
    var item = slots[ccell].item;
    var others = item.vars.map(function (v, i) { return i; }).filter(function (i) { return i !== (slots[ccell].variant || 0); });
    var nv = pickOne(others);
    return { type: "colour", cell: ccell, item: itemShown(slots[ccell]).n, newName: item.vars[nv].n,
      newVariant: nv, place: t.cells[ccell].place,
      desc: "The " + itemShown(slots[ccell]).n + " is a " + item.vars[nv].n + " now." };
  }
  if (type === "add") {
    if (!placed.length) return null;
    var acell = pickOne(placed);
    var small = pickOne(SMALLS);
    return { type: "add", cell: acell, small: small,
      desc: "A " + small.n + " appeared " + t.cells[acell].place + "." };
  }
  return null;
}
function applySwitch(sw, slots) {
  if (sw.type === "remove") {
    slots[sw.cell] = null;
  } else if (sw.type === "move") {
    var s = slots[sw.cell];
    slots[sw.cell] = null;
    slots[sw.toCell] = s;
    slots[sw.toCell].cell = sw.toCell;
    slots[sw.toCell].switched = true;
  } else if (sw.type === "swap") {
    var a = slots[sw.cell], b = slots[sw.otherCell];
    slots[sw.cell] = b; slots[sw.otherCell] = a;
    slots[sw.cell].cell = sw.cell; slots[sw.otherCell].cell = sw.otherCell;
    slots[sw.cell].switched = true; slots[sw.otherCell].switched = true;
  } else if (sw.type === "colour") {
    slots[sw.cell].variant = sw.newVariant;
    slots[sw.cell].switched = true;
  } else if (sw.type === "add") {
    slots[sw.cell].added = sw.small;
    slots[sw.cell].switched = true;
  }
}
function generateSwitches(r) {
  var L = levelDef();
  var working = r.slots.map(function (s) {
    return s ? { cell: s.cell, item: s.item, variant: s.variant || 0, added: null, switched: false } : null;
  });
  var switches = [];
  if (S.mode === 1 && S.switcherChoice) {
    applySwitch(S.switcherChoice, working);
    switches.push(S.switcherChoice);
  }
  var guard = 0;
  while (switches.length < L.switches && guard++ < 40) {
    var types = shuffle(L.types.slice());
    var made = null;
    for (var i = 0; i < types.length && !made; i++) made = makeSwitch(types[i], working);
    if (!made) break;
    applySwitch(made, working);
    switches.push(made);
  }
  r.switches = switches;
  r.changed = working;
  var changedCells = [];
  for (var i = 0; i < 12; i++) {
    if (slotKey(r.slots[i]) !== slotKey(working[i])) changedCells.push(i);
  }
  r.changedCells = changedCells;
  logEvent("switches", { round: S.round,
    switches: switches.map(function (sw) { return { type: sw.type, cell: sw.cell }; }),
    changedCells: changedCells });
  return switches;
}
function offerSwitcherOptions() {
  var L = levelDef();
  var r = S.rounds[S.round];
  var working = r.slots.map(function (s) {
    return s ? { cell: s.cell, item: s.item, variant: s.variant || 0, added: null, switched: false } : null;
  });
  var options = [];
  var types = shuffle(L.types.slice());
  var guard = 0;
  while (options.length < 2 && guard++ < 40) {
    var type = types[guard % types.length];
    var sw = makeSwitch(type, working);
    if (sw && !options.some(function (o) { return o.type === sw.type && o.cell === sw.cell; })) options.push(sw);
    if (guard > 20 && types.length === 1) break;
  }
  S.switcherOptions = options;
  return options;
}
function switchOptionText(sw) {
  if (sw.type === "remove") return "Take the " + sw.item + " away";
  if (sw.type === "move") return "Move the " + sw.item;
  if (sw.type === "swap") return "Swap the " + sw.item + " and the " + sw.other;
  if (sw.type === "colour") return "Change the " + sw.item + "'s colour";
  if (sw.type === "add") return "Sneak in a " + sw.small.n;
  return "Change something";
}
function spotCorrect(cell) {
  var r = S.rounds[S.round];
  return r.changedCells.indexOf(cell) >= 0;
}
function spottedSwitch(cell) {
  var r = S.rounds[S.round];
  for (var i = 0; i < r.switches.length; i++) {
    var sw = r.switches[i];
    var cells = sw.type === "move" ? [sw.cell, sw.toCell]
      : sw.type === "swap" ? [sw.cell, sw.otherCell] : [sw.cell];
    if (cells.indexOf(cell) >= 0) return sw;
  }
  return r.switches[0] || null;
}
function cellDescription(cell) {
  var r = S.rounds[S.round];
  var t = theme();
  var slot = r.changed[cell];
  if (!slot) return "the empty spot " + t.cells[cell].place;
  var shown = itemShown(slot);
  return "the " + shown.n + " " + t.cells[cell].place + (slot.added ? " (with a " + slot.added.n + " beside it)" : "");
}

/* ---- flow: each function returns the next screen name ---- */
function newGame(opts) {
  opts = opts || {};
  if (typeof opts.mode === "number") S.mode = opts.mode;
  if (typeof opts.level === "number") S.level = opts.level;
  if (typeof opts.themePick === "number") S.themePick = opts.themePick;
  if (typeof opts.seed === "number") setSeed(opts.seed);
  S.themeIdx = S.themePick === 6 ? Math.floor(rand() * THEMES.length) : S.themePick;
  S.round = 0; S.rounds = []; S.score = 0; S.p1score = 0; S.p2score = 0;
  S.spotter = 0; S.switcherOptions = null; S.switcherChoice = null;
  S.tapped = null; S.unlocked = null;
  dealRound();
  S.screen = "study";
  logEvent("newGame", { mode: MODES[S.mode], level: S.level, theme: theme().id, seed: S.seed });
  return S.screen;
}
function pickMode(i) { S.mode = i; logEvent("pickMode", { mode: MODES[i] }); return S.screen; }
function pickLevel(l) { if (isUnlocked(l)) { S.level = l; logEvent("pickLevel", { level: l }); } return S.screen; }
function pickTheme(i) { S.themePick = i; logEvent("pickTheme", { themePick: i }); return S.screen; }
function goHome() { S.screen = "home"; return S.screen; }
function startOver() {
  /* Keep the mute flag. audio.js keeps its own in-memory copy and
     writes localStorage directly, so S.progress (loaded once at page
     load) goes stale the moment mute is toggled afterwards. Re-read
     the live value instead of trusting S.progress.muted:
     PilotAudio.isMuted() first, else the stored JSON's muted field,
     else the in-memory copy as a last resort. */
  var muted = undefined;
  try {
    if (typeof PilotAudio !== "undefined" && PilotAudio &&
        typeof PilotAudio.isMuted === "function") muted = PilotAudio.isMuted();
  } catch (e) {}
  if (muted === undefined) {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(PILOT_STORE_KEY);
        if (raw) {
          var stored = JSON.parse(raw);
          if (stored && typeof stored.muted === "boolean") muted = stored.muted;
        }
      }
    } catch (e) {}
  }
  if (muted === undefined && S.progress) muted = S.progress.muted;
  S.progress = { unlocked: 1, caught: (S.progress.caught || {}), cleared: (S.progress.cleared || {}) };
  if (muted !== undefined) S.progress.muted = muted;
  saveProgress();
  S.level = 1;
  logEvent("startOver", {});
  return S.screen;
}
/* From Study "I'm ready": Together mode goes to the Sneaky Switcher
   picker; every other mode generates the switches and goes to Curtain. */
function readyStudy() {
  var r = S.rounds[S.round];
  if (S.mode === 1) {
    offerSwitcherOptions();
    S.screen = "switcher";
  } else {
    generateSwitches(r);
    S.screen = "curtain";
  }
  logEvent("readyStudy", { screen: S.screen });
  return S.screen;
}
function pickSwitcherOption(i) {
  var opts = S.switcherOptions || [];
  if (!opts[i]) return S.screen;
  S.switcherChoice = opts[i];
  S.switcherOptions = null;
  generateSwitches(S.rounds[S.round]);
  S.screen = "curtain";
  logEvent("pickSwitcherOption", { type: S.switcherChoice.type, cell: S.switcherChoice.cell });
  return S.screen;
}
/* From Curtain: Levels 4-5 go through the distractor first. */
function goCurtain() {
  S.screen = levelDef().distractor ? "distractor" : "spot";
  if (S.screen === "distractor") {
    S.distractorTiles = shuffle(DISTRACTOR_TILES.slice());
    S.distractorPicked = [];
  }
  logEvent("goCurtain", { screen: S.screen });
  return S.screen;
}
function tapDistractor(i) {
  var p = S.distractorPicked.indexOf(i);
  if (p >= 0) S.distractorPicked.splice(p, 1);
  else S.distractorPicked.push(i);
  return S.screen;
}
function goSpot() { S.screen = "spot"; return S.screen; }
/* Spot tap: records the tapped cell; the scene shows the confirm step.
   confirmSpot() is what counts the answer - a tap alone never scores.
   Guarded: only a tap while on the Spot screen - or its L4-5 anteroom,
   the distractor, which sits immediately before Spot and is the screen
   the spot-rule headless path taps from - opens a confirm. A tap from
   any other screen (e.g. Reveal) is a no-op, so it cannot reopen the
   confirm overlay. No scene calls tapCell from the distractor (its
   tiles call tapDistractor), so this admits no real-UI path. */
function tapCell(i) {
  if (S.screen !== "spot" && S.screen !== "distractor") return S.screen;
  S.tapped = i; S.screen = "confirm"; logEvent("tapCell", { cell: i }); return S.screen;
}
function cancelSpot() { S.tapped = null; S.screen = "spot"; return S.screen; }
/* Guarded: a confirm only counts while on the confirm step with a
   tapped cell. A second confirm (double-tapped YES) must not re-score
   the round - the first confirm already cleared S.tapped and moved
   on, and scoring null as a miss would flip a correct round to wrong
   and, in Versus, swallow Player 2's turn. */
function confirmSpot() {
  if (S.screen !== "confirm" || S.tapped === null) return S.screen;
  var r = S.rounds[S.round];
  var cell = S.tapped;
  var ok = spotCorrect(cell);
  var sw = spottedSwitch(cell);
  if (S.mode === 2) {
    if (S.spotter === 0) {
      r.p1pick = cell; r.p1correct = ok; r.spotted = sw;
      if (ok) { S.p1score++; recordCaught(sw); }
      S.spotter = 1;
      S.tapped = null;
      S.screen = "versus-pass";
      logEvent("confirmSpot", { player: 1, cell: cell, correct: ok });
      return S.screen;
    }
    r.p2pick = cell; r.p2correct = ok;
    if (ok) { S.p2score++; recordCaught(sw); }
    S.tapped = null;
    S.screen = "reveal";
    logEvent("confirmSpot", { player: 2, cell: cell, correct: ok });
    return S.screen;
  }
  r.picked = cell; r.correct = ok; r.spotted = sw;
  if (ok) { S.score++; recordCaught(sw); }
  S.tapped = null;
  S.screen = "reveal";
  logEvent("confirmSpot", { cell: cell, correct: ok });
  return S.screen;
}
function nextRound() {
  if (S.round + 1 < ROUNDS_PER_GAME) {
    S.round++;
    S.spotter = S.mode === 1 ? S.round % 2 : 0;
    S.switcherChoice = null;
    dealRound();
    S.screen = "study";
  } else {
    finishGame();
    S.screen = "result";
  }
  logEvent("nextRound", { screen: S.screen, round: S.round });
  return S.screen;
}
function finishGame() {
  var best = S.mode === 2 ? Math.max(S.p1score, S.p2score) : S.score;
  if (best >= UNLOCK_SCORE && S.level === S.progress.unlocked && S.level < 5) {
    S.progress.unlocked = S.level + 1;
    saveProgress();
    S.unlocked = S.level + 1;
  }
  if (best === ROUNDS_PER_GAME) {
    if (!S.progress.cleared || typeof S.progress.cleared !== "object") S.progress.cleared = {};
    S.progress.cleared[THEMES[S.themeIdx].id] = true;
    saveProgress();
  }
  logEvent("finishGame", { best: best, unlocked: S.unlocked });
}
function playAgain() { return newGame(); }

/* ---- test snapshot: plain JSON-safe object, no live references ---- */
function describeSlot(slot) {
  if (!slot) return null;
  var shown = itemShown(slot);
  return { cell: slot.cell, emoji: shown.e, name: shown.n,
    added: slot.added ? { emoji: slot.added.e, name: slot.added.n } : null };
}
function getState() {
  var r = S.rounds[S.round] || null;
  return {
    version: PILOT_VERSION, seed: S.seed, screen: S.screen,
    mode: MODES[S.mode], modeIndex: S.mode, level: S.level, levelName: LEVELS[S.level].name,
    themePick: S.themePick, theme: theme().id, themeName: theme().name,
    round: S.round + 1, roundsTotal: ROUNDS_PER_GAME,
    score: S.score, p1score: S.p1score, p2score: S.p2score, spotter: S.spotter + 1,
    unlockedLevel: S.progress.unlocked, unlockedNew: S.unlocked,
    progress: { unlocked: S.progress.unlocked,
      caught: Object.keys(S.progress.caught || {}),
      cleared: Object.keys(S.progress.cleared || {}) },
    roundState: r ? {
      slots: r.slots.map(describeSlot),
      switches: r.switches.map(function (sw) {
        return { type: sw.type, cell: sw.cell, toCell: sw.toCell || null,
          otherCell: sw.otherCell || null, desc: sw.desc };
      }),
      changedCells: r.changedCells.slice(),
      changed: r.changed ? r.changed.map(describeSlot) : null,
      picked: r.picked, correct: r.correct,
      p1pick: r.p1pick, p1correct: r.p1correct, p2pick: r.p2pick, p2correct: r.p2correct
    } : null,
    log: S.log.slice(-20)
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { S: S, setSeed: setSeed, mulberry32: mulberry32,
    shuffle: shuffle, pickOne: pickOne, itemShown: itemShown, slotKey: slotKey,
    theme: theme, levelDef: levelDef, loadProgress: loadProgress, saveProgress: saveProgress,
    isUnlocked: isUnlocked, dealRound: dealRound, makeSwitch: makeSwitch,
    generateSwitches: generateSwitches, offerSwitcherOptions: offerSwitcherOptions,
    switchOptionText: switchOptionText, spotCorrect: spotCorrect,
    spottedSwitch: spottedSwitch, cellDescription: cellDescription,
    newGame: newGame, pickMode: pickMode, pickLevel: pickLevel, pickTheme: pickTheme,
    goHome: goHome, startOver: startOver, readyStudy: readyStudy,
    pickSwitcherOption: pickSwitcherOption, goCurtain: goCurtain,
    tapDistractor: tapDistractor, goSpot: goSpot, tapCell: tapCell,
    cancelSpot: cancelSpot, confirmSpot: confirmSpot, nextRound: nextRound,
    finishGame: finishGame, playAgain: playAgain, getState: getState };
}
