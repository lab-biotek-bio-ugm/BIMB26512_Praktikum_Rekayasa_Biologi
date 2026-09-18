/**
 * The Rabbit & Fox Game — interface.
 *
 * Framework-free ES modules on purpose: the page has to run from a file:// URL
 * in a lecture theatre with no network and no build step, while the same source
 * files are what the Astro project compiles.
 */

import {
  CELLS,
  GRID,
  RULE_SETS,
  START,
  colOf,
  createRun,
  rowOf,
} from './sim.js';
import { integrate } from './ode.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = 10;
const BOARD = 400;
const CELL = BOARD / GRID;
const EXTRA_RULES = {
  influx:
    'If a species reaches 0 at the end of a turn, animals wander in from outside (1 fox, or 3 rabbits).',
  sanctuary:
    'Foxes may not hunt in the 2 × 2 sanctuary corner — any part of a note covering it catches nothing.',
};

const $ = (id) => document.getElementById(id);
const el = {
  grid: $('grid'),
  phase: $('phase'),
  gen: $('out-gen'),
  rabbits: $('out-rabbits'),
  foxes: $('out-foxes'),
  caught: $('out-caught'),
  rulesName: $('rules-name'),
  rulesTagline: $('rules-tagline'),
  rulesExpect: $('rules-expect'),
  rulesList: document.querySelector('.rules-list'),
  step: $('btn-step'),
  play: $('btn-play'),
  reset: $('btn-reset'),
  dice: $('btn-dice'),
  csv: $('btn-csv'),
  speed: $('speed'),
  seed: $('seed'),
  showOde: $('show-ode'),
  chart: $('chart'),
  tooltip: $('tooltip'),
  tallyBody: $('tally-body'),
  legendOde: document.querySelector('.legend-ode'),
  segButtons: [...document.querySelectorAll('.segmented button')],
};

const state = {
  rulesKey: 'v1',
  seed: 7,
  run: null,
  playing: false,
  busy: false,
  token: 0,
  boardCells: [],
  odeCurve: integrate({ generations: 14 }),
};

/* ------------------------------------------------------------- helpers -- */
const wait = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const speed = () => Number(el.speed.value);
const cx = (cell) => PAD + colOf(cell) * CELL + CELL / 2;
const cy = (cell) => PAD + rowOf(cell) * CELL + CELL / 2;

function make(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* --------------------------------------------------------------- board -- */
let layers = {};

function drawBoard() {
  el.grid.replaceChildren();
  const keep = [
    make('title', {}),
    make('desc', {}),
  ];
  keep[0].textContent = 'The 6 by 6 grassland';
  keep[1].textContent =
    'Candies are rabbits; sticky notes are foxes. Live counts are reported in the readout below and in the tally table.';
  keep.forEach((n) => el.grid.append(n));

  el.grid.append(
    make('rect', {
      x: PAD, y: PAD, width: BOARD, height: BOARD, rx: 6,
      fill: css('--grass'), stroke: css('--grass-edge'), 'stroke-width': 2.5,
    }),
  );

  const lines = make('g', { stroke: css('--grass-line'), 'stroke-width': 1 });
  for (let i = 1; i < GRID; i += 1) {
    lines.append(make('line', { x1: PAD + i * CELL, y1: PAD, x2: PAD + i * CELL, y2: PAD + BOARD }));
    lines.append(make('line', { x1: PAD, y1: PAD + i * CELL, x2: PAD + BOARD, y2: PAD + i * CELL }));
  }
  el.grid.append(lines);

  layers.sanctuary = make('g');
  layers.notes = make('g');
  layers.rabbits = make('g');
  layers.badges = make('g');
  el.grid.append(layers.sanctuary, layers.notes, layers.rabbits, layers.badges);
  drawSanctuary();
}

function drawSanctuary() {
  layers.sanctuary.replaceChildren();
  if (!RULE_SETS[state.rulesKey].sanctuary) return;
  layers.sanctuary.append(
    make('rect', {
      x: PAD + 4, y: PAD + 4, width: CELL * 2 - 8, height: CELL * 2 - 8, rx: 5,
      fill: 'none', stroke: css('--navy'), 'stroke-width': 2.5, 'stroke-dasharray': '7 5',
    }),
  );
  // sits just inside the top edge of the patch, with a halo, so it stays
  // legible when candies are sitting in the sanctuary cells
  const label = make('text', {
    x: PAD + CELL, y: PAD + 20,
    'text-anchor': 'middle', fill: css('--navy'),
    stroke: css('--grass'), 'stroke-width': 3.5, 'paint-order': 'stroke fill',
    'font-size': 9.5, 'font-weight': 700, 'font-family': 'inherit',
    'letter-spacing': 0.5,
  });
  label.textContent = 'SANCTUARY';
  layers.sanctuary.append(label);
}

function renderRabbits(cells, { animate = false } = {}) {
  state.boardCells = cells; // remembered so a re-draw can restore the board
  layers.rabbits.replaceChildren();
  cells.forEach((cell, i) => {
    const dot = make('circle', {
      cx: cx(cell), cy: cy(cell), r: 13,
      fill: css('--rabbit'), stroke: css('--surface'), 'stroke-width': 2,
      'data-cell': cell,
    });
    if (animate && speed() > 0) {
      dot.style.transformOrigin = `${cx(cell)}px ${cy(cell)}px`;
      dot.animate(
        [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 260, delay: Math.min(i * 16, 320), fill: 'backwards', easing: 'cubic-bezier(.2,.9,.3,1.4)' },
      );
    }
    layers.rabbits.append(dot);
  });
}

function addNote(drop, index) {
  const x = PAD + drop.col * CELL + 4;
  const y = PAD + drop.row * CELL + 4;
  const size = CELL * 2 - 8;
  const tilt = ((index * 37) % 9) - 4;
  const g = make('g', { transform: `rotate(${tilt} ${x + size / 2} ${y + size / 2})` });
  g.append(
    make('rect', {
      x, y, width: size, height: size, rx: 4,
      fill: css('--fox'), 'fill-opacity': 0.3,
      stroke: css('--fox'), 'stroke-width': 2.5,
    }),
  );
  if (speed() > 0) {
    g.style.transformOrigin = `${x + size / 2}px ${y + size / 2}px`;
    g.animate(
      [
        { transform: `rotate(${tilt}deg) scale(1.9) translateY(-26px)`, opacity: 0 },
        { transform: `rotate(${tilt}deg) scale(1)`, opacity: 1 },
      ],
      { duration: 300, easing: 'cubic-bezier(.3,.7,.2,1)' },
    );
  }
  layers.notes.append(g);
  return { g, x, y, size };
}

function addBadge(note, text, tone) {
  const g = make('g');
  const w = text.length * 6.2 + 16;
  g.append(
    make('rect', {
      x: note.x + note.size / 2 - w / 2, y: note.y + note.size / 2 - 11,
      width: w, height: 22, rx: 11,
      fill: tone === 'good' ? css('--grass-edge') : css('--ink-3'),
    }),
  );
  const t = make('text', {
    x: note.x + note.size / 2, y: note.y + note.size / 2 + 4,
    'text-anchor': 'middle', fill: '#fff',
    'font-size': 11, 'font-weight': 700, 'font-family': 'inherit',
  });
  t.textContent = text;
  g.append(t);
  layers.badges.append(g);
}

function flashCaught(cells) {
  cells.forEach((cell) => {
    const dot = layers.rabbits.querySelector(`[data-cell="${cell}"]`);
    if (!dot) return;
    dot.setAttribute('fill', css('--ink-3'));
    if (speed() > 0) {
      dot.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 220, fill: 'forwards' });
    } else {
      dot.setAttribute('opacity', '0.25');
    }
  });
}

function removeCaught(cells) {
  cells.forEach((cell) => layers.rabbits.querySelector(`[data-cell="${cell}"]`)?.remove());
  // keep the remembered board in step with the DOM, or a redraw resurrects them
  const gone = new Set(cells);
  state.boardCells = (state.boardCells ?? []).filter((c) => !gone.has(c));
}

/* --------------------------------------------------------------- chart -- */
const CH = { w: 760, h: 340, l: 46, r: 20, t: 16, b: 38 };

function chartScales(maxGen) {
  const innerW = CH.w - CH.l - CH.r;
  const innerH = CH.h - CH.t - CH.b;
  return {
    x: (g) => CH.l + (g / maxGen) * innerW,
    y: (v) => CH.t + innerH - (v / CELLS) * innerH,
    innerW,
    innerH,
  };
}

function drawChart() {
  const history = state.run.history;
  const maxGen = Math.max(12, history.length - 1);
  const s = chartScales(maxGen);
  const svg = el.chart;
  svg.replaceChildren();

  const title = make('title', {});
  title.textContent = 'Rabbit and fox counts by generation';
  const desc = make('desc', {});
  desc.textContent = 'The same numbers are listed in the tally table below.';
  svg.append(title, desc);

  const ink3 = css('--ink-3');
  const lineCol = css('--line');

  // --- recessive grid + y axis -------------------------------------------
  const grid = make('g');
  for (let v = 0; v <= CELLS; v += 6) {
    grid.append(
      make('line', {
        x1: CH.l, x2: CH.w - CH.r, y1: s.y(v), y2: s.y(v),
        stroke: v === 0 ? ink3 : lineCol, 'stroke-width': 1,
      }),
    );
    const t = make('text', {
      x: CH.l - 9, y: s.y(v) + 4, 'text-anchor': 'end',
      fill: ink3, 'font-size': 11, 'font-family': 'inherit',
    });
    t.textContent = String(v);
    grid.append(t);
  }
  // the grid capacity is a real feature of the model, so name it
  grid.append(
    make('line', {
      x1: CH.l, x2: CH.w - CH.r, y1: s.y(CELLS), y2: s.y(CELLS),
      stroke: css('--gold'), 'stroke-width': 2, 'stroke-dasharray': '6 4',
    }),
  );
  const cap = make('text', {
    x: CH.l + 6, y: s.y(CELLS) - 6, fill: css('--amber-ink'),
    'font-size': 11, 'font-weight': 700, 'font-family': 'inherit',
  });
  cap.textContent = 'the grid holds 36 — this is K';
  grid.append(cap);

  for (let g = 0; g <= maxGen; g += 1) {
    if (maxGen > 14 && g % 2 === 1) continue;
    const t = make('text', {
      x: s.x(g), y: CH.h - CH.b + 20, 'text-anchor': 'middle',
      fill: ink3, 'font-size': 11, 'font-family': 'inherit',
    });
    t.textContent = String(g);
    grid.append(t);
  }
  const xlab = make('text', {
    x: CH.l + s.innerW / 2, y: CH.h - 2, 'text-anchor': 'middle',
    fill: ink3, 'font-size': 11.5, 'font-family': 'inherit',
  });
  xlab.textContent = 'generation';
  grid.append(xlab);

  const ylab = make('text', {
    x: 12, y: CH.t + s.innerH / 2, 'text-anchor': 'middle',
    transform: `rotate(-90 12 ${CH.t + s.innerH / 2})`,
    fill: ink3, 'font-size': 11.5, 'font-family': 'inherit',
  });
  ylab.textContent = 'count on the grid';
  grid.append(ylab);
  svg.append(grid);

  // --- the continuous model, underneath -----------------------------------
  if (el.showOde.checked) {
    const ode = make('g', { opacity: 0.55 });
    for (const [key, colour] of [['rabbits', css('--rabbit')], ['foxes', css('--fox')]]) {
      const pts = state.odeCurve
        .filter((p) => p.t <= maxGen)
        .map((p) => `${s.x(p.t).toFixed(2)},${s.y(Math.min(p[key], CELLS)).toFixed(2)}`)
        .join(' ');
      ode.append(
        make('polyline', {
          points: pts, fill: 'none', stroke: colour,
          'stroke-width': 2, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round',
        }),
      );
    }
    svg.append(ode);
  }

  // --- the two series -----------------------------------------------------
  const series = [
    { key: 'rabbits', label: 'Rabbits', colour: css('--rabbit'), shape: 'circle' },
    { key: 'foxes', label: 'Foxes', colour: css('--fox'), shape: 'square' },
  ];
  for (const sr of series) {
    const g = make('g');
    g.append(
      make('polyline', {
        points: history.map((d) => `${s.x(d.generation)},${s.y(d[sr.key])}`).join(' '),
        fill: 'none', stroke: sr.colour, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }),
    );
    history.forEach((d) => {
      const x = s.x(d.generation);
      const y = s.y(d[sr.key]);
      g.append(
        sr.shape === 'circle'
          ? make('circle', { cx: x, cy: y, r: 4.5, fill: sr.colour, stroke: css('--surface'), 'stroke-width': 2 })
          : make('rect', { x: x - 4.2, y: y - 4.2, width: 8.4, height: 8.4, rx: 1.4, fill: sr.colour, stroke: css('--surface'), 'stroke-width': 2 }),
      );
    });
    // direct label on the last point — identity is never colour alone
    const last = history[history.length - 1];
    if (last) {
      const lx = s.x(last.generation);
      const ly = s.y(last[sr.key]);
      const flip = lx > CH.w - CH.r - 70;
      const t = make('text', {
        x: flip ? lx - 10 : lx + 10, y: ly + 4,
        'text-anchor': flip ? 'end' : 'start',
        fill: sr.colour, 'font-size': 11.5, 'font-weight': 700, 'font-family': 'inherit',
      });
      t.textContent = `${sr.label} ${last[sr.key]}`;
      g.append(t);
    }
    svg.append(g);
  }

  // --- hover layer --------------------------------------------------------
  const hover = make('g', { id: 'hover-layer', visibility: 'hidden' });
  hover.append(
    make('line', {
      id: 'crosshair', y1: CH.t, y2: CH.t + s.innerH,
      stroke: ink3, 'stroke-width': 1, 'stroke-dasharray': '3 3',
    }),
  );
  svg.append(hover);

  const capture = make('rect', {
    x: CH.l, y: CH.t, width: s.innerW, height: s.innerH,
    fill: 'transparent', style: 'cursor:crosshair',
  });
  capture.addEventListener('pointermove', (ev) => showTooltip(ev, s, maxGen));
  capture.addEventListener('pointerleave', hideTooltip);
  svg.append(capture);
}

function showTooltip(ev, s, maxGen) {
  const history = state.run.history;
  const box = el.chart.getBoundingClientRect();
  const scale = CH.w / box.width;
  const svgX = (ev.clientX - box.left) * scale;
  // The axis always spans at least 12 generations, so clamp to what has actually
  // been played — otherwise hovering the empty right-hand side finds nothing.
  const raw = Math.round(((svgX - CH.l) / s.innerW) * maxGen);
  const gen = Math.min(Math.max(raw, 0), history.length - 1);
  const row = history[gen];
  if (!row) return hideTooltip();

  const layer = el.chart.querySelector('#hover-layer');
  const line = el.chart.querySelector('#crosshair');
  line.setAttribute('x1', s.x(gen));
  line.setAttribute('x2', s.x(gen));
  layer.setAttribute('visibility', 'visible');

  el.tooltip.hidden = false;
  el.tooltip.innerHTML = `
    <div class="tt-head">Generation ${row.generation}</div>
    <div class="tt-row"><span class="swatch swatch-rabbit"></span><span>Rabbits</span><span>${row.rabbits}</span></div>
    <div class="tt-row"><span class="swatch swatch-fox"></span><span>Foxes</span><span>${row.foxes}</span></div>`;
  el.tooltip.style.left = `${(s.x(gen) / CH.w) * box.width}px`;
  el.tooltip.style.top = `${(s.y(Math.max(row.rabbits, row.foxes)) / CH.h) * box.height}px`;
}

function hideTooltip() {
  el.tooltip.hidden = true;
  el.chart.querySelector('#hover-layer')?.setAttribute('visibility', 'hidden');
}

/* --------------------------------------------------------------- tally -- */
function addTallyRow(turn) {
  if (el.tallyBody.querySelector('.empty')) el.tallyBody.replaceChildren();
  const tr = document.createElement('tr');
  tr.className = 'is-new';
  const cells = [
    String(turn.generation),
    String(turn.before.rabbits),
    String(turn.caughtTotal),
    String(turn.fedFoxes),
    String(turn.after.rabbits) + (turn.immigration.rabbits ? ' *' : '') + (turn.capped ? ' †' : ''),
    String(turn.after.foxes) + (turn.immigration.foxes ? ' *' : ''),
  ];
  cells.forEach((text, i) => {
    const td = document.createElement('td');
    td.textContent = text;
    if (i === 4) td.className = 'cell-rabbit';
    if (i === 5) td.className = 'cell-fox';
    tr.append(td);
  });
  el.tallyBody.append(tr);
  // Scroll the table's own container, never the document — scrollIntoView walks
  // every ancestor and makes the whole page jump mid-demonstration.
  const scroller = el.tallyBody.closest('.table-scroll');
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

/* ------------------------------------------------------------ one turn -- */
async function playGeneration() {
  if (state.busy || state.run.state.generation >= 40) return;
  state.busy = true;
  const token = state.token;
  const alive = () => token === state.token;
  el.step.disabled = true;

  const turn = state.run.step();
  const ms = speed();

  layers.notes.replaceChildren();
  layers.badges.replaceChildren();

  setPhase('1 · SCATTER', 'the surviving rabbits are placed at random, one per cell');
  renderRabbits(turn.scatter, { animate: true });
  el.caught.textContent = '0';
  await wait(ms * 0.8);
  if (!alive()) return finish();

  let running = 0;
  for (let i = 0; i < turn.drops.length; i += 1) {
    if (!alive()) return finish();
    const drop = turn.drops[i];
    setPhase('2 · DROP', `fox ${i + 1} of ${turn.drops.length} — a note covers a 2 × 2 patch`);
    const note = addNote(drop, i);
    await wait(ms * 0.5);
    if (!alive()) return finish();

    flashCaught(drop.caught);
    running += drop.caught.length;
    el.caught.textContent = String(running);
    addBadge(
      note,
      drop.survives ? `${drop.caught.length} caught — survives` : `${drop.caught.length} caught — starves`,
      drop.survives ? 'good' : 'bad',
    );
    await wait(ms * 0.55);
    if (!alive()) return finish();
    removeCaught(drop.caught);
  }

  setPhase('3 · UPDATE', 'every survivor doubles for the next generation');
  layers.badges.replaceChildren();
  await wait(ms * 0.7);
  if (!alive()) return finish();

  const notes = [];
  if (turn.immigration.rabbits) notes.push('3 rabbits wandered in');
  if (turn.immigration.foxes) notes.push('1 fox wandered in');
  if (turn.capped) notes.push('the grid filled up (capped at 36)');
  setPhase(
    `Generation ${turn.after.generation}`,
    notes.length ? notes.join(' · ') : `${turn.caughtTotal} caught · ${turn.fedFoxes} fox(es) fed`,
  );

  updateReadout();
  addTallyRow(turn);
  drawChart();
  finish();

  function finish() {
    state.busy = false;
    el.step.disabled = false;
    return undefined;
  }
}

function setPhase(label, detail) {
  el.phase.innerHTML = `<strong>${label}</strong>${detail ? ` — ${detail}` : ''}`;
}

function updateReadout() {
  const s = state.run.state;
  el.gen.textContent = String(s.generation);
  el.rabbits.textContent = String(s.rabbits);
  el.foxes.textContent = String(s.foxes);
}

/* ------------------------------------------------------------- lifecycle */
function applyRules() {
  const rules = RULE_SETS[state.rulesKey];
  el.rulesName.textContent = rules.name;
  el.rulesTagline.textContent = rules.tagline;
  el.rulesExpect.textContent = rules.expectation;
  el.segButtons.forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.rules === state.rulesKey)),
  );
  el.rulesList.querySelectorAll('[data-extra]').forEach((n) => n.remove());
  const extras = [];
  if (rules.influx) extras.push(EXTRA_RULES.influx);
  if (rules.sanctuary) extras.push(EXTRA_RULES.sanctuary);
  extras.forEach((text) => {
    const li = document.createElement('li');
    li.className = 'is-new';
    li.dataset.extra = 'true';
    li.textContent = text;
    el.rulesList.append(li);
  });
}

function reset() {
  state.token += 1;
  state.busy = false;
  stopPlaying();
  state.seed = Math.max(1, Number(el.seed.value) || 1);
  state.run = createRun(state.seed, RULE_SETS[state.rulesKey]);
  el.step.disabled = false;
  drawSanctuary();
  renderRabbits([]);
  layers.notes.replaceChildren();
  layers.badges.replaceChildren();
  el.tallyBody.replaceChildren();
  const tr = document.createElement('tr');
  tr.className = 'empty';
  const td = document.createElement('td');
  td.colSpan = 6;
  td.textContent = 'No generations played yet.';
  tr.append(td);
  el.tallyBody.append(tr);
  el.caught.textContent = '—';
  updateReadout();
  setPhase('Ready', 'press Step to play one generation');
  drawChart();
  hideTooltip();
}

let playTimer = null;
function stopPlaying() {
  state.playing = false;
  el.play.textContent = 'Play';
  if (playTimer) clearTimeout(playTimer);
  playTimer = null;
}

async function tick() {
  if (!state.playing) return;
  await playGeneration();
  if (!state.playing) return;
  if (state.run.state.generation >= 24) return stopPlaying();
  playTimer = setTimeout(tick, Math.max(120, speed() * 0.4));
}

function downloadCsv() {
  const rows = [['generation', 'rabbits_at_start', 'rabbits_caught', 'foxes_fed', 'rabbits_next', 'foxes_next']];
  state.run.turns.forEach((t) =>
    rows.push([t.generation, t.before.rabbits, t.caughtTotal, t.fedFoxes, t.after.rabbits, t.after.foxes]),
  );
  const csv = rows.map((r) => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `fox-rabbit_${state.rulesKey}_seed${state.seed}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- wire -- */
el.segButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    state.rulesKey = btn.dataset.rules;
    applyRules();
    reset();
  }),
);
el.step.addEventListener('click', () => {
  stopPlaying();
  playGeneration();
});
el.play.addEventListener('click', () => {
  if (state.playing) return stopPlaying();
  state.playing = true;
  el.play.textContent = 'Pause';
  tick();
});
el.reset.addEventListener('click', reset);
el.dice.addEventListener('click', () => {
  el.seed.value = String(1 + Math.floor(Math.random() * 99999));
  reset();
});
el.seed.addEventListener('change', reset);
el.showOde.addEventListener('change', () => {
  el.legendOde.hidden = !el.showOde.checked;
  drawChart();
});
el.csv.addEventListener('click', downloadCsv);
window.addEventListener('resize', () => hideTooltip());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  // drawBoard() rebuilds the layers from scratch, so the candies currently on
  // the board have to be put back afterwards.
  drawBoard();
  renderRabbits(state.boardCells ?? []);
  drawChart();
});

/* --------------------------------------------------------------- start -- */
drawBoard();
applyRules();
reset();
