# Repository Guide

## Run and Verify

- This is a dependency-free static browser game: there is no package manifest, build step, or module loader. `index.html` loads `game.js` as a classic script.
- Run with `npx serve .` and open `http://localhost:3000`; opening `index.html` directly is also supported.
- There is no automated test, lint, or typecheck setup. Run `node --check game.js`, then browser-test gameplay changes (movement, shooting, asteroid splitting, death/respawn, game over/restart, and level advancement).

## Architecture and Gotchas

- All gameplay, rendering, input, and mutable state live in `game.js`; execution starts with `initGame()` followed by `requestAnimationFrame(loop)`, and each frame updates before drawing.
- Keep `index.html`'s canvas `width`/`height` synchronized with the hard-coded `W`/`H` in `game.js`; physics, spawning, wrapping, HUD placement, and overlays use those constants.
- Asteroid size is numeric: `1` small, `2` medium, `3` large. `RADII`, `SPEEDS`, and `POINTS` share that indexing, and `split()` decrements it.
- Movement wraps at screen edges, but collision checks use ordinary Euclidean center distance and are not wrap-aware across the seam.
- Held movement reads `keys`; one-shot shooting and game-over restart consume `justPressed` through `pressed()`. Preserve that distinction when changing controls.
- Treat executable code as the gameplay source of truth: the README currently mentions power-ups and a shooting-star asteroid, but neither exists in `game.js`.
