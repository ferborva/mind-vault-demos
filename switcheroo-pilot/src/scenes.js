"use strict";
/* Switcheroo! AAA pilot - real gameplay scenes.
   Phaser layer over the deterministic core in src/core.js: every rule
   (deals, switches, unlocks, modes, confirm step, distractor) is the
   core's - scenes only draw, animate and play sound. Do not duplicate
   rules here; call the core functions.
   Art: backdrops + mascot + icons + 24 item sprites from assets/
   (see ASSET-LIST.md). Items with no illustrated sprite yet fall back
   to large emoji in the punk style - flagged PLACEHOLDER where it
   happens, so a later illustration batch can swap them in by adding
   one line to SPRITE_FOR_NAME.
   Audio: window.PilotAudio (src/audio.js, plain script). Motion:
   window.Juice (src/juice.js, ES module, loaded by src/bootstrap.js).
   Both are treated as optional enhancements: every call goes through
   a guard, so the game still plays if either failed to load (for
   example the file:// fallback path, where ES modules are blocked).
   Tap targets: buttons 96 logical units tall, grid cells 150, theme
   buttons 88 wide. On a 360 CSS px wide phone (0.5x scale) that is
   48 / 75 / 44 CSS px - at or above the 44 px minimum.
   White Hat: no timers, no streaks, no countdowns, no coins or shop,
   no daily-return pressure. Score is accuracy only ("X of 6").
   Failure copy is "So close", never "Wrong" / "I don't understand". */

var INK = 0x141414;
var PAPER = 0xfffbe8;
var WHITE = 0xffffff;
var PINK = 0xff2e88;
var YELLOW = 0xffd400;
var LIME = 0x7dff2e;
var PURPLE = 0x7b2eff;
var CYAN = 0x00d4ff;
var ORANGE = 0xff6b00;
var GREY = 0xb9c9c4;
var TITLE_FONT = '"Arial Black", system-ui, sans-serif';
var BODY_FONT = 'system-ui, sans-serif';

/* Theme accent colours (STYLE-GUIDE.md §1): board frame + label only,
   never the whole board. Space uses yellow - its backdrop is dark. */
var THEME_ACCENT = {
  bedroom: 0xff2e88, kitchen: 0xff6b00, pirate: 0x0b3d91,
  space: 0xffd400, garden: 0x2e8b2e, classroom: 0xe6a800
};

/* Item name (as shown by core itemShown) -> preloaded sprite texture.
   24 illustrated sprites + "space cat" sharing the cat sprite.
   Every other item name falls back to emoji (PLACEHOLDER, ASSET-LIST §5). */
var SPRITE_FOR_NAME = {
  "cat": "sprite-cat", "space cat": "sprite-cat",
  "red ball": "sprite-ball-red", "blue ball": "sprite-ball-blue",
  "green ball": "sprite-ball-green",
  "red apple": "sprite-apple-red", "green apple": "sprite-apple-green",
  "teddy": "sprite-teddy", "pizza": "sprite-pizza",
  "rubber duck": "sprite-duck", "telescope": "sprite-telescope",
  "parrot": "sprite-parrot", "rocket": "sprite-rocket",
  "alien": "sprite-alien", "frog": "sprite-frog", "fish": "sprite-fish",
  "red book": "sprite-book-red", "green book": "sprite-book-green",
  "blue book": "sprite-book-blue",
  "mouse": "sprite-mouse", "ladybird": "sprite-ladybird",
  "ant": "sprite-ant", "spider": "sprite-spider",
  "bee": "sprite-bee", "butterfly": "sprite-butterfly"
};

/* Map core screen names to Phaser scene keys. */
var SCENE_FOR_SCREEN = {
  home: "Home", study: "Study", switcher: "Switcher", curtain: "Curtain",
  distractor: "Distractor", spot: "Spot", "versus-pass": "VersusPass",
  reveal: "Reveal", result: "Result"
};
function goTo(scene, screen) {
  scene.scene.start(SCENE_FOR_SCREEN[screen] || "Home");
}

/* ---- juice (motion) - optional, guarded ---- */
function J() {
  return (typeof window !== "undefined" && window.Juice) || null;
}
function jPopIn(scene, target, opts) { var z = J(); return z ? z.popIn(scene, target, opts) : null; }
function jSlideUp(scene, target, opts) { var z = J(); return z ? z.slideUp(scene, target, opts) : null; }
function jFadeIn(scene, target, opts) { var z = J(); return z ? z.fadeIn(scene, target, opts) : null; }
function jBreathe(target, opts) { var z = J(); return z ? z.breathe(target, opts) : null; }
function jFloaty(target, opts) { var z = J(); return z ? z.floaty(target, opts) : null; }
function jSquash(target, opts) { var z = J(); return z ? z.squashStretch(target, opts) : null; }
function jBurst(scene, x, y, colors, opts) { var z = J(); return z ? z.burst(scene, x, y, colors, opts) : null; }
function jCelebrateReveal(scene, x, y, opts) { var z = J(); return z ? z.celebrateReveal(scene, x, y, opts) : false; }
function jGentleMiss(scene, x, y, opts) { var z = J(); return z ? z.gentleMiss(scene, x, y, opts) : null; }
function jCelebrateWin(scene, x, y, opts) { var z = J(); return z ? z.celebrateWin(scene, x, y, opts) : false; }
function jCurtainSneak(scene, mascot, opts) { var z = J(); return z ? z.curtainSneak(scene, mascot, opts) : null; }
function jShake(scene, intensity, opts) { var z = J(); return z ? z.shake(scene, intensity, opts) : null; }
function jVibrate(pattern) { var z = J(); return z ? z.vibrate(pattern) : false; }
function jCleanup(scene) { var z = J(); if (z) z.cleanupJuice(scene); }

/* ---- audio - optional, guarded ---- */
function audioObj() {
  return (typeof PilotAudio !== "undefined") ? PilotAudio : null;
}
/* First pointer handler: unlock the AudioContext, then start the
   ambient pad (home + study). Safe to call on every pointer event. */
function unlockAudio() {
  var a = audioObj();
  if (!a) return;
  try { a.unlock(); a.startAmbient(); } catch (e) {}
}
function playSfx(name) {
  var a = audioObj();
  if (!a || !a[name]) return;
  try { a[name](); } catch (e) {}
}
function wireAudio(scene) {
  scene.input.on("pointerdown", function () { unlockAudio(); });
}
function wireCleanup(scene) {
  scene.events.once("shutdown", function () { jCleanup(scene); });
}

/* ---- shared UI helpers ---- */
function stripe(scene) {
  var cols = [PINK, YELLOW, LIME, CYAN, PURPLE];
  for (var i = 0; i < 5; i++) {
    scene.add.rectangle(i * 144 + 72, 6, 144, 12, cols[i]).setOrigin(0.5);
  }
}
function dots(scene) {
  if (scene.textures.exists("dotpaper")) {
    scene.add.tileSprite(360, 640, 720, 1280, "dotpaper").setDepth(-10);
  }
}
function punkButton(scene, cx, y, w, label, cb, opts) {
  opts = opts || {};
  var h = opts.height || 96;
  var fill = opts.fill !== undefined ? opts.fill : WHITE;
  var textColor = opts.textColor || "#141414";
  var fontSize = opts.fontSize || 30;
  /* Container sits at (cx, y) with children relative to it, so the
     press squash pivots on the button's centre, not the screen corner. */
  var shadow = scene.add.rectangle(6, 6, w, h, INK);
  var bg = scene.add.rectangle(0, 0, w, h, fill);
  bg.setStrokeStyle(4, INK);
  var labelText = scene.add.text(0, 0, label, {
    fontFamily: BODY_FONT, fontSize: fontSize + "px", fontStyle: "800",
    color: textColor, align: "center", wordWrap: { width: w - 24 }
  }).setOrigin(0.5);
  var hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  var container = scene.add.container(cx, y, [shadow, bg, labelText, hit]);
  if (opts.disabled) {
    container.setAlpha(0.55);
    /* Locked is not a mistake: a gentle 100 ms dip, no sound, no buzz. */
    hit.on("pointerdown", function () {
      scene.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97,
        duration: 100, yoyo: true });
    });
    return container;
  }
  hit.on("pointerdown", function () {
    unlockAudio();
    if (opts.sound !== "none") playSfx(opts.sound === "pick" ? "pick" : "tap");
    if (opts.haptic !== false) jVibrate([10]);
    scene.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: 60,
      yoyo: true, onComplete: function () { cb(); } });
  });
  return container;
}
function titleText(scene, text, y) {
  return scene.add.text(360, y, text, {
    fontFamily: TITLE_FONT, fontSize: "56px", color: "#141414", align: "center"
  }).setOrigin(0.5, 0);
}
function bodyText(scene, text, y, size) {
  return scene.add.text(360, y, text, {
    fontFamily: BODY_FONT, fontSize: (size || 28) + "px", color: "#141414",
    align: "center", wordWrap: { width: 648 }
  }).setOrigin(0.5, 0);
}
function smallText(scene, text, y) {
  return scene.add.text(360, y, text, {
    fontFamily: BODY_FONT, fontSize: "22px", color: "#4a4a4a",
    align: "center", wordWrap: { width: 648 }
  }).setOrigin(0.5, 0);
}
/* Advance y past a wrapped text block by its real rendered height.
   A fixed step collides with the next line whenever the text wraps
   (long descriptions wrap to 2 lines at 26 px, 4 lines at 22 px on
   the Result screen), so every desc block that can wrap uses this
   instead of a fixed y step. Phaser Text exposes .height once
   created; the fallback (one line at 1.2x the font size) only matters
   for headless stubs with no text metrics - it keeps y numeric,
   never NaN. */
function textAdvance(text, size, gap) {
  var h = (text && typeof text.height === "number" && isFinite(text.height) && text.height > 0)
    ? text.height : size * 1.2;
  return h + (gap === undefined ? 12 : gap);
}
/* Round counter pill: ink pill, white text - the live game's .progress. */
function progressLine(scene, y) {
  return scene.add.text(360, y, "Round " + (S.round + 1) + " of " + ROUNDS_PER_GAME +
    "  -  Level " + S.level + " " + LEVELS[S.level].name, {
    fontFamily: BODY_FONT, fontSize: "22px", fontStyle: "800", color: "#ffffff",
    backgroundColor: "#141414", padding: { x: 14, y: 8 }
  }).setOrigin(0.5, 0);
}
/* Mute toggle drawn from PilotAudio.isMuted(). Sits top-right on Home
   and Result. Uses the illustrated speaker / mute icons when loaded. */
function muteButton(scene, x, y) {
  var a = audioObj();
  var muted = a ? a.isMuted() : false;
  var key = muted ? "icon-mute" : "icon-speaker";
  var img;
  if (scene.textures.exists(key)) {
    img = scene.add.image(x, y, key);
    img.setDisplaySize(56, 56);
  } else {
    img = scene.add.text(x, y, muted ? "🔇" : "🔊", { fontSize: "40px" }).setOrigin(0.5);
  }
  var zone = scene.add.zone(x, y, 88, 88).setInteractive({ useHandCursor: true });
  zone.on("pointerdown", function () {
    unlockAudio();
    var now = a ? a.setMuted(!a.isMuted()) : false;
    var nk = now ? "icon-mute" : "icon-speaker";
    if (img.setTexture && scene.textures.exists(nk)) img.setTexture(nk);
    if (img.setText) img.setText(now ? "🔇" : "🔊");
    jVibrate([10]);
  });
  return zone;
}
/* Slide a set of already-placed objects in from the right (Versus pass). */
function slideInFromRight(scene, items) {
  items.forEach(function (o) { o.x += 720; });
  scene.tweens.add({ targets: items, x: "-=720", duration: 280, ease: "Cubic.easeOut" });
}

/* ---- the scene grid ----
   Cells are WHITE with a 3px ink border on every backdrop - essential
   on the dark-purple space backdrop, where transparent cells would be
   unreadable. Containers sit at each cell's centre so scale tweens
   (pops, pulses, stagger) pivot on the cell, not the screen corner.
   Returns the 12 cell containers, each with .cellIndex/.cellX/.cellY. */
function cellContent(scene, slot, cellSize) {
  var shown = itemShown(slot);
  var out = [];
  var target = Math.round(cellSize * 0.62);
  var key = SPRITE_FOR_NAME[shown.n];
  if (key && scene.textures.exists(key)) {
    var img = scene.add.image(0, 0, key);
    var src = scene.textures.get(key).getSourceImage();
    img.setScale(target / Math.max(src.width, src.height));
    out.push(img);
  } else {
    /* PLACEHOLDER: large emoji in the punk style, as in the live game.
       No illustrated sprite exists for this item yet (ASSET-LIST.md §5).
       To swap in art later, add one line to SPRITE_FOR_NAME above. */
    out.push(scene.add.text(0, 0, shown.e, {
      fontFamily: BODY_FONT, fontSize: Math.round(cellSize * 0.48) + "px", color: "#141414"
    }).setOrigin(0.5));
  }
  if (slot.added) {
    var ax = Math.round(cellSize * 0.32), ay = Math.round(cellSize * 0.32);
    var at = Math.round(cellSize * 0.28);
    var akey = SPRITE_FOR_NAME[slot.added.n];
    if (akey && scene.textures.exists(akey)) {
      var aimg = scene.add.image(ax, ay, akey);
      var asrc = scene.textures.get(akey).getSourceImage();
      aimg.setScale(at / Math.max(asrc.width, asrc.height));
      out.push(aimg);
    } else {
      /* PLACEHOLDER: same emoji fallback for a sneaked-in small. */
      out.push(scene.add.text(ax, ay, slot.added.e, {
        fontFamily: BODY_FONT, fontSize: at + "px", color: "#141414"
      }).setOrigin(0.5));
    }
  }
  return out;
}
function drawGrid(scene, slots, y0, cellSize, gap, onTap, highlightCells, highlightFill, x0override, opts) {
  opts = opts || {};
  cellSize = cellSize || 150; gap = gap || 20;
  var totalW = 4 * cellSize + 3 * gap;
  var x0 = (typeof x0override === "number") ? x0override : (720 - totalW) / 2;
  var cells = [];
  for (var i = 0; i < 12; i++) {
    var col = i % 4, row = Math.floor(i / 4);
    var cx = x0 + col * (cellSize + gap) + cellSize / 2;
    var cy = y0 + row * (cellSize + gap) + cellSize / 2;
    var slot = slots[i];
    var isHl = highlightCells && highlightCells.indexOf(i) >= 0;
    var fill = isHl && highlightFill !== undefined ? highlightFill : (slot ? WHITE : PAPER);
    var bg = scene.add.rectangle(0, 0, cellSize, cellSize, fill);
    bg.setStrokeStyle(slot || isHl ? 4 : 3, INK);
    var parts = [bg];
    if (slot) parts = parts.concat(cellContent(scene, slot, cellSize));
    if (isHl && opts.hitStar) {
      parts.push(scene.add.text(cellSize / 2 - 12, -cellSize / 2 + 14, "⭐", {
        fontSize: "22px"
      }).setOrigin(0.5));
    }
    var cell = scene.add.container(cx, cy, parts);
    cell.cellIndex = i; cell.cellX = cx; cell.cellY = cy;
    if (onTap) {
      (function (idx, container) {
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerdown", function () { onTap(idx, container); });
      })(i, cell);
    }
    cells.push(cell);
    if (opts.stagger) {
      /* Study entry: tidy deal, 25 ms stagger, then everything stops. */
      cell.setScale(0.9);
      cell.setAlpha(0);
      scene.tweens.add({ targets: cell, scaleX: 1, scaleY: 1, alpha: 1,
        duration: 200, delay: i * 25, ease: "Cubic.easeOut" });
    }
  }
  return cells;
}
function gridCellCenter(x0, y0, cellSize, gap, idx) {
  var col = idx % 4, row = Math.floor(idx / 4);
  return { x: x0 + col * (cellSize + gap) + cellSize / 2,
    y: y0 + row * (cellSize + gap) + cellSize / 2 };
}
/* Opaque palette backdrop BEHIND the grid, never a transparent overlay,
   with a theme-accent frame around the board area. */
function themeBackdrop(scene, y, h) {
  var t = theme();
  var key = "backdrop-" + t.id;
  if (scene.textures.exists(key)) {
    scene.add.image(360, y + h / 2, key).setDisplaySize(720, h).setDepth(-5);
  }
  var acc = THEME_ACCENT[t.id] || PINK;
  scene.add.rectangle(360, y + h / 2, 700, h + 16)
    .setStrokeStyle(6, acc).setFillStyle(acc, 0).setDepth(-4);
}

/* ---- Boot: preload every asset, then Home ---- */
class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  preload() {
    var self = this;
    ["bedroom", "kitchen", "pirate", "space", "garden", "classroom"].forEach(function (t) {
      self.load.image("backdrop-" + t, "assets/backdrops/" + t + ".png");
    });
    self.load.image("mascot-sneaking", "assets/mascot/switcher-sneaking.png");
    self.load.image("mascot-peeking", "assets/mascot/switcher-peeking.png");
    self.load.image("mascot-caught", "assets/mascot/switcher-caught.png");
    ["star", "check", "so-close", "lock", "badge", "speaker", "mute",
     "play", "home", "replay"].forEach(function (n) {
      self.load.image("icon-" + n, "assets/icons/" + n + ".png");
    });
    var sprites = {
      "cat": "cat", "ball-red": "ball-red", "ball-blue": "ball-blue",
      "ball-green": "ball-green", "apple-red": "apple-red",
      "apple-green": "apple-green", "teddy": "teddy", "pizza": "pizza",
      "duck": "duck", "telescope": "telescope", "parrot": "parrot",
      "rocket": "rocket", "alien": "alien", "frog": "frog", "fish": "fish",
      "book-red": "book-red", "book-green": "book-green",
      "book-blue": "book-blue", "mouse": "mouse", "ladybird": "ladybird",
      "ant": "ant", "spider": "spider", "bee": "bee", "butterfly": "butterfly"
    };
    Object.keys(sprites).forEach(function (k) {
      self.load.image("sprite-" + k, "assets/sprites/" + sprites[k] + ".png");
    });
  }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    /* Cream dot paper texture, generated once (STYLE-GUIDE.md §2). */
    if (!this.textures.exists("dotpaper")) {
      var g = this.add.graphics();
      g.fillStyle(0x141414, 0.08);
      g.fillCircle(11, 11, 1.5);
      g.generateTexture("dotpaper", 22, 22);
      g.destroy();
    }
    dots(this);
    stripe(this);
    titleText(this, "SWITCHEROO!", 420);
    bodyText(this, "PILOT BUILD  •  Phaser " + Phaser.VERSION + "  •  pilot v" + PILOT_VERSION, 520, 26);
    smallText(this, "Loading the engine...", 600);
    logEvent("boot", { phaser: Phaser.VERSION, pilot: PILOT_VERSION });
    var self = this;
    this.time.delayedCall(500, function () { self.scene.start("Home"); });
  }
}

/* ---- Home: mode pick, level select, theme pick, gallery, start ---- */
class HomeScene extends Phaser.Scene {
  constructor() { super("Home"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    S.screen = "home";
    var self = this;
    var title = titleText(this, "SWITCHEROO!", 36);
    jPopIn(this, title, { from: 0.6, angle: -8, toAngle: -1.5, duration: 300 });
    var eyes = this.add.text(600, 44, "👀", { fontSize: "40px" }).setOrigin(0.5);
    jFloaty(eyes);
    muteButton(this, 668, 60);
    bodyText(this, "Practise remembering what you saw.", 128, 28);
    /* Mode pick: three buttons in a row. */
    bodyText(this, "Who is playing?", 182, 26);
    MODES.forEach(function (m, i) {
      punkButton(self, 132 + i * 228, 244, 204, m, function () {
        pickMode(i); self.scene.restart();
      }, { fill: S.mode === i ? YELLOW : WHITE, sound: "pick" });
    });
    /* Level pick: five numbered buttons in a row, name + blurb below. */
    bodyText(this, "Level - finish 4 of 6 to unlock the next", 312, 26);
    for (var l = 1; l <= 5; l++) {
      (function (lvl) {
        var locked = !isUnlocked(lvl);
        punkButton(self, 96 + (lvl - 1) * 132, 402, 120, locked ? lvl + " 🔒" : "" + lvl,
          function () { pickLevel(lvl); self.scene.restart(); },
          { fill: S.level === lvl ? LIME : WHITE, disabled: locked, fontSize: 34, sound: "pick" });
      })(l);
    }
    bodyText(this, "Level " + S.level + " - " + LEVELS[S.level].name + ": " + LEVELS[S.level].blurb, 470, 24);
    /* Theme pick: emoji-only buttons in one row (88 units wide = 44 CSS px
       on a 360 px wide phone at 0.5x scale), name below. */
    bodyText(this, "Scene", 528, 26);
    THEMES.forEach(function (t, i) {
      punkButton(self, 72 + i * 96, 600, 88, t.emoji, function () {
        pickTheme(i); self.scene.restart();
      }, { fill: S.themePick === i ? YELLOW : WHITE, fontSize: 40, sound: "pick" });
    });
    punkButton(self, 72 + 6 * 96, 600, 88, "🎲", function () {
      pickTheme(6); self.scene.restart();
    }, { fill: S.themePick === 6 ? YELLOW : WHITE, fontSize: 40, sound: "pick" });
    bodyText(this, S.themePick === 6 ? "Surprise me - a random scene each game"
      : THEMES[S.themePick].name, 668, 24);
    punkButton(self, 360, 762, 560, "START GAME", function () {
      newGame(); goTo(self, S.screen);
    }, { fill: PINK, textColor: "#ffffff", fontSize: 34 });
    punkButton(self, 360, 874, 560, "How to play", function () { self.scene.start("HowTo"); },
      { fontSize: 26 });
    punkButton(self, 360, 986, 560, "Caught Switches", function () { self.scene.start("Gallery"); },
      { fontSize: 26 });
    smallText(self, "Levels unlocked: " + S.progress.unlocked + " of 5  •  Switch types caught: " +
      Object.keys(S.progress.caught || {}).length + " of " + SWITCH_TYPES.length, 1052);
    punkButton(self, 200, 1140, 320, "Start over", function () {
      startOver(); self.scene.restart();
    }, { height: 88, fontSize: 22 });
    smallText(self, "Start over clears unlocked levels - your Caught Switches stay put.", 1188);
  }
}

/* ---- How to play (one screen, back to Home) ---- */
class HowToScene extends Phaser.Scene {
  constructor() { super("HowTo"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    titleText(this, "HOW TO PLAY", 40);
    var lines = [
      "👀 1. Study the scene.\nLook as long as you like. No rush.",
      "🙈 2. Look away.\nThe sneaky switcher is at work.",
      "🔍 3. Spot the switch.\nTap the thing you think changed.",
      "🎉 4. See what changed.\nBefore and after, side by side."
    ];
    var y = 150;
    var self = this;
    lines.forEach(function (line, idx) {
      var card = self.add.rectangle(360, y + 70, 648, 140, WHITE).setStrokeStyle(4, INK);
      var txt = self.add.text(360, y + 14, line, {
        fontFamily: BODY_FONT, fontSize: "26px", color: "#141414", align: "center",
        wordWrap: { width: 600 }
      }).setOrigin(0.5, 0);
      jSlideUp(self, card, { delay: idx * 40 });
      jSlideUp(self, txt, { delay: idx * 40 });
      y += 156;
    });
    bodyText(this, "Together mode: the non-spotter is the Sneaky Switcher and picks the change. " +
      "Versus mode: both study, then guess one at a time - the second player cannot copy the first.", y + 10, 24);
    punkButton(self, 360, y + 130, 560, "BACK", function () { self.scene.start("Home"); },
      { fill: PINK, textColor: "#ffffff" });
  }
}

/* ---- Caught Switches gallery: a record, not a currency ---- */
function galleryCard(scene, x, y, w, h, emoji, label, got, pill) {
  scene.add.rectangle(x + 5, y + 5, w, h, INK);
  var bg = scene.add.rectangle(x, y, w, h, got ? WHITE : PAPER);
  bg.setStrokeStyle(4, INK);
  var em = scene.add.text(x, y - h / 2 + 24, emoji, { fontSize: "36px" }).setOrigin(0.5, 0);
  var lb = scene.add.text(x, y + 6, label, {
    fontFamily: BODY_FONT, fontSize: "22px", fontStyle: "800", color: "#141414",
    align: "center", wordWrap: { width: w - 20 }
  }).setOrigin(0.5, 0);
  scene.add.text(x, y + h / 2 - 40, pill, {
    fontFamily: BODY_FONT, fontSize: "18px", fontStyle: "800", color: "#141414",
    backgroundColor: got ? "#7dff2e" : "#fffbe8", padding: { x: 10, y: 6 }
  }).setOrigin(0.5, 0);
  if (!got) { em.setAlpha(0.55); lb.setAlpha(0.7); }
}
class GalleryScene extends Phaser.Scene {
  constructor() { super("Gallery"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    titleText(this, "CAUGHT SWITCHES", 36);
    bodyText(this, "A record of what you have spotted - nothing to spend, nothing to buy, nothing that runs out. It only grows as you play.", 120, 24);
    var caught = (S.progress.caught && typeof S.progress.caught === "object") ? S.progress.caught : {};
    var cleared = (S.progress.cleared && typeof S.progress.cleared === "object") ? S.progress.cleared : {};
    var self = this;
    var nCaught = 0;
    SWITCH_TYPES.forEach(function (st, i) {
      var got = !!caught[st.type];
      if (got) nCaught++;
      var col = i % 2, row = Math.floor(i / 2);
      var cx = col === 0 ? 200 : 520;
      /* The fifth card sits centred on its own row. */
      if (i === 4) cx = 360;
      galleryCard(self, cx, 280 + row * 170, 310, 150, st.emoji, st.label,
        got, got ? "Caught!" : "Not caught yet");
    });
    bodyText(this, "Switch types caught: " + nCaught + " of " + SWITCH_TYPES.length + ".", 730, 24);
    bodyText(this, "Themes cleared 6 of 6", 780, 26);
    var nCleared = 0;
    THEMES.forEach(function (t, i) {
      var got = !!cleared[t.id];
      if (got) nCleared++;
      var cx = 140 + (i % 3) * 220, cy = 870 + Math.floor(i / 3) * 120;
      galleryCard(self, cx, cy, 200, 110, t.emoji, t.name.replace("The ", ""),
        got, got ? "Cleared!" : "Not yet");
    });
    smallText(this, "Themes cleared: " + nCleared + " of " + THEMES.length +
      ". A theme counts as cleared when you spot all 6 switches in one game there.", 1065);
    var self2 = this;
    punkButton(this, 360, 1160, 560, "BACK", function () { self2.scene.start("Home"); },
      { fill: PINK, textColor: "#ffffff" });
  }
}

/* ---- Study ---- */
class StudyScene extends Phaser.Scene {
  constructor() { super("Study"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    var t = theme();
    var r = S.rounds[S.round];
    titleText(this, t.emoji + " " + t.name, 30);
    progressLine(this, 120);
    if (S.mode === 1) {
      bodyText(this, "Player " + (S.spotter + 1) + " is spotting - Player " + (2 - S.spotter) + " is the Sneaky Switcher.", 168, 24);
    } else if (S.mode === 2) {
      bodyText(this, "Study together - then guess one at a time.", 168, 24);
    }
    bodyText(this, "Study the scene. Look as long as you like.", 202, 26);
    themeBackdrop(this, 245, 500);
    drawGrid(this, r.slots, 255, 150, 20, null, null, undefined, undefined, { stagger: true });
    var self = this;
    /* The board is a still photograph from here until the curtain falls:
       no idle motion anywhere on it. Only this button may breathe. */
    var readyBtn = punkButton(self, 360, 850, 560, "I'M READY", function () {
      goTo(self, readyStudy());
    }, { fill: PINK, textColor: "#ffffff", fontSize: 34 });
    jBreathe(readyBtn);
  }
}

/* ---- Switcher (Together mode: Sneaky Switcher picks) ---- */
class SwitcherScene extends Phaser.Scene {
  constructor() { super("Switcher"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    titleText(this, "SNEAKY SWITCHER", 40);
    bodyText(this, "Player " + (2 - S.spotter) + ", pick one change.\nPlayer " + (S.spotter + 1) + ", look away for a moment.", 130, 26);
    var opts = S.switcherOptions || [];
    var self = this;
    var y = 300;
    opts.forEach(function (sw, i) {
      punkButton(self, 360, y, 600, switchOptionText(sw), function () {
        goTo(self, pickSwitcherOption(i));
      }, { fontSize: 28, sound: "pick" });
      y += 120;
    });
    if (!opts.length) {
      bodyText(this, "No switch options this round - tap to carry on.", y, 26);
      punkButton(self, 360, y + 100, 560, "CARRY ON", function () {
        goTo(self, readyStudy());
      }, { fill: PINK, textColor: "#ffffff" });
    }
  }
}

/* ---- Curtain ---- */
class CurtainScene extends Phaser.Scene {
  constructor() { super("Curtain"); }
  create() {
    this.cameras.main.setBackgroundColor(PINK);
    wireAudio(this);
    wireCleanup(this);
    stripe(this);
    this.add.rectangle(360, 420, 648, 300, WHITE).setStrokeStyle(4, INK);
    this.add.text(360, 320, "THE SNEAKY SWITCHER\nIS AT WORK...", {
      fontFamily: TITLE_FONT, fontSize: "40px", color: "#141414", align: "center"
    }).setOrigin(0.5, 0);
    var whisper = this.add.text(360, 480, "Something in the scene just changed.\nCan you remember what was where?", {
      fontFamily: BODY_FONT, fontSize: "26px", color: "#141414", align: "center"
    }).setOrigin(0.5, 0);
    jFadeIn(this, whisper, { duration: 600 });
    playSfx("curtain");
    /* The mascot crosses the curtain; the sneak is interruptible and
       its tween is killed cleanly on exit (shutdown cleanup + button). */
    var mascot = null;
    if (this.textures.exists("mascot-sneaking")) {
      mascot = this.add.image(-40, 560, "mascot-sneaking");
      var src = this.textures.get("mascot-sneaking").getSourceImage();
      mascot.setScale(200 / Math.max(src.width, src.height));
    }
    jCurtainSneak(this, mascot, { y: 560 });
    /* No Juice (file:// fallback): park the mascot centre-stage instead
       of leaving it off-screen at x -40. */
    if (!J() && mascot) mascot.setPosition(360, 560);
    var self = this;
    var spotBtn = punkButton(self, 360, 800, 560, levelDef().distractor ? "READY" : "SPOT IT!", function () {
      jCleanup(self);
      goTo(self, goCurtain());
    }, { fill: YELLOW, fontSize: 34 });
    jBreathe(spotBtn);
  }
}

/* ---- Distractor (Levels 4-5: tap all the blue things, untimed) ---- */
class DistractorScene extends Phaser.Scene {
  constructor() { super("Distractor"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    titleText(this, "A QUICK DISTRACTION", 40);
    bodyText(this, "Tap all the blue things. Take your time -\nthis is just a distraction, not a test.", 130, 26);
    var self = this;
    S.distractorTiles.forEach(function (tile, i) {
      var col = i % 3, row = Math.floor(i / 3);
      var cx = 180 + col * 180, cy = 300 + row * 130;
      var bg = self.add.rectangle(cx, cy, 150, 100, WHITE).setOrigin(0.5).setStrokeStyle(4, INK);
      var label = self.add.text(cx, cy, tile, { fontSize: "56px" }).setOrigin(0.5);
      var tileObj = self.add.container(cx, cy, [bg, label]);
      jPopIn(self, tileObj, { from: 0.6, duration: 220, delay: i * 30 });
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", function () {
        unlockAudio();
        playSfx("pick");
        jVibrate([10]);
        jSquash(tileObj);
        tapDistractor(i);
        var picked = S.distractorPicked.indexOf(i) >= 0;
        bg.setFillStyle(picked ? PINK : WHITE);
        tileObj.setAngle(picked ? -2 : 0);
      });
    });
    punkButton(self, 360, 780, 560, "SPOT IT!", function () {
      jBurst(self, 360, 780, [PINK, YELLOW, LIME], { count: 6 });
      goTo(self, goSpot());
    }, { fill: PINK, textColor: "#ffffff", fontSize: 34 });
  }
}

/* ---- Spot (with confirm overlay - a tap alone never counts) ---- */
class SpotScene extends Phaser.Scene {
  constructor() { super("Spot"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    var r = S.rounds[S.round];
    titleText(this, "SPOT THE SWITCH", 30);
    progressLine(this, 120);
    if (S.mode === 2) bodyText(this, "Player " + (S.spotter + 1) + ", your turn to spot.", 168, 24);
    else if (S.mode === 1) bodyText(this, "Player " + (S.spotter + 1) + ", spot the switch.", 168, 24);
    bodyText(this, "Tap the thing you think changed. One tap only.", 202, 26);
    themeBackdrop(this, 245, 500);
    var self = this;
    this.pickedCell = null;
    drawGrid(this, r.changed, 255, 150, 20, function (idx, cell) { self.showConfirm(idx, cell); });
    this.confirmLayer = this.add.container(0, 0).setVisible(false);
    var dim = this.add.rectangle(360, 640, 720, 1280, 0x141414, 0.45).setOrigin(0.5);
    var panel = this.add.rectangle(360, 640, 620, 420, WHITE).setStrokeStyle(4, INK);
    this.confirmLabel = this.add.text(360, 520, "", {
      fontFamily: BODY_FONT, fontSize: "30px", color: "#141414", align: "center",
      wordWrap: { width: 540 }
    }).setOrigin(0.5, 0);
    var yesBtn = punkButton(this, 360, 760, 480, "YES, THAT'S IT", function () {
      /* No correct/wrong sound here - the Reveal plays it. */
      goTo(self, confirmSpot());
    }, { fill: LIME, fontSize: 30 });
    var noBtn = punkButton(this, 360, 880, 480, "No, let me look again", function () {
      cancelSpot(); self.confirmLayer.setVisible(false);
    }, { fontSize: 26, haptic: false });
    this.confirmPanel = panel;
    this.confirmYes = yesBtn;
    this.confirmNo = noBtn;
    this.confirmLayer.add([dim, panel, this.confirmLabel, yesBtn, noBtn]);
  }
  showConfirm(idx, cell) {
    unlockAudio();
    playSfx("pick");
    jVibrate([10]);
    /* Lift the tapped cell to mark it as the current pick. It is a
       question, not an answer: no red, no shake, no flash. */
    if (this.pickedCell && this.pickedCell !== cell) {
      this.pickedCell.setScale(1);
      this.pickedCell.setAngle(0);
    }
    this.pickedCell = cell;
    var selfCell = cell;
    var sq = jSquash(cell, { onComplete: function () { selfCell.setScale(1.05); selfCell.setAngle(-1); } });
    if (!sq) { cell.setScale(1.05); cell.setAngle(-1); }
    tapCell(idx);
    this.confirmLabel.setText("Is this the switch?\n\nYou tapped " + cellDescription(idx) + ".");
    this.confirmLayer.setVisible(true);
    /* Pop the dialog pieces, not the layer itself: the layer sits at
       (0, 0), so scaling it would slide the whole dialog across the
       screen. Each piece pivots on its own centre. */
    jPopIn(this, this.confirmPanel, { from: 0.9, duration: 250 });
    jPopIn(this, this.confirmLabel, { from: 0.9, duration: 250 });
    jPopIn(this, this.confirmYes, { from: 0.9, duration: 250 });
    jPopIn(this, this.confirmNo, { from: 0.9, duration: 250 });
  }
}

/* ---- VersusPass: hides Player 1's answer from Player 2 ---- */
class VersusPassScene extends Phaser.Scene {
  constructor() { super("VersusPass"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    var title = titleText(this, "PLAYER 1 HAS GUESSED", 40);
    var body = bodyText(this, "Player 2 - your turn.\nPlayer 1, look away!", 150, 28);
    var self = this;
    var btn = punkButton(self, 360, 400, 560, "PLAYER 2, SPOT THE SWITCH", function () {
      goTo(self, goSpot());
    }, { fill: PINK, textColor: "#ffffff", fontSize: 28 });
    jBreathe(btn);
    /* Slides in from the right like a card being handed over. Player 1's
       pick is never shown, flashed or hinted at on this screen. */
    slideInFromRight(this, [title, body, btn]);
  }
}

/* ---- Reveal: before / after side by side ---- */
class RevealScene extends Phaser.Scene {
  constructor() { super("Reveal"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    var r = S.rounds[S.round];
    var hit = S.mode === 2 ? (r.p1correct || r.p2correct) : r.correct;
    titleText(this, "WHAT CHANGED", 30);
    var y = 120;
    var self = this;
    if (S.mode === 2) {
      bodyText(this, "Player 1 " + (r.p1correct ? "spotted it!" : "missed this one.") +
        "  Player 2 " + (r.p2correct ? "spotted it!" : "missed this one."), y, 26);
      y += 50;
      if (r.switches.length === 1) {
        var desc = r.switches[0] ? r.switches[0].desc : "";
        var versusDesc;
        if (r.p1correct && r.p2correct) versusDesc = bodyText(this, "Both of you spotted it! " + desc, y, 26);
        else if (r.p1correct) versusDesc = bodyText(this, "Player 1 spotted it! " + desc, y, 26);
        else if (r.p2correct) versusDesc = bodyText(this, "Player 2 spotted it! " + desc, y, 26);
        else versusDesc = bodyText(this, "So close - " + desc, y, 26);
        y += textAdvance(versusDesc, 26);
      }
      bodyText(this, "Player 1: " + S.p1score + "  -  Player 2: " + S.p2score, y, 30);
      y += 50;
    } else {
      if (r.correct) {
        bodyText(this, "⭐ GOTCHA! You got it! ⭐", y, 32);
        y += 50;
        var soloDesc = bodyText(this, r.spotted ? r.spotted.desc : "", y, 26);
        y += textAdvance(soloDesc, 26);
      } else {
        var missDesc = bodyText(this, "So close - " + (r.switches[0] ? r.switches[0].desc : ""), y, 26);
        y += textAdvance(missDesc, 26);
      }
      bodyText(this, "You have spotted " + S.score + " of " + (S.round + 1) + " switches so far.", y, 28);
      y += 50;
    }
    if (r.switches.length > 1) {
      var multiHead = bodyText(this, "Everything that changed:", y, 26);
      y += textAdvance(multiHead, 26, 8);
      r.switches.forEach(function (sw) {
        var swLine = bodyText(self, "• " + sw.desc, y, 24);
        y += textAdvance(swLine, 24, 8);
      });
      y += 10;
    }
    bodyText(this, "Before and after", y, 26); y += 44;
    var small = 64, gap = 8;
    var gridW = 4 * small + 3 * gap;
    var beforeX = (720 - (2 * gridW + 40)) / 2;
    this.add.text(beforeX + gridW / 2, y, "Before", {
      fontFamily: BODY_FONT, fontSize: "24px", color: "#4a4a4a"
    }).setOrigin(0.5, 0);
    this.add.text(beforeX + gridW + 40 + gridW / 2, y, "After", {
      fontFamily: BODY_FONT, fontSize: "24px", color: "#4a4a4a"
    }).setOrigin(0.5, 0);
    y += 36;
    var beforeCells = drawGrid(this, r.slots, y, small, gap, null, null, undefined, beforeX);
    var afterCells = drawGrid(this, r.changed, y, small, gap, null,
      r.changedCells, hit ? LIME : PINK, beforeX + gridW + 40, { hitStar: hit });
    beforeCells.forEach(function (c, i) { jFadeIn(self, c, { duration: 300, delay: i * 10 }); });
    /* The changed cells get the scale pop instead of a fade: never run
       an alpha tween and a scale tween on the same target at once. */
    afterCells.forEach(function (c, i) {
      if (r.changedCells.indexOf(i) < 0) jFadeIn(self, c, { duration: 300, delay: 60 + i * 10 });
    });
    var gridH = 3 * small + 2 * gap;
    var firstChanged = r.changedCells[0];
    if (firstChanged !== undefined && firstChanged !== null) {
      var afterX0 = beforeX + gridW + 40;
      var pos = gridCellCenter(afterX0, y, small, gap, firstChanged);
      if (hit) {
        /* The GOTCHA: changed cell pops, burst + confetti + sticker,
           peeking mascot, correct then reveal whoosh 150 ms apart. */
        var cell = afterCells[firstChanged];
        this.tweens.add({ targets: cell, scaleX: 1.18, scaleY: 1.18, duration: 350,
          ease: "Back.easeOut", yoyo: true, hold: 100,
          onComplete: function () { cell.setScale(1.06); } });
        jCelebrateReveal(this, pos.x, pos.y, { seed: S.seed });
        if (this.textures.exists("mascot-peeking")) {
          var masc = this.add.image(655, 100, "mascot-peeking");
          var msrc = this.textures.get("mascot-peeking").getSourceImage();
          masc.setScale(90 / Math.max(msrc.width, msrc.height));
          jPopIn(this, masc, { from: 0.6, duration: 350 });
        }
        playSfx("correct");
        this.time.delayedCall(150, function () { playSfx("reveal"); });
      } else {
        /* A miss is a look-again moment: slow warm pulse on the true
           cell, no red, no shake, no buzz, no X. */
        jGentleMiss(this, pos.x, pos.y, { target: afterCells[firstChanged] });
        if (this.textures.exists("icon-so-close")) {
          var sc = this.add.image(655, 60, "icon-so-close");
          sc.setDisplaySize(56, 56);
          jPopIn(this, sc, { from: 0.6, duration: 300 });
        }
        playSfx("wrong");
        this.time.delayedCall(150, function () { playSfx("reveal"); });
      }
    }
    var btnY = y + gridH + 90;
    punkButton(self, 360, btnY, 560,
      (S.round + 1 < ROUNDS_PER_GAME) ? "NEXT ROUND" : "SEE RESULTS", function () {
        goTo(self, nextRound());
      }, { fill: PINK, textColor: "#ffffff", fontSize: 30 });
  }
}

/* ---- Result ---- */
class ResultScene extends Phaser.Scene {
  constructor() { super("Result"); }
  create() {
    this.cameras.main.setBackgroundColor(PAPER);
    wireAudio(this);
    wireCleanup(this);
    dots(this);
    stripe(this);
    titleText(this, "RESULTS", 40);
    muteButton(this, 668, 60);
    var best = S.mode === 2 ? Math.max(S.p1score, S.p2score) : S.score;
    var versusWin = S.mode === 2 && S.p1score !== S.p2score;
    var y = 130;
    var self = this;
    /* Score box pops in; the number simply updates, it never counts up. */
    var scoreBox = this.add.container(360, y + 40);
    var scoreBg = this.add.rectangle(0, 0, 600, 84, YELLOW).setStrokeStyle(4, INK);
    var scoreText;
    if (S.mode === 2) {
      scoreText = this.add.text(0, 0, "Player 1: " + S.p1score + "  -  Player 2: " + S.p2score, {
        fontFamily: BODY_FONT, fontSize: "34px", fontStyle: "800", color: "#141414"
      }).setOrigin(0.5);
    } else {
      scoreText = this.add.text(0, 0, "You spotted " + S.score + " of " + ROUNDS_PER_GAME + " sneaky switches!", {
        fontFamily: BODY_FONT, fontSize: "30px", fontStyle: "800", color: "#141414", align: "center",
        wordWrap: { width: 560 }
      }).setOrigin(0.5);
    }
    scoreBox.add([scoreBg, scoreText]);
    jPopIn(this, scoreBox, { from: 0.6, duration: 350 });
    y += 110;
    if (S.mode === 2) {
      if (S.p1score > S.p2score) bodyText(this, "Player 1 takes it this time - rematch?", y, 26);
      else if (S.p2score > S.p1score) bodyText(this, "Player 2 takes it this time - rematch?", y, 26);
      else bodyText(this, "Too close to call - honours shared.", y, 26);
      y += 50;
    } else if (S.score <= 2) {
      bodyText(this, "Tricky switches this time - the cat fooled us both!", y, 26);
      y += 50;
    }
    /* Caught mascot on a perfect game or a level-up. */
    if ((best === ROUNDS_PER_GAME || S.unlocked) && this.textures.exists("mascot-caught")) {
      var masc = this.add.image(360, y + 70, "mascot-caught");
      var msrc = this.textures.get("mascot-caught").getSourceImage();
      masc.setScale(140 / Math.max(msrc.width, msrc.height));
      jPopIn(this, masc, { from: 0.6, duration: 350 });
      y += 150;
    }
    var missed = [];
    S.rounds.forEach(function (r, i) {
      var ok = S.mode === 2 ? (r.p1correct || r.p2correct) : r.correct;
      if (!ok) missed.push({ round: i + 1, switches: r.switches });
    });
    if (missed.length) {
      var awayHead = bodyText(this, "The ones that got away:", y, 26);
      y += textAdvance(awayHead, 26, 8);
      missed.forEach(function (m, mi) {
        var line = bodyText(self, "Round " + m.round + " - " +
          m.switches.map(function (sw) { return sw.desc; }).join(" "), y, 22);
        jFadeIn(self, line, { duration: 300, delay: mi * 60 });
        y += textAdvance(line, 22, 8);
      });
      y += 20;
    }
    if (S.unlocked) {
      var banner = this.add.container(360, y + 40);
      var bannerBg = this.add.rectangle(0, 0, 600, 84, LIME).setStrokeStyle(4, INK);
      var bannerText = this.add.text(0, 0, "New level unlocked: " + LEVELS[S.unlocked].name + "!", {
        fontFamily: BODY_FONT, fontSize: "28px", fontStyle: "800", color: "#141414", align: "center",
        wordWrap: { width: 560 }
      }).setOrigin(0.5);
      banner.add([bannerBg, bannerText]);
      jPopIn(this, banner, { from: 0.6, duration: 400 });
      jBurst(this, 360, y + 40, [LIME, YELLOW, PURPLE], { count: 20, seed: S.seed });
      playSfx("levelUp");
      jVibrate([30, 40, 30]);
      y += 110;
    } else if (S.level < 5) {
      bodyText(this, "Towards " + LEVELS[S.level + 1].name +
        ": finish a game with 4 of 6 to unlock it.", y, 24); y += 60;
    }
    if (!S.unlocked) {
      if (best === ROUNDS_PER_GAME || versusWin) {
        jCelebrateWin(this, 360, 170, { count: 24, seed: S.seed });
        jShake(this, 0.004, { duration: 120 });
        playSfx("win");
        /* celebrateWin already vibrates [30, 40, 30]; do not double it. */
      }
      /* Anything less than a perfect game or a win: no sound, no party.
         A good-but-not-perfect game is not a failed party. */
    }
    punkButton(self, 360, y + 48, 560, S.mode === 2 ? "REMATCH" : "PLAY AGAIN", function () {
      playAgain(); goTo(self, S.screen);
    }, { fill: PINK, textColor: "#ffffff", fontSize: 30 });
    y += 120;
    punkButton(self, 360, y + 48, 560, "CHANGE LEVEL / SCENE", function () {
      goHome(); goTo(self, S.screen);
    }, { fontSize: 26 });
    smallText(self, "A new game deals a fresh scene. Replay a level any time.", y + 120);
  }
}
