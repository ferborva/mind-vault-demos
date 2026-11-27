"use strict";
/* Switcheroo! AAA pilot - boot.
   Plain script tags, no build step. Load order in index.html:
   lib/phaser.min.js, src/data.js, src/core.js, src/scenes.js, this file. */

var GAME_WIDTH = 720;
var GAME_HEIGHT = 1280;

var config = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#fffbe8",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, HomeScene, HowToScene, GalleryScene, StudyScene, SwitcherScene,
    CurtainScene, DistractorScene, SpotScene, VersusPassScene,
    RevealScene, ResultScene]
};

var game = new Phaser.Game(config);

/* Real play must not replay the same deals: the core boots on a fixed
   seed (1) so tests are deterministic, so seed the RNG from the clock
   here, once, at boot. window.__pilot.setSeed(n) still replays an
   exact game afterwards - the hook overrides this seed. */
setSeed((Math.random() * 4294967296) >>> 0);

/* Deterministic test hook - see TEST-HOOK.md for the full contract.
   Required shape: { game, state, setSeed(seed), getState(), version }.
   Extras are convenience drivers for headless tests; they all go
   through the same core functions the scenes use. */
window.__pilot = {
  game: game,
  state: S,
  version: PILOT_VERSION,
  setSeed: setSeed,
  getState: getState,
  /* Drive a round headlessly: newGame({ mode, level, themePick, seed })
     deals round 1 and lands on Study; readyStudy() moves to Curtain
     (or Switcher in Together mode); goCurtain() / goSpot() advance;
     tap(cell) taps a cell then confirms it (the confirm step included). */
  newGame: newGame,
  readyStudy: readyStudy,
  pickSwitcherOption: pickSwitcherOption,
  goCurtain: goCurtain,
  goSpot: goSpot,
  tap: function (cell) { tapCell(cell); return confirmSpot(); },
  tapCell: tapCell,
  cancelSpot: cancelSpot,
  confirmSpot: confirmSpot,
  nextRound: nextRound,
  playAgain: playAgain,
  goHome: goHome,
  dealRound: dealRound,
  generateSwitches: generateSwitches,
  offerSwitcherOptions: offerSwitcherOptions
};
