# The Rabbit & Fox Game — interactive simulation

Companion to the table-top game in **Meeting 1** of the Bioengineering Practicum
(BIMB265125), Master's Programme in Biology, Faculty of Biology, Universitas
Gadjah Mada.

Candies are rabbits, sticky notes are foxes, and the grid is the grassland. The
page plays the same rules the students play by hand, one generation at a time,
and draws the tally sheet and the population graph as it goes — so the class can
compare what happened on their table with what happens on screen.

---

## Just run it

Open **`dist/index.html`** in any browser. Double-click it; that is all.

No server, no network, no `node_modules`. It is a single self-contained file, so
it works on a lecture-theatre machine with no internet and it can be copied onto
a USB stick.

## What is in it

| Control | What it does |
|---|---|
| **Version 1 / + immigration / + sanctuary** | The three rule sets from the session. Switching resets the run. |
| **Step ▸** | Plays one generation, animated: scatter → drop → count → update. |
| **Play / Pause** | Auto-steps to generation 24. |
| **Speed** | Slow / Normal / Fast / Instant. *Instant* is for sweeping through a whole run. |
| **Seed** | The same seed always gives the same run. Change it to show how differently identical rules can play out. |
| **Show the differential-equation model** | Overlays the continuous model — the Meeting 1 → Meeting 2 bridge. |
| **Download CSV** | The tally sheet, for students to plot themselves. |

In the tally sheet, `*` marks a generation where animals immigrated and `†` marks
one where the grid filled up and the rabbit count was capped at 36.

## The rules, exactly as implemented

Grassland: a 6 × 6 grid, at most one candy per cell — so **36 is the carrying
capacity K**. Start: 4 rabbits, 1 fox.

1. Scatter the surviving rabbits at random, one per cell.
2. Drop each fox's sticky note. It covers a 2 × 2 patch.
3. Every rabbit under a note is eaten. Foxes are resolved one at a time, so a
   later fox finds a meadow already thinned by the earlier ones.
4. A fox that caught **3 or more in that one drop** survives; fewer and it starves.
5. Every survivor — rabbit or fox — doubles for the next generation.
6. *(version 2)* If a species reaches 0 at the end of a turn, animals wander in
   from outside: 1 fox, or 3 rabbits.
7. *(version 3)* Foxes may not hunt in the 2 × 2 sanctuary corner.

The overlay is a logistic-prey Lotka–Volterra model

```
dR/dt = αR(1 − R/K) − βRF        dF/dt = δRF − γF
```

with `K = 36` and the parameters least-squares fitted to the version-2 tally in
the lecture deck, so the curve on screen and the figure on the slide agree.

## Layout

```
src/sim.js        the game engine — the rules, and a seeded PRNG
src/ode.js        the continuous model (RK4)
src/ui.js         board, animation, chart, tally
src/styles.css    UGM-branded styling, light and dark
src/app.html      the markup — ONE copy, shared by both builds
src/pages/index.astro   the Astro page; reads src/app.html so nothing is duplicated

tools/bundle.mjs           zero-dependency build → dist/index.html
tools/verify.mjs           drives the built page in Chromium and asserts behaviour
tools/parity.mjs           summary statistics from the JavaScript engine
tools/parity_reference.py  the same statistics from the Python model used for the slides

dist/index.html   the prebuilt, self-contained page — this is the one you open
```

## Editing it

```bash
npm install          # first time only
npm run dev          # Astro dev server with hot reload
npm run build        # Astro production build → dist-astro/
npm run bundle       # zero-dependency build → dist/index.html
```

`npm run bundle` needs nothing but Node — no `npm install`. It is what produced
the `dist/index.html` in this folder. Astro writes to `dist-astro/` so the two
builds never overwrite each other.

**After changing anything in `src/`, re-run `npm run bundle`,** or the file people
actually open will still be the old one.

## Checks

```bash
npm run parity          # JavaScript engine statistics
npm run parity:python   # the same statistics from the Python model (needs numpy)
node tools/verify.mjs   # drive the built page in a browser (needs puppeteer)
```

The two engines cannot match bit for bit — the browser uses its own PRNG rather
than NumPy's — so parity is checked on the **distribution** of outcomes over
thousands of seeds. Across 4 000 seeds × 3 rule sets, every summary statistic
agrees (mean and median final populations, mean peak foxes, fox-extinction rate,
rate of hitting the cap).

## Colours

Chrome is UGM navy `#01416B` and gold `#FDD402`. The two data series are a
checked categorical pair — `#C8102E` rabbits / `#1C7FC4` foxes in light mode,
`#E4485F` / `#3D9BE0` in dark — chosen to stay distinguishable under
colour-vision deficiency (worst-case ΔE 22.6, deuteranopia). Identity is never
carried by colour alone: the series are also distinguished by marker shape
(circle vs square), direct labels, a legend, and the tally table.

The deck's charts use the darker brand navy for the fox series; the lighter step
here is needed for a series line to stay legible on screen and in dark mode.

---

Adapted from the MnSTEP predator–prey activity, SERC, Carleton College:
<https://serc.carleton.edu/sp/mnstep/activities/26886.html>
