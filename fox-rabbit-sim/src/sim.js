/**
 * The Rabbit & Fox game — simulation engine.
 *
 * A direct port of the table-top rules used in Meeting 1 of the Bioengineering
 * Practicum (BIMB265125), and of the Python model that generated the figures in
 * the lecture deck.
 *
 *   Grassland  : 6 x 6 grid of cells, at most one candy (rabbit) per cell.
 *                36 cells is therefore the carrying capacity K.
 *   A fox      : a sticky note covering a 2 x 2 patch, dropped at random.
 *   Predation  : every rabbit under the note is eaten.
 *   Survival   : a fox needs >= 3 catches in ONE drop, or it starves.
 *   Breeding   : every survivor, rabbit or fox, doubles for the next generation.
 *
 * Optional rules, added during the session:
 *   influx     : if a species hits zero it is re-seeded from outside the meadow.
 *   sanctuary  : a 2 x 2 corner patch where foxes may not hunt.
 */

export const GRID = 6;
export const CELLS = GRID * GRID; // 36 — the carrying capacity K
export const FOX_SPAN = 2; // a sticky note covers 2 x 2 cells
export const CATCH_TO_SURVIVE = 3;
export const BREED_FACTOR = 2;
export const START = { rabbits: 4, foxes: 1 };
export const IMMIGRANT_RABBITS = 3;
export const IMMIGRANT_FOXES = 1;
export const SANCTUARY_CELLS = [0, 1, GRID, GRID + 1]; // the 2 x 2 top-left corner

export const RULE_SETS = {
  v1: {
    id: 'v1',
    name: 'Version 1 — the starting rules',
    tagline: 'A sealed meadow. Nothing comes in, nowhere is safe.',
    influx: false,
    sanctuary: false,
    expectation: 'The fox almost always starves in turn 1, and nothing brings it back.',
  },
  v2: {
    id: 'v2',
    name: 'Version 2 — immigration',
    tagline: 'Animals can wander in from outside when a species hits zero.',
    influx: true,
    sanctuary: false,
    expectation: 'Boom and bust: the populations cycle, sometimes violently.',
  },
  v3: {
    id: 'v3',
    name: 'Version 3 — immigration + sanctuary',
    tagline: 'As version 2, plus a 2 x 2 corner where foxes may not hunt.',
    influx: true,
    sanctuary: true,
    expectation: 'The refuge puts a floor under the prey, and the swings are damped.',
  },
};

/** Small, fast, seedable PRNG so that any run can be reproduced from its seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cellOf = (row, col) => row * GRID + col;
export const rowOf = (cell) => Math.floor(cell / GRID);
export const colOf = (cell) => cell % GRID;

function sanctuarySet(rules) {
  return new Set(rules.sanctuary ? SANCTUARY_CELLS : []);
}

/**
 * Play one generation.
 *
 * Returns the full record of the turn — not just the new counts — so that the
 * interface can animate exactly what happened: where the candies landed, where
 * each note fell, and which rabbits it caught.
 */
export function playTurn(state, rules, rand) {
  const sanct = sanctuarySet(rules);

  // 1 · SCATTER — place the rabbits in distinct cells (partial Fisher–Yates).
  const pool = Array.from({ length: CELLS }, (_, k) => k);
  const placed = Math.min(state.rabbits, CELLS);
  for (let k = 0; k < placed; k += 1) {
    const j = k + Math.floor(rand() * (CELLS - k));
    const tmp = pool[k];
    pool[k] = pool[j];
    pool[j] = tmp;
  }
  const scatter = pool.slice(0, placed);
  const alive = new Set(scatter);

  // 2 · DROP — one sticky note per fox, resolved one at a time, so a later fox
  //     finds a meadow already thinned by the earlier ones.
  const drops = [];
  let bredFoxes = 0;
  const free = GRID - FOX_SPAN + 1; // top-left corner of the 2 x 2 patch
  for (let f = 0; f < state.foxes; f += 1) {
    const row = Math.floor(rand() * free);
    const col = Math.floor(rand() * free);
    const patch = [];
    for (let dr = 0; dr < FOX_SPAN; dr += 1) {
      for (let dc = 0; dc < FOX_SPAN; dc += 1) {
        patch.push(cellOf(row + dr, col + dc));
      }
    }
    const huntable = patch.filter((c) => !sanct.has(c));
    const caught = huntable.filter((c) => alive.has(c));
    caught.forEach((c) => alive.delete(c)); // eaten either way
    const survives = caught.length >= CATCH_TO_SURVIVE;
    if (survives) bredFoxes += BREED_FACTOR;
    drops.push({ row, col, patch, huntable, caught, survives });
  }

  // 3 · UPDATE — survivors double, then the optional rules apply.
  const survivors = [...alive];
  let rabbits = survivors.length * BREED_FACTOR;
  let foxes = bredFoxes;
  const immigration = { rabbits: false, foxes: false };
  if (rules.influx) {
    if (foxes === 0) {
      foxes = IMMIGRANT_FOXES;
      immigration.foxes = true;
    }
    if (rabbits === 0) {
      rabbits = IMMIGRANT_RABBITS;
      immigration.rabbits = true;
    }
  }
  const capped = rabbits > CELLS;
  rabbits = Math.min(rabbits, CELLS);

  return {
    generation: state.generation,
    before: { rabbits: state.rabbits, foxes: state.foxes },
    scatter,
    drops,
    survivors,
    caughtTotal: drops.reduce((n, d) => n + d.caught.length, 0),
    fedFoxes: drops.filter((d) => d.survives).length,
    immigration,
    capped,
    after: { rabbits, foxes, generation: state.generation + 1 },
  };
}

/** A run that can be stepped one generation at a time. */
export function createRun(seed, rules) {
  const rand = mulberry32(seed);
  let state = { rabbits: START.rabbits, foxes: START.foxes, generation: 0 };
  const turns = [];
  const history = [{ generation: 0, rabbits: state.rabbits, foxes: state.foxes }];
  return {
    seed,
    rules,
    get state() {
      return state;
    },
    get turns() {
      return turns;
    },
    get history() {
      return history;
    },
    get extinct() {
      return state.rabbits === 0 && state.foxes === 0;
    },
    step() {
      const turn = playTurn(state, rules, rand);
      state = turn.after;
      turns.push(turn);
      history.push({
        generation: state.generation,
        rabbits: state.rabbits,
        foxes: state.foxes,
      });
      return turn;
    },
  };
}

/** Headless convenience: play `generations` turns and return the population trace. */
export function runSeries(seed, rules, generations = 12) {
  const run = createRun(seed, rules);
  for (let g = 0; g < generations; g += 1) run.step();
  return run.history;
}
