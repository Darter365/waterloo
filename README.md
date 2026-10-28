# Waterloo: Napoleon's Command

A command game of 18 June 1815: you are Napoleon, and you know only what your eyes, your aides and your corps commanders' riders tell you.

Open the site once in Safari (or Chrome), then **Add to Home Screen**. After that it opens from the icon with no signal.

Everything is in `index.html` (engine, map and game); `sw.js` keeps it in the device's cache. Release b39d5ca8d3.

`ligny.html` is the second battle, Ligny (16 June 1815), played the same way: you are Napoleon against Blücher's Prussians, with
Vandamme, Gérard and Grouchy to write to and d'Erlon's corps somewhere to the west. It is cached with the rest.

`lab.html` is the battle lab: any battle in the engine's packs (Waterloo, Ligny, and an invented test battle), fought by the generic commanders
or with you commanding one army through its own sightings; it also fights a battle many times and judges the results against the
battle's targets. The source and the tools are in `source/`.
