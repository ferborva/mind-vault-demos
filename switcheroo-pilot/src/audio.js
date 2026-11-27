/* Switcheroo! AAA pilot - audio module (PilotAudio)
 *
 * Standalone Web Audio API sound, synthesised only. No audio files, no
 * external requests, no tracking, no Phaser dependency. The engine calls
 * this plain object from its Phaser scenes.
 *
 * White Hat rules baked in: every effect is soft and warm, volumes sit
 * well under clipping, nothing startles. A miss gets a gentle
 * two-note "so close", never a buzzer or sad trombone. Nothing here
 * creates urgency - no ticking, no rising tempo, no countdown sounds.
 *
 * Autoplay policy: the AudioContext is created lazily inside unlock(),
 * which the engine calls from its first pointer handler. Every play
 * function is safe to call before unlock - it simply does nothing.
 *
 * Mute state lives in localStorage under the pilot key
 * "switcheroo-pilot-progress-v1" (field `muted`), the same key family
 * as game progress. It never touches the live game's
 * "switcheroo-progress-v1" key, and it merges with whatever else the
 * pilot stores in that key instead of overwriting it.
 *
 * Usage (engine side):
 *   PilotAudio.unlock();            // first pointerdown / pointerup
 *   PilotAudio.tap();               // any button tap
 *   PilotAudio.pick();              // picking a cell / tile / option
 *   PilotAudio.correct();           // a switch was spotted
 *   PilotAudio.wrong();             // a miss - gentle, never punishing
 *   PilotAudio.win();               // result screen
 *   PilotAudio.levelUp();           // new level unlocked
 *   PilotAudio.curtain();           // "the sneaky switcher is at work"
 *   PilotAudio.reveal();            // before/after reveal appears
 *   PilotAudio.startAmbient();      // home screen + study phase (after unlock)
 *   PilotAudio.stopAmbient();       // leaving home/study, or on mute
 *   PilotAudio.setMuted(true);      // mute toggle button
 *   PilotAudio.isMuted();           // draw the toggle state
 */
(function (global) {
  "use strict";

  var STORE_KEY = "switcheroo-pilot-progress-v1";

  /* ---- volumes: conservative by design ----
     SFX notes peak around 0.10 - 0.18 (linear gain, 1.0 = full scale),
     and notes in a chord are staggered so they never stack at full
     volume. The ambient pad sits at 0.045 - clearly under the SFX,
     calm enough to ignore during the memory task. */
  var SFX_VOL = 0.16;
  var AMBIENT_VOL = 0.045;

  /* ---- mute persistence (same key family as game progress) ---- */
  function readStored() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) { /* storage unavailable or corrupt - carry on unmuted */ }
    return {};
  }

  function writeStored(patch) {
    try {
      if (!global.localStorage) return;
      var data = readStored();
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) data[k] = patch[k];
      }
      global.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable - mute still applies this session */ }
  }

  var muted = false;
  try { muted = readStored().muted === true; } catch (e) { muted = false; }

  /* ---- audio graph (created lazily, on the first user gesture) ---- */
  var ctx = null;        // AudioContext, null until unlock()
  var master = null;     // master GainNode - mute silences everything here
  var ambientGain = null;
  var noiseBuffer = null;

  function getAudioCtor() {
    return global.AudioContext || global.webkitAudioContext || null;
  }

  /* Create (or resume) the AudioContext. Call from the engine's first
     pointer handler. Returns true once audio is usable. Safe to call
     repeatedly and safe to call before any user gesture - it just
     creates the context; nothing plays until an SFX is triggered. */
  function unlock() {
    try {
      if (!ctx) {
        var AC = getAudioCtor();
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 1;
        master.connect(ctx.destination);
        ambientGain = ctx.createGain();
        ambientGain.gain.value = 0;
        ambientGain.connect(master);
      }
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        var resumed = ctx.resume();
        if (resumed && typeof resumed.catch === "function") resumed.catch(function () {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* True only when the graph exists and is not muted. Every SFX goes
     through this, so nothing can sound before unlock or while muted. */
  function canPlay() {
    return !!ctx && !!master && !muted;
  }

  /* ---- tiny synth helpers ---- */

  /* One soft note. opts: freq, freqEnd (glide), at (delay in seconds),
     dur, type ("sine" warm default, "triangle" a touch brighter),
     vol, attack. Exponential ramps, so no clicks at note edges. */
  function tone(opts) {
    if (!canPlay()) return;
    try {
      var t0 = ctx.currentTime + (opts.at || 0);
      var dur = opts.dur || 0.15;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opts.type || "sine";
      osc.frequency.setValueAtTime(opts.freq, t0);
      if (opts.freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(opts.freqEnd, 1), t0 + dur);
      }
      var vol = (typeof opts.vol === "number") ? opts.vol : SFX_VOL;
      var attack = opts.attack || 0.008;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* a failed note must never break the game */ }
  }

  /* A short filtered-noise whoosh: airy, no harsh high end. The
     bandpass sweeps upward gently and the gain swells then fades. */
  function whoosh(dur, vol, fromFreq, toFreq) {
    if (!canPlay()) return;
    try {
      if (!noiseBuffer) {
        var len = Math.floor(ctx.sampleRate * 1);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      var t0 = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(fromFreq, t0);
      bp.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (e) { /* same rule: never break the game */ }
  }

  /* ---- SFX ----
     Every effect is under ~1 second except win and levelUp, which are
     allowed to run a little longer. All frequencies stay in the warm
     middle of the range - nothing above ~2100 Hz, nothing shrill. */

  /* Soft pop for any button tap. A quick sine blip that falls in pitch,
     like a fingertip on a bubble. */
  function tap() {
    tone({ freq: 620, freqEnd: 320, dur: 0.09, type: "sine", vol: 0.12 });
  }

  /* Brighter blip for picking a cell, tile or option - a small step up
     from tap so a choice feels more deliberate than a press. */
  function pick() {
    tone({ freq: 740, freqEnd: 1180, dur: 0.14, type: "triangle", vol: 0.13 });
  }

  /* Happy ascending arpeggio, warm and never shrill: C5 - E5 - G5 - C6
     on soft triangle waves, staggered so the notes bloom one by one. */
  function correct() {
    var notes = [523.25, 659.25, 783.99, 1046.50];
    for (var i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], at: i * 0.09, dur: 0.28, type: "triangle", vol: 0.14 });
    }
  }

  /* Gentle descending two-note "so close": A4 down to F4, slow attack,
     soft sine, like a kind sigh. Deliberately NOT a buzzer, NOT a sad
     trombone, NOT a descending slide - a miss is a look-again moment. */
  function wrong() {
    tone({ freq: 440.00, dur: 0.30, type: "sine", vol: 0.12, attack: 0.03 });
    tone({ freq: 349.23, at: 0.26, dur: 0.38, type: "sine", vol: 0.11, attack: 0.03 });
  }

  /* Short cheerful fanfare for the result screen (~1.4 s): a rising
     arpeggio, then a warm three-note chord that rings out. */
  function win() {
    var notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    for (var i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], at: i * 0.10, dur: 0.30, type: "triangle", vol: 0.13 });
    }
    var chord = [523.25, 659.25, 783.99];
    for (var j = 0; j < chord.length; j++) {
      tone({ freq: chord[j], at: 0.55, dur: 0.85, type: "sine", vol: 0.10, attack: 0.05 });
    }
  }

  /* Sparkle arpeggio for a level unlock (~1.2 s): bright but soft,
     high notes on sine waves with a little shimmer from a detuned
     second voice an octave up, kept very quiet. */
  function levelUp() {
    var notes = [1046.50, 1318.51, 1567.98, 2093.00];
    for (var i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], at: i * 0.10, dur: 0.32, type: "sine", vol: 0.10 });
      tone({ freq: notes[i] * 2, at: i * 0.10, dur: 0.22, type: "sine", vol: 0.03 });
    }
  }

  /* Mischievous sneaking motif for the curtain ("the sneaky switcher
     is at work"): three tiptoe plucks that creep up, then a soft low
     note, like someone creeping on tiptoe and ducking behind the
     curtain. Short, playful, never sinister. */
  function curtain() {
    var steps = [329.63, 392.00, 440.00];
    for (var i = 0; i < steps.length; i++) {
      tone({ freq: steps[i], at: i * 0.16, dur: 0.13, type: "triangle", vol: 0.12 });
    }
    tone({ freq: 261.63, at: 0.52, dur: 0.34, type: "sine", vol: 0.11, attack: 0.02 });
  }

  /* Soft whoosh plus a chime for the reveal: airy sweep, then two
     warm notes that land as the before/after appears. */
  function reveal() {
    whoosh(0.45, 0.07, 500, 2200);
    tone({ freq: 783.99, at: 0.18, dur: 0.34, type: "sine", vol: 0.12 });
    tone({ freq: 1046.50, at: 0.30, dur: 0.42, type: "sine", vol: 0.10 });
  }

  /* ---- generative ambient loop ----
     A gentle, slow pad: 3 chord tones, each played by two detuned
     oscillators (sine, +/- 4 cents) through a shared lowpass filter
     whose cutoff drifts slowly on an LFO. Chords change every 8 s by
     gliding the oscillators to the next chord over 2 s - no clicks,
     no jumps. Progression is C - Am - F - G, all warm major/minor
     triads in the low-middle range. It runs under the home screen and
     the study phase, at 0.045 - clearly quieter than any SFX - and is
     meant to be ignorable, never distracting during the memory task. */
  var AMBIENT_CHORDS = [
    [261.63, 329.63, 392.00],  // C major
    [220.00, 261.63, 329.63],  // A minor
    [174.61, 220.00, 261.63],  // F major
    [196.00, 246.94, 293.66]   // G major
  ];
  var CHORD_MS = 8000;
  var ambient = null; // { oscs, padFilter, lfo, timer } while running

  function startAmbient() {
    if (ambient) return true;              // already running - no-op
    if (!ctx) return false;                // unlock() first - never auto-play
    try {
      var padFilter = ctx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 750;
      padFilter.Q.value = 0.4;
      padFilter.connect(ambientGain);

      /* Slow LFO breathing on the filter cutoff, 600 - 950 Hz. */
      var lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.06;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 175;
      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);
      lfo.start();

      var chord = AMBIENT_CHORDS[0];
      var oscs = [];
      for (var n = 0; n < 3; n++) {
        for (var d = 0; d < 2; d++) {
          var osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = chord[n];
          osc.detune.value = d === 0 ? -4 : 4;
          var g = ctx.createGain();
          g.gain.value = 1 / 6; // six oscillators share the pad evenly
          osc.connect(g);
          g.connect(padFilter);
          osc.start();
          oscs.push(osc);
        }
      }

      var chordIdx = 0;
      var timer = setInterval(function () {
        if (!ambient || !ctx) return;
        chordIdx = (chordIdx + 1) % AMBIENT_CHORDS.length;
        var next = AMBIENT_CHORDS[chordIdx];
        var when = ctx.currentTime;
        for (var i = 0; i < oscs.length; i++) {
          var target = next[Math.floor(i / 2)];
          try {
            oscs[i].frequency.setTargetAtTime(target, when, 0.7); // ~2 s glide
          } catch (e) { /* one oscillator failing must not stop the pad */ }
        }
      }, CHORD_MS);

      ambient = { oscs: oscs, padFilter: padFilter, lfo: lfo, timer: timer };
      if (!muted) ambientGain.gain.setTargetAtTime(AMBIENT_VOL, ctx.currentTime, 0.8);
      return true;
    } catch (e) {
      stopAmbient();
      return false;
    }
  }

  function stopAmbient() {
    if (!ambient) return;
    var a = ambient;
    ambient = null;
    try {
      if (a.timer) clearInterval(a.timer);
      if (ctx && ambientGain) {
        ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
      var stopAt = ctx ? ctx.currentTime + 1.2 : 0;
      a.oscs.forEach(function (osc) {
        try { osc.stop(stopAt); } catch (e) {}
      });
      try { a.lfo.stop(stopAt); } catch (e) {}
    } catch (e) { /* stopping must never throw */ }
  }

  function isAmbientPlaying() {
    return !!ambient;
  }

  /* ---- mute ---- */
  function setMuted(value) {
    muted = !!value;
    writeStored({ muted: muted });
    try {
      if (master) master.gain.value = muted ? 0 : 1;
      if (ambientGain && ctx) {
        ambientGain.gain.setTargetAtTime(
          muted ? 0 : (ambient ? AMBIENT_VOL : 0), ctx.currentTime, 0.2);
      }
    } catch (e) { /* mute still applies - canPlay() checks the flag */ }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  /* ---- public API ---- */
  var PilotAudio = {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    tap: tap,
    pick: pick,
    correct: correct,
    wrong: wrong,
    win: win,
    levelUp: levelUp,
    curtain: curtain,
    reveal: reveal,
    startAmbient: startAmbient,
    stopAmbient: stopAmbient,
    isAmbientPlaying: isAmbientPlaying
  };

  global.PilotAudio = PilotAudio;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PilotAudio;
  }
})(typeof window !== "undefined" ? window : globalThis);
