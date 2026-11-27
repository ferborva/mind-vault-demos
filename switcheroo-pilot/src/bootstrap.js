/* Switcheroo! AAA pilot - module bootstrap.
   Why this file exists: juice.js is an ES module (`export ...`) while
   the rest of the skeleton loads as plain scripts. This module is the
   one and only module entry point:
     1. import juice, expose it as window.Juice for the classic scenes;
     2. then load src/scenes.js and src/main.js as classic scripts, in
        order, so the Phaser game boots only after Juice is ready.
   Nothing else in the game is a module, and there is still no build
   step, no bundler and no CDN.
   file:// caveat: ES modules are blocked from file:// in Chrome and
   Firefox (CORS), so opening index.html directly from disk skips this
   file entirely. The inline fallback in index.html then loads
   scenes.js + main.js as classic scripts after a short wait; the
   scenes guard every Juice call, so the game still plays, just
   without motion juice. Over http(s) - the deployed site, or
   `python3 -m http.server` - this module path always runs and Juice
   is always present.
   The started flag is set only AFTER the juice import below has
   succeeded. A failed static import means this module never evaluates
   at all, so the flag must not be set first: the index.html fallback
   fires exactly when neither Juice nor the pilot is present, and a
   flag set before the import would suppress it. */
import * as juice from "./juice.js";

window.Juice = juice;
window.__pilotBootstrapStarted = true;

function loadClassic(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = function () { reject(new Error("failed to load " + src)); };
    document.head.appendChild(s);
  });
}

loadClassic("src/scenes.js")
  .then(function () { return loadClassic("src/main.js"); })
  .catch(function (err) { console.error("[switcheroo-pilot] bootstrap failed:", err); });
