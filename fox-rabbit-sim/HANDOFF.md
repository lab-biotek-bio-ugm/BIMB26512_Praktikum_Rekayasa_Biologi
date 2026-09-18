# Handover to Claude Code in WSL

The npm registry was unreachable from the sandbox that built this, so **Astro was
never installed and `npm run build` has never actually been run.** Everything
else is built and verified.

## What is done and checked

- `src/sim.js` — the game engine. Verified against the Python model that produced
  the lecture figures: 4 000 seeds × 3 rule sets, every summary statistic agrees.
- `src/ode.js`, `src/ui.js`, `src/styles.css`, `src/app.html` — complete.
- `dist/index.html` — built by `tools/bundle.mjs` (zero dependencies) and driven
  in headless Chromium by `tools/verify.mjs`: all checks pass.
- Series colours validated for colour-vision deficiency in light and dark mode.

## What is NOT checked

- `package.json`, `astro.config.mjs` and `src/pages/index.astro` were written
  without ever running Astro. They are small and standard, but unproven.

## Paste this into Claude Code

> This folder is an Astro project for a teaching simulation. It was authored in a
> sandbox with no access to the npm registry, so Astro has never been installed
> and `npm run build` has never been run. Everything else is verified — read
> `README.md` first.
>
> Please:
>
> 1. `npm install`, then `npm run dev`, and confirm the page renders and works:
>    stepping a generation animates the board, the three rule-set buttons reset
>    the run, the chart and tally update, the ODE toggle adds two dashed curves,
>    and the same seed reproduces the same run.
> 2. `npm run build` and confirm `dist-astro/index.html` opens correctly from a
>    `file://` URL (assets inlined, relative paths). Fix `astro.config.mjs` or
>    `src/pages/index.astro` if it does not.
> 3. Confirm the Astro output and `dist/index.html` behave the same. `src/app.html`
>    is the single copy of the markup and is read by both builds — keep it that way;
>    do not fork the markup into the `.astro` file.
> 4. Re-run the checks: `npm run parity`, `npm run parity:python` (needs numpy),
>    and `node tools/verify.mjs` (needs puppeteer or playwright — adjust the
>    launcher at the top of that file to whatever is installed).
> 5. Report anything you changed and why.
>
> Two constraints that matter:
> - `dist/index.html` must stay a single self-contained file that opens from
>   `file://` with no server and no network. It is what gets projected in class.
> - After any change under `src/`, re-run `npm run bundle` so `dist/index.html`
>   is regenerated.

## If Astro turns out to be more trouble than it is worth

Nothing depends on it. `npm run bundle` produces the whole page from `src/` with
plain Node and no dependencies. Deleting `package.json`, `astro.config.mjs` and
`src/pages/` leaves a complete, working project.
