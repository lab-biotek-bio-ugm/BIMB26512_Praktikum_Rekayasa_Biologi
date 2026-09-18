/**
 * Parity harness.
 *
 * The browser engine uses its own PRNG (mulberry32), so it cannot reproduce
 * NumPy's PCG64 stream bit for bit. What must match is the MODEL, not the
 * stream: over many seeds the two implementations have to agree on the
 * distribution of outcomes.
 *
 * Run:  node tools/parity.mjs [runs]
 * Prints summary statistics for each rule set, to be compared against the
 * Python reference printed by tools/parity_reference.py.
 */
import { RULE_SETS, runSeries } from '../src/sim.js';

const RUNS = Number(process.argv[2] ?? 4000);
const GENERATIONS = 12;

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const summary = {};
for (const key of ['v1', 'v2', 'v3']) {
  const rules = RULE_SETS[key];
  const finalR = [];
  const finalF = [];
  const peakF = [];
  const meanR = [];
  let foxExtinctEver = 0;
  let atCapEver = 0;

  for (let seed = 1; seed <= RUNS; seed += 1) {
    const h = runSeries(seed, rules, GENERATIONS);
    const R = h.map((d) => d.rabbits);
    const F = h.map((d) => d.foxes);
    finalR.push(R[R.length - 1]);
    finalF.push(F[F.length - 1]);
    peakF.push(Math.max(...F));
    meanR.push(R.reduce((a, b) => a + b, 0) / R.length);
    if (F.slice(1).some((v) => v === 0)) foxExtinctEver += 1;
    if (R.some((v) => v === 36)) atCapEver += 1;
  }

  const sortedR = [...finalR].sort((a, b) => a - b);
  summary[key] = {
    mean_final_rabbits: +(finalR.reduce((a, b) => a + b, 0) / RUNS).toFixed(3),
    median_final_rabbits: +quantile(sortedR, 0.5).toFixed(3),
    mean_final_foxes: +(finalF.reduce((a, b) => a + b, 0) / RUNS).toFixed(3),
    mean_peak_foxes: +(peakF.reduce((a, b) => a + b, 0) / RUNS).toFixed(3),
    mean_mean_rabbits: +(meanR.reduce((a, b) => a + b, 0) / RUNS).toFixed(3),
    pct_fox_extinct_ever: +((100 * foxExtinctEver) / RUNS).toFixed(2),
    pct_rabbits_hit_cap: +((100 * atCapEver) / RUNS).toFixed(2),
  };
}

console.log(JSON.stringify({ engine: 'javascript', runs: RUNS, summary }, null, 2));
