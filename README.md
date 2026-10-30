# Napoleon's Command

A command game of June 1815: you are Napoleon, at Ligny on the 16th or Waterloo on the 18th, and you know only what your eyes, your
aides and your corps commanders' riders tell you. Choose the battle on the start screen; `index.html#ligny` opens Ligny directly.

Open the site once in Safari (or Chrome), then **Add to Home Screen**. After that it opens from the icon with no signal.

Everything is in `index.html` (engine, map and game); `sw.js` keeps it in the device's cache. Release d26cce5c27.

`lab.html` is the battle lab: any battle in the engine's packs (Waterloo, Ligny, and an invented test battle), fought by the generic commanders
or with you commanding one army through its own sightings; it also fights a battle many times and judges the results against the
battle's targets. The source and the tools are in `source/`.
