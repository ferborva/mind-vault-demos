/**
 * juice.js - Switcheroo! AAA pilot motion & feel helpers.
 *
 * Plain Phaser 3 helpers. No dependencies, no Phaser import: every helper
 * takes the `scene` (or a GameObject whose `.scene` is used) it needs, so
 * this works with the self-hosted Phaser build.
 *
 *   import * as juice from './juice.js';
 *   juice.popIn(scene, title);
 *   juice.celebrateReveal(scene, cellX, cellY);
 *   juice.cleanupJuice(scene);   // on shutdown / round rebuild
 *
 * White Hat rules baked in:
 *  - No helper ever shakes, flashes red, or buzzes on a miss.
 *    `gentleMiss` is a slow warm pulse only; `shake` is reserved for
 *    a Versus win / 6-of-6 and is a no-op under reduced motion.
 *  - Nothing here creates urgency: no countdowns, no speeding pulses.
 *  - Every helper respects `prefers-reduced-motion` (live-checked, with
 *    an optional override via `setReducedMotionOverride`).
 *  - Every helper cleans up after itself: tweens/emitters/objects are
 *    registered per scene and destroyed on completion; `cleanupJuice`
 *    is the safety net for scene shutdown and round transitions.
 *  - Haptics (`vibrate`) fire only on touch/mobile devices, only when
 *    `navigator.vibrate` exists, only in short gentle patterns.
 *
 * Deterministic test hook: pass `{ seed: <number> }` to `burst` /
 * `celebrateReveal` for a repeatable particle layout (tester-loop
 * screenshot checks). Without a seed the layout is random per call.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */

let reducedMotionOverride = null; // null = follow the system setting

export function setReducedMotionOverride(value) {
  // value: true | false | null (null = follow the system setting again)
  reducedMotionOverride = value === null ? null : Boolean(value);
}

export function prefersReducedMotion() {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch (e) { /* fall through: no reduction */ }
  return false;
}

/* ------------------------------------------------------------------ */
/* Palette (punk, from the live game - keep exactly)                   */
/* ------------------------------------------------------------------ */

export const PALETTE = {
  pink: 0xff2e88,
  yellow: 0xffd400,
  lime: 0x7dff2e,
  purple: 0x7b2eff,
  cyan: 0x00d4ff,
  orange: 0xff6b00,
  ink: 0x141414,
  paper: 0xfffbe8,
};

const BURST_COLORS = [
  PALETTE.pink, PALETTE.yellow, PALETTE.lime,
  PALETTE.purple, PALETTE.cyan, PALETTE.orange,
];

/* ------------------------------------------------------------------ */
/* Per-scene registry: everything a helper creates is tracked here    */
/* so cleanupJuice can kill it all on shutdown / round rebuild.       */
/* ------------------------------------------------------------------ */

const registry = new WeakMap();

function reg(scene) {
  let r = registry.get(scene);
  if (!r) {
    r = { tweens: [], emitters: [], timers: [], objects: [] };
    registry.set(scene, r);
  }
  return r;
}

function unregister(list, item) {
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
}

/** Kill and destroy everything juice created for this scene. Safe to
 *  call repeatedly and on a scene that has nothing registered. Call it
 *  on `scene.events.on('shutdown')` and before rebuilding the board
 *  for a new round. */
export function cleanupJuice(scene) {
  if (!scene) return;
  const r = registry.get(scene);
  if (!r) return;
  r.timers.forEach(function (t) { try { t.remove(false); } catch (e) {} });
  r.tweens.forEach(function (tw) { try { tw.stop(); } catch (e) {} });
  r.emitters.forEach(function (em) { try { em.destroy(); } catch (e) {} });
  r.objects.forEach(function (o) { try { o.destroy(); } catch (e) {} });
  r.timers.length = 0;
  r.tweens.length = 0;
  r.emitters.length = 0;
  r.objects.length = 0;
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

// mulberry32 - tiny deterministic PRNG for the seeded test hook.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSeeded(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// Add a tween, register it, and unregister it on completion so the
// registry never holds a finished tween. The caller's onComplete (if
// any) still runs first.
function addTween(scene, config) {
  const r = reg(scene);
  const userComplete = config.onComplete;
  let tw = null;
  config.onComplete = function () {
    if (tw) unregister(r.tweens, tw);
    if (userComplete) userComplete.apply(this, arguments);
  };
  tw = scene.tweens.add(config);
  r.tweens.push(tw);
  return tw;
}

// Register a delayed call so cleanupJuice can cancel it.
function delayedCall(scene, ms, fn) {
  const r = reg(scene);
  let t = null;
  t = scene.time.delayedCall(ms, function () {
    if (t) unregister(r.timers, t);
    fn();
  });
  r.timers.push(t);
  return t;
}

/* ------------------------------------------------------------------ */
/* Particle textures - small generated textures, created once.         */
/* No PNGs, no giant transparent images as particle textures.          */
/* ------------------------------------------------------------------ */

const TEXTURE_DOT = 'juice-dot';     // 16 px circle
const TEXTURE_STAR = 'juice-star';   // 24 px star
const TEXTURE_SPARK = 'juice-spark'; // 12 px spark

export function ensureJuiceTextures(scene) {
  if (scene.textures.exists(TEXTURE_DOT)
    && scene.textures.exists(TEXTURE_STAR)
    && scene.textures.exists(TEXTURE_SPARK)) return;

  const g = scene.add.graphics();

  if (!scene.textures.exists(TEXTURE_DOT)) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
    g.generateTexture(TEXTURE_DOT, 16, 16);
    g.clear();
  }
  if (!scene.textures.exists(TEXTURE_STAR)) {
    // 5-point star, drawn with lines so it reads at 24 px.
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 11 : 5;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = 12 + Math.cos(angle) * radius;
      const y = 12 + Math.sin(angle) * radius;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
    g.generateTexture(TEXTURE_STAR, 24, 24);
    g.clear();
  }
  if (!scene.textures.exists(TEXTURE_SPARK)) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 4);
    g.fillRect(0, 5, 12, 2);
    g.fillRect(5, 0, 2, 12);
    g.generateTexture(TEXTURE_SPARK, 12, 12);
    g.clear();
  }
  g.destroy();
}

/* ------------------------------------------------------------------ */
/* Core tweens                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pop a target in: scale from `from` to 1 with a Back easeOut overshoot.
 * Reduced motion: 150 ms, Cubic easeOut, from 0.9, no overshoot.
 * Returns the tween (null if the target has no scene).
 */
export function popIn(scene, target, opts) {
  opts = opts || {};
  if (!target || !scene) return null;
  const reduced = prefersReducedMotion();
  const from = reduced ? 0.9 : (opts.from !== undefined ? opts.from : 0.6);
  const duration = reduced ? 150 : (opts.duration || 300);
  // Preserve a pre-set display scale: the tween must end at the
  // target's CURRENT scale, not at absolute 1. Ending at 1 blew the
  // 90-unit Reveal mascot up to its native 400 px, so it covered the
  // "WHAT CHANGED" title, the desc lines and the Result score box.
  const endX = (typeof target.scaleX === 'number') ? target.scaleX : 1;
  const endY = (typeof target.scaleY === 'number') ? target.scaleY : 1;
  target.setScale(from * endX, from * endY);
  if (opts.angle !== undefined) target.setAngle(opts.angle);
  const tweenConfig = {
    targets: target,
    scaleX: endX,
    scaleY: endY,
    duration: duration,
    ease: reduced ? 'Cubic.easeOut' : (opts.ease || 'Back.easeOut'),
    delay: opts.delay || 0,
    onComplete: opts.onComplete || null,
  };
  if (opts.angle !== undefined) {
    tweenConfig.angle = opts.toAngle !== undefined ? opts.toAngle : 0;
  }
  return addTween(scene, tweenConfig);
}

/**
 * Gentle rotation wiggle (+/-2 deg), one yoyo cycle by default.
 * Desktop pointer-over only - the builder must never call this from a
 * touch tap handler (iOS keeps a tap's hover state stuck, #51).
 * Reduced motion: no-op, returns null.
 */
export function wiggle(target, opts) {
  opts = opts || {};
  if (!target || !target.scene) return null;
  if (prefersReducedMotion()) return null;
  const scene = target.scene;
  const amount = opts.amount !== undefined ? opts.amount : 2;
  return addTween(scene, {
    targets: target,
    angle: amount,
    duration: opts.duration || 175,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: opts.repeat !== undefined ? opts.repeat : 1,
    onComplete: opts.onComplete || null,
  });
}

/**
 * Button / cell press: squash down then spring back. Use on every tap
 * target so presses feel like toys. Reduced motion: a plain 120 ms
 * scale dip to 0.97 with no overshoot.
 */
export function squashStretch(target, opts) {
  opts = opts || {};
  if (!target || !target.scene) return null;
  const scene = target.scene;
  const reduced = prefersReducedMotion();
  const down = reduced ? 0.97 : (opts.down !== undefined ? opts.down : 0.92);
  return addTween(scene, {
    targets: target,
    scaleX: reduced ? down : 1.08,
    scaleY: down,
    duration: reduced ? 120 : (opts.downDuration || 140),
    ease: reduced ? 'Cubic.easeOut' : 'Quad.easeOut',
    yoyo: true,
    onComplete: opts.onComplete || null,
  });
}

/**
 * Slow idle bob (+/-6 px, 2.4 s). Decorative stickers only (title eyes).
 * NEVER call on board cells or anything in the study phase.
 * Reduced motion: no-op, returns null.
 */
export function floaty(target, opts) {
  opts = opts || {};
  if (!target || !target.scene) return null;
  if (prefersReducedMotion()) return null;
  const scene = target.scene;
  const baseY = target.y;
  const amount = opts.amount !== undefined ? opts.amount : 6;
  return addTween(scene, {
    targets: target,
    y: baseY - amount,
    duration: opts.duration || 1200,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
}

/**
 * Slow breathing for a primary CTA ("I'm ready", "Spot it!"): scale
 * 1.00-1.03 over 1.6 s. An invitation, not a deadline - deliberately
 * too slow to read as urgency. Reduced motion: no-op, returns null.
 * The returned tween must be killed when the screen exits (cleanupJuice
 * does this if the scene shuts down; otherwise stop it by hand).
 */
export function breathe(target, opts) {
  opts = opts || {};
  if (!target || !target.scene) return null;
  if (prefersReducedMotion()) return null;
  const scene = target.scene;
  return addTween(scene, {
    targets: target,
    scaleX: 1.03,
    scaleY: 1.03,
    duration: opts.duration || 800,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
}

/** Fade a target in from transparent. Reduced motion: 150 ms. */
export function fadeIn(scene, target, opts) {
  opts = opts || {};
  if (!target || !scene) return null;
  const reduced = prefersReducedMotion();
  target.setAlpha(0);
  return addTween(scene, {
    targets: target,
    alpha: 1,
    duration: reduced ? 150 : (opts.duration || 300),
    ease: 'Cubic.easeOut',
    delay: opts.delay || 0,
    onComplete: opts.onComplete || null,
  });
}

/** Slide a target up from +14 px while fading in. Cards and grids. */
export function slideUp(scene, target, opts) {
  opts = opts || {};
  if (!target || !scene) return null;
  const reduced = prefersReducedMotion();
  const distance = opts.distance !== undefined ? opts.distance : 14;
  const startY = target.y + distance;
  target.setY(startY);
  target.setAlpha(0);
  return addTween(scene, {
    targets: target,
    y: startY - distance,
    alpha: 1,
    duration: reduced ? 150 : (opts.duration || 300),
    ease: 'Cubic.easeOut',
    delay: opts.delay || 0,
    onComplete: opts.onComplete || null,
  });
}

/**
 * A tilted sticker that bursts in - the GOTCHA! moment.
 * Creates a text object at (x, y), pops it with overshoot, holds it
 * for `holdMs`, then fades it out and destroys it. Returns the text.
 * Reduced motion: 150 ms pop, no overshoot, no rotation overshoot.
 */
export function stickerPop(scene, x, y, text, opts) {
  opts = opts || {};
  if (!scene) return null;
  const reduced = prefersReducedMotion();
  const sticker = scene.add.text(x, y, text || 'GOTCHA!', {
    fontFamily: '"Arial Black", system-ui, sans-serif',
    fontSize: opts.fontSize || '28px',
    color: '#141414',
    backgroundColor: '#ffd400',
    padding: { x: 14, y: 8 },
  });
  sticker.setOrigin(0.5, 0.5);
  sticker.setAngle(reduced ? -3 : -8);
  reg(scene).objects.push(sticker);
  const holdMs = opts.holdMs !== undefined ? opts.holdMs : 900;
  popIn(scene, sticker, {
    from: reduced ? 0.9 : 0.4,
    duration: reduced ? 150 : 450,
    ease: reduced ? 'Cubic.easeOut' : 'Back.easeOut',
  });
  addTween(scene, {
    targets: sticker,
    angle: -3,
    duration: reduced ? 150 : 450,
    ease: 'Cubic.easeOut',
  });
  delayedCall(scene, holdMs, function () {
    if (!sticker.scene) return;
    addTween(scene, {
      targets: sticker,
      alpha: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: function () {
        unregister(reg(scene).objects, sticker);
        sticker.destroy();
      },
    });
  });
  return sticker;
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

/**
 * One burst of star/dot particles at (x, y). One emitter, exploded
 * once, destroyed after the particles die. Safe to call repeatedly -
 * each call makes and destroys its own emitter.
 * opts: count (default 18, max 40), colors (array of hex numbers),
 *       texture ('juice-star' | 'juice-dot' | 'juice-spark'),
 *       speed ([min, max], default [120, 260]), lifespan (default 600),
 *       gravityY (default 0), seed (deterministic layout for tests).
 * Reduced motion: count drops to 8, speed halves, no gravity.
 */
export function burst(scene, x, y, colors, opts) {
  opts = opts || {};
  if (!scene) return null;
  ensureJuiceTextures(scene);
  const reduced = prefersReducedMotion();
  const count = Math.min(reduced ? 8 : (opts.count || 18), 40);
  const palette = (colors && colors.length) ? colors : BURST_COLORS;
  const texture = opts.texture || TEXTURE_STAR;
  const speed = opts.speed || [120, 260];
  const lifespan = opts.lifespan || 600;

  const config = {
    x: x,
    y: y,
    speed: reduced
      ? { min: speed[0] / 2, max: speed[1] / 2 }
      : { min: speed[0], max: speed[1] },
    angle: { min: 0, max: 360 },
    lifespan: lifespan,
    scale: { start: 1, end: 0.2 },
    rotate: { min: 0, max: 360 },
    tint: palette,
    gravityY: reduced ? 0 : (opts.gravityY || 0),
    emitting: false,
  };
  if (opts.seed !== undefined) config.seed = opts.seed;
  const emitter = scene.add.particles(x, y, texture, config);
  reg(scene).emitters.push(emitter);
  emitter.explode(count, x, y);
  delayedCall(scene, lifespan + 150, function () {
    unregister(reg(scene).emitters, emitter);
    try { emitter.destroy(); } catch (e) {}
  });
  return emitter;
}

/**
 * Confetti-lite: small pieces falling from above (x, y) with gravity.
 * Correct reveal only, once per round. Reduced motion: skipped
 * entirely (the burst in celebrateReveal already drops to 8).
 */
export function confettiLite(scene, x, y, opts) {
  opts = opts || {};
  if (!scene) return null;
  if (prefersReducedMotion()) return null;
  ensureJuiceTextures(scene);
  const count = Math.min(opts.count || 24, 30);
  const palette = (opts.colors && opts.colors.length) ? opts.colors : BURST_COLORS;
  const config = {
    x: x,
    y: y,
    speed: { min: 40, max: 120 },
    angle: { min: 60, max: 120 }, // mostly downwards
    lifespan: opts.lifespan || 900,
    scale: { start: 0.9, end: 0.2 },
    rotate: { min: 0, max: 360 },
    tint: palette,
    gravityY: 300,
    emitting: false,
  };
  if (opts.seed !== undefined) config.seed = opts.seed;
  const emitter = scene.add.particles(x, y, TEXTURE_DOT, config);
  reg(scene).emitters.push(emitter);
  emitter.explode(count, x, y);
  delayedCall(scene, (opts.lifespan || 900) + 150, function () {
    unregister(reg(scene).emitters, emitter);
    try { emitter.destroy(); } catch (e) {}
  });
  return emitter;
}

/* ------------------------------------------------------------------ */
/* Camera + haptics                                                    */
/* ------------------------------------------------------------------ */

/**
 * The game's one permitted camera shake: soft, 120 ms, intensity 0.004.
 * Only for a Versus win or a 6-of-6 result. NEVER on a miss.
 * Reduced motion: no-op, returns null.
 */
export function shake(scene, intensity, opts) {
  opts = opts || {};
  if (!scene || !scene.cameras || !scene.cameras.main) return null;
  if (prefersReducedMotion()) return null;
  scene.cameras.main.shake(opts.duration || 120, intensity !== undefined ? intensity : 0.004);
  return scene.cameras.main;
}

/**
 * Gentle haptic confirmation. Fires only on a touch/mobile device,
 * only when navigator.vibrate exists. Short patterns only:
 *   tap / pick: [10]        correct / win / level-up: [30, 40, 30]
 * Never call with a pattern on a miss, a locked level, or the curtain.
 * Returns true if a vibration was requested, false otherwise.
 */
export function vibrate(pattern) {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const touch = 'ontouchstart' in window;
      if (!coarse && !touch) return false; // desktop never vibrates
    }
    const p = pattern || [10];
    const total = p.reduce(function (sum, n) { return sum + n; }, 0);
    if (total > 100) return false; // refuse anything longer than 100 ms total
    navigator.vibrate(p);
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Composed moments                                                    */
/* ------------------------------------------------------------------ */

/**
 * The curtain moment (the review's "dead air" fix). Moves `mascot`
 * (a GameObject the builder creates - art's Sneaky Switcher sprite,
 * or any image/text) across the curtain from fromX to toX with a
 * gentle bob, a mid-way peek pause, and a few dust puffs at its feet.
 * If no mascot is supplied, a 👀 text stand-in is created and
 * destroyed after. Interruptible: killing the returned tween stops
 * the crossing; cleanupJuice kills everything including the bob.
 *
 * opts: y (default: scene centre), fromX / toX (default: off-screen
 *       left / right), duration (default 2200 ms), peekMs (default 400),
 *       dust (default true), onDone.
 * Reduced motion: half speed, no bob, no dust puffs.
 */
export function curtainSneak(scene, mascot, opts) {
  opts = opts || {};
  if (!scene) return null;
  const reduced = prefersReducedMotion();
  const width = (scene.scale && scene.scale.width) || 640;
  const height = (scene.scale && scene.scale.height) || 480;
  const y = opts.y !== undefined ? opts.y : Math.round(height / 2);
  const fromX = opts.fromX !== undefined ? opts.fromX : -40;
  const toX = opts.toX !== undefined ? opts.toX : width + 40;
  const midX = Math.round((fromX + toX) / 2);
  const duration = reduced
    ? (opts.duration || 2200) * 2
    : (opts.duration || 2200);
  const peekMs = opts.peekMs !== undefined ? opts.peekMs : 400;

  let ownMascot = false;
  if (!mascot) {
    mascot = scene.add.text(fromX, y, '👀', { fontSize: '40px' });
    mascot.setOrigin(0.5, 0.5);
    reg(scene).objects.push(mascot);
    ownMascot = true;
  }
  mascot.setPosition(fromX, y);
  // The mascot arrives pre-scaled to its display size (e.g. 140 units);
  // the mid-way peek must swell RELATIVE to that scale. An absolute
  // 1.15 blew the mascot up to its native 400 px mid-crossing, covering
  // the curtain text and clipping off the right edge.
  const baseScaleX = (typeof mascot.scaleX === 'number') ? mascot.scaleX : 1;
  const baseScaleY = (typeof mascot.scaleY === 'number') ? mascot.scaleY : 1;

  let bob = null;
  if (!reduced) {
    bob = addTween(scene, {
      targets: mascot,
      y: y - 4,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  function dustAt(px, py) {
    if (reduced || opts.dust === false) return;
    burst(scene, px, py + 12, [PALETTE.lime, PALETTE.yellow], {
      count: 6,
      texture: TEXTURE_SPARK,
      speed: [20, 60],
      lifespan: 400,
    });
  }

  function finish() {
    if (bob) { try { bob.stop(); } catch (e) {} if (bob) unregister(reg(scene).tweens, bob); }
    // Leave the mascot at its display scale, never at the peek swell.
    try { mascot.setScale(baseScaleX, baseScaleY); } catch (e) {}
    if (ownMascot) {
      unregister(reg(scene).objects, mascot);
      try { mascot.destroy(); } catch (e) {}
    }
    if (opts.onDone) opts.onDone();
  }

  dustAt(fromX + 20, y);
  const leg1 = addTween(scene, {
    targets: mascot,
    x: midX,
    duration: Math.round(duration / 2),
    ease: 'Sine.easeInOut',
    onComplete: function () {
      dustAt(midX, y);
      // Mid-way peek: a slow swell, then carry on. Relative to the
      // mascot's display scale (see above), never absolute.
      addTween(scene, {
        targets: mascot,
        scaleX: baseScaleX * 1.15,
        scaleY: baseScaleY * 1.15,
        duration: Math.round(peekMs / 2),
        ease: 'Sine.easeInOut',
        yoyo: true,
        onComplete: function () {
          addTween(scene, {
            targets: mascot,
            x: toX,
            duration: Math.round(duration / 2),
            ease: 'Sine.easeInOut',
            onComplete: finish,
          });
        },
      });
    },
  });
  return leg1;
}

/**
 * Correct-spot celebration: a star burst at the changed cell plus a
 * confetti-lite fall from above the GOTCHA! sticker, plus the sticker
 * itself. One celebration per round - the builder must not call this
 * twice for a multi-switch round.
 * opts: colors, count (burst, default 18), confetti (default true),
 *       stickerText (default 'GOTCHA!'), seed.
 */
export function celebrateReveal(scene, x, y, opts) {
  opts = opts || {};
  if (!scene) return null;
  burst(scene, x, y, opts.colors, {
    count: opts.count || 18,
    seed: opts.seed,
  });
  if (opts.confetti !== false) {
    confettiLite(scene, x, y - 120, { seed: opts.seed });
  }
  stickerPop(scene, x, y - 70, opts.stickerText || 'GOTCHA!', {
    holdMs: opts.holdMs !== undefined ? opts.holdMs : 1100,
  });
  vibrate([30, 40, 30]);
  return true;
}

/**
 * Gentle miss: a slow warm pulse on the true changed cell. No red,
 * no shake, no sound from juice (the builder plays the soft `wrong`
 * sound), no haptics. Pass the cell GameObject as opts.target to
 * pulse it directly; otherwise pass world coordinates and juice
 * pulses a generated yellow ring at that point, then destroys it.
 * opts: target, width / height (ring size, default 76), pulses
 *       (default 2, reduced motion: 1), pulseMs (default 1200).
 */
export function gentleMiss(scene, x, y, opts) {
  opts = opts || {};
  if (!scene) return null;
  const reduced = prefersReducedMotion();
  const pulses = reduced ? 1 : (opts.pulses !== undefined ? opts.pulses : 2);
  const pulseMs = reduced ? 1500 : (opts.pulseMs || 1200);

  if (opts.target) {
    const target = opts.target;
    return addTween(scene, {
      targets: target,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: Math.round(pulseMs / 2),
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: pulses - 1,
      onComplete: function () {
        target.setScale(1.03);
        if (opts.onComplete) opts.onComplete();
      },
    });
  }

  const w = opts.width || 76;
  const h = opts.height || 76;
  const ring = scene.add.rectangle(x, y, w, h);
  ring.setStrokeStyle(4, PALETTE.yellow, 1);
  ring.setFillStyle(PALETTE.yellow, 0.08);
  ring.setOrigin(0.5, 0.5);
  reg(scene).objects.push(ring);
  addTween(scene, {
    targets: ring,
    scaleX: 1.06,
    scaleY: 1.06,
    alpha: 0.6,
    duration: Math.round(pulseMs / 2),
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: pulses - 1,
    onComplete: function () {
      unregister(reg(scene).objects, ring);
      try { ring.destroy(); } catch (e) {}
      if (opts.onComplete) opts.onComplete();
    },
  });
  return ring;
}

/**
 * Level-up / 6-of-6 celebration: one burst plus the happy haptic.
 * The builder plays the `levelUp` / `win` sound. Camera shake is NOT
 * included here - only the Versus win calls `shake` separately.
 */
export function celebrateWin(scene, x, y, opts) {
  opts = opts || {};
  if (!scene) return null;
  burst(scene, x, y, opts.colors, {
    count: opts.count || 20,
    seed: opts.seed,
  });
  vibrate([30, 40, 30]);
  return true;
}

/* ------------------------------------------------------------------ */
/* Convenience: one-call screen transitions                            */
/* ------------------------------------------------------------------ */

/**
 * Round transition helper: fades/slides the old screen content out
 * and returns a promise-like via onComplete. The builder builds the
 * next screen in onComplete. (Juice moves things; it never builds
 * screens.)
 */
export function exitScreen(scene, targets, opts, onComplete) {
  opts = opts || {};
  if (!scene || !targets) { if (onComplete) onComplete(); return null; }
  return addTween(scene, {
    targets: targets,
    y: '+=40',
    alpha: 0,
    duration: prefersReducedMotion() ? 120 : (opts.duration || 250),
    ease: 'Cubic.easeIn',
    onComplete: onComplete || null,
  });
}
