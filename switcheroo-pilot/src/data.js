"use strict";
/* Switcheroo! AAA pilot - game data.
   Copied faithfully from the live game (current-switcheroo-source.html):
   6 themes x 12 cells, small sneak-ins, distractor tiles, 5 levels,
   switch types, and the pilot's own storage key.
   No Phaser dependency - safe to require in Node for headless tests. */

var PILOT_STORE_KEY = "switcheroo-pilot-progress-v1"; /* NOT the live key "switcheroo-progress-v1" */
var PILOT_VERSION = "0.1.0";
var ROUNDS_PER_GAME = 6;
var UNLOCK_SCORE = 4;
var MODES = ["Solo", "Together", "Versus"];

var THEMES = [
{id:"bedroom", name:"The bedroom", emoji:"🛏️", cells:[
  {place:"on the bed", items:[{e:"🐱",n:"cat"},{e:"🐶",n:"dog"}]},
  {place:"on the pillow", items:[{e:"🧸",n:"teddy"}]},
  {place:"on the rug", items:[{e:"🔴",n:"red ball",vars:[{e:"🔴",n:"red ball"},{e:"🔵",n:"blue ball"},{e:"🟢",n:"green ball"}]}]},
  {place:"on the shelf", items:[{e:"📕",n:"red book",vars:[{e:"📕",n:"red book"},{e:"📗",n:"green book"},{e:"📘",n:"blue book"}]},{e:"🕯️",n:"candle"}]},
  {place:"by the window", items:[{e:"🪴",n:"plant"}]},
  {place:"on the desk", items:[{e:"⏰",n:"alarm clock"}]},
  {place:"under the bed", items:[{e:"🧦",n:"sock"}]},
  {place:"on the floor", items:[{e:"👟",n:"shoe"}]},
  {place:"by the door", items:[{e:"🎒",n:"backpack"}]},
  {place:"on the chair", items:[{e:"🧢",n:"cap"}]},
  {place:"in the toy box", items:[{e:"🎲",n:"dice"}]},
  {place:"on the wall", items:[{e:"🖼️",n:"picture"}]}
]},
{id:"kitchen", name:"The kitchen", emoji:"🍳", cells:[
  {place:"on the table", items:[{e:"🍕",n:"pizza"},{e:"🍰",n:"cake"}]},
  {place:"on the bench", items:[{e:"🍎",n:"red apple",vars:[{e:"🍎",n:"red apple"},{e:"🍏",n:"green apple"}]},{e:"🍊",n:"orange"}]},
  {place:"on the shelf", items:[{e:"☕",n:"cup"}]},
  {place:"in the sink", items:[{e:"🍽️",n:"plate"}]},
  {place:"on the stove", items:[{e:"🍳",n:"pan"}]},
  {place:"in the fruit bowl", items:[{e:"🍌",n:"banana"}]},
  {place:"on the floor", items:[{e:"🔴",n:"red ball",vars:[{e:"🔴",n:"red ball"},{e:"🔵",n:"blue ball"},{e:"🟢",n:"green ball"}]}]},
  {place:"by the fridge", items:[{e:"🥛",n:"milk"}]},
  {place:"on the windowsill", items:[{e:"🌻",n:"sunflower"}]},
  {place:"hanging on the wall", items:[{e:"🧂",n:"salt"}]},
  {place:"in the cupboard", items:[{e:"🥣",n:"bowl"}]},
  {place:"on the chair", items:[{e:"🧺",n:"basket"}]}
]},
{id:"pirate", name:"The pirate ship", emoji:"🏴‍☠️", cells:[
  {place:"on the captain's chair", items:[{e:"🦆",n:"rubber duck"},{e:"🐒",n:"monkey"}]},
  {place:"on the deck", items:[{e:"⚓",n:"anchor"},{e:"🔴",n:"red ball",vars:[{e:"🔴",n:"red ball"},{e:"🔵",n:"blue ball"},{e:"🟢",n:"green ball"}]}]},
  {place:"in the crow's nest", items:[{e:"🔭",n:"telescope"}]},
  {place:"on the treasure chest", items:[{e:"💎",n:"blue gem",vars:[{e:"💎",n:"blue gem"},{e:"🔶",n:"orange gem"},{e:"🔷",n:"light blue gem"}]},{e:"👑",n:"crown"}]},
  {place:"on the mast", items:[{e:"🏴",n:"pirate flag"}]},
  {place:"by the wheel", items:[{e:"🗺️",n:"map"}]},
  {place:"in the barrel", items:[{e:"🍎",n:"red apple",vars:[{e:"🍎",n:"red apple"},{e:"🍏",n:"green apple"}]}]},
  {place:"on the plank", items:[{e:"🦜",n:"parrot"}]},
  {place:"under the stairs", items:[{e:"🐭",n:"mouse"}]},
  {place:"on the cannon", items:[{e:"💣",n:"cannonball"}]},
  {place:"in the cabin", items:[{e:"🕯️",n:"candle"}]},
  {place:"on the rope", items:[{e:"🧭",n:"compass"}]}
]},
{id:"space", name:"The space station", emoji:"🚀", cells:[
  {place:"by the window", items:[{e:"🌍",n:"Earth"}]},
  {place:"on the control panel", items:[{e:"🖥️",n:"computer"}]},
  {place:"floating by the door", items:[{e:"🧑‍🚀",n:"astronaut"},{e:"🐱",n:"space cat"}]},
  {place:"on the shelf", items:[{e:"📕",n:"red book",vars:[{e:"📕",n:"red book"},{e:"📗",n:"green book"},{e:"📘",n:"blue book"}]}]},
  {place:"in the airlock", items:[{e:"🚀",n:"rocket"}]},
  {place:"on the table", items:[{e:"🍕",n:"pizza"},{e:"🍩",n:"doughnut"}]},
  {place:"on the floor", items:[{e:"👾",n:"alien"}]},
  {place:"by the telescope", items:[{e:"⭐",n:"star"}]},
  {place:"in the storage pod", items:[{e:"🔴",n:"red ball",vars:[{e:"🔴",n:"red ball"},{e:"🔵",n:"blue ball"},{e:"🟢",n:"green ball"}]}]},
  {place:"on the bunk", items:[{e:"🧸",n:"teddy"}]},
  {place:"on the wall", items:[{e:"🛰️",n:"satellite"}]},
  {place:"by the oxygen tank", items:[{e:"🔦",n:"torch"}]}
]},
{id:"garden", name:"The garden", emoji:"🌻", cells:[
  {place:"on the grass", items:[{e:"🐰",n:"rabbit"},{e:"🐢",n:"turtle"}]},
  {place:"in the flower bed", items:[{e:"🌹",n:"red rose",vars:[{e:"🌹",n:"red rose"},{e:"🌻",n:"sunflower"},{e:"🌷",n:"pink tulip"}]},{e:"🌻",n:"sunflower"}]},
  {place:"on the fence", items:[{e:"🐦",n:"bird"}]},
  {place:"by the pond", items:[{e:"🐸",n:"frog"}]},
  {place:"on the path", items:[{e:"🐌",n:"snail"}]},
  {place:"under the tree", items:[{e:"🍎",n:"red apple",vars:[{e:"🍎",n:"red apple"},{e:"🍏",n:"green apple"}]}]},
  {place:"in the wheelbarrow", items:[{e:"🥕",n:"carrot"}]},
  {place:"on the bench", items:[{e:"🪣",n:"bucket"}]},
  {place:"by the gate", items:[{e:"🐶",n:"dog"}]},
  {place:"on the shed roof", items:[{e:"🐝",n:"bee"}]},
  {place:"in the sandbox", items:[{e:"🦋",n:"butterfly"}]},
  {place:"on the swing", items:[{e:"🎈",n:"balloon"}]}
]},
{id:"classroom", name:"The classroom", emoji:"🎒", cells:[
  {place:"on the teacher's desk", items:[{e:"🍎",n:"red apple",vars:[{e:"🍎",n:"red apple"},{e:"🍏",n:"green apple"}]}]},
  {place:"on the board", items:[{e:"✏️",n:"pencil"},{e:"🖍️",n:"crayon"}]},
  {place:"on the shelf", items:[{e:"📕",n:"red book",vars:[{e:"📕",n:"red book"},{e:"📗",n:"green book"},{e:"📘",n:"blue book"}]}]},
  {place:"by the window", items:[{e:"🪴",n:"plant"}]},
  {place:"on the reading rug", items:[{e:"🧸",n:"teddy"}]},
  {place:"in the toy corner", items:[{e:"🔴",n:"red ball",vars:[{e:"🔴",n:"red ball"},{e:"🔵",n:"blue ball"},{e:"🟢",n:"green ball"}]}]},
  {place:"on the art table", items:[{e:"🎨",n:"paint palette"},{e:"✂️",n:"scissors"}]},
  {place:"by the door", items:[{e:"🎒",n:"backpack"}]},
  {place:"on the wall", items:[{e:"🕐",n:"clock"}]},
  {place:"under the desk", items:[{e:"👟",n:"shoe"}]},
  {place:"in the fish tank", items:[{e:"🐠",n:"fish"}]},
  {place:"on the lunch table", items:[{e:"🥪",n:"sandwich"}]}
]}
];

/* Small things that can sneak into a crowded spot at Level 5. */
var SMALLS = [
  {e:"🐭",n:"mouse"},{e:"🐞",n:"ladybird"},{e:"🐜",n:"ant"},
  {e:"🕷️",n:"spider"},{e:"🐝",n:"bee"},{e:"🦋",n:"butterfly"}
];

/* Distractor tiles for Levels 4-5: tap all the blue things. */
var DISTRACTOR_TILES = ["🔵","🟢","🔴","🟡","🟣","🔷","🟠","💙","🟢"];

var LEVELS = {
  1:{name:"Scene Sleuth", items:6, switches:1, types:["remove"], distractor:false,
     blurb:"6 things, 1 switch, things only disappear."},
  2:{name:"Spotter", items:9, switches:1, types:["remove","move"], distractor:false,
     blurb:"9 things, 1 switch, things disappear or move."},
  3:{name:"Detective", items:12, switches:2, types:["remove","move","swap"], distractor:false,
     blurb:"12 things, 2 switches, things disappear, move or swap places."},
  4:{name:"Memory Master", items:12, switches:2, types:["remove","move","swap","colour"], distractor:true,
     blurb:"12 things, 2 switches, colours can change too - and a quick distraction first."},
  5:{name:"Switcheroo Expert", items:12, switches:3, types:["remove","move","swap","colour","add"], distractor:true,
     blurb:"12 things, 3 switches, and something small can sneak in."}
};

/* The Caught Switches gallery: one entry per switch type. */
var SWITCH_TYPES = [
  {type:"remove", emoji:"👻", label:"Taken away"},
  {type:"move", emoji:"🚶", label:"Moved"},
  {type:"swap", emoji:"🔀", label:"Swapped places"},
  {type:"colour", emoji:"🎨", label:"Changed colour"},
  {type:"add", emoji:"🐭", label:"Sneaked in"}
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PILOT_STORE_KEY: PILOT_STORE_KEY, PILOT_VERSION: PILOT_VERSION,
    ROUNDS_PER_GAME: ROUNDS_PER_GAME, UNLOCK_SCORE: UNLOCK_SCORE, MODES: MODES,
    THEMES: THEMES, SMALLS: SMALLS, DISTRACTOR_TILES: DISTRACTOR_TILES,
    LEVELS: LEVELS, SWITCH_TYPES: SWITCH_TYPES };
}
