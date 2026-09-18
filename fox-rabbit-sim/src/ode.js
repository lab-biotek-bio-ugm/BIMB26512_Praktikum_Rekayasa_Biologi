/**
 * The continuous counterpart of the game: a logistic-prey Lotka–Volterra model.
 *
 *   dR/dt = alpha * R * (1 - R/K) - beta * R * F
 *   dF/dt = delta * R * F - gamma * F
 *
 * The logistic term is what represents the 36-cell grid: the grassland cannot
 * hold more candies than it has cells, so K = 36. The plain Lotka–Volterra
 * model has no such term, which is exactly the point made in Meeting 2.
 *
 * Default parameters are the least-squares fit to the version-2 tally used in
 * the lecture deck, so the overlay here and the figure on the slide agree.
 */

import { CELLS, START } from './sim.js';

export const DEFAULT_PARAMS = {
  alpha: 0.922, // prey breeding rate
  beta: 0.0759, // how dangerous one encounter is
  delta: 0.1013, // how efficiently a fox turns rabbits into foxes
  gamma: 2.021, // how fast a fox starves
  K: CELLS, // carrying capacity — the grid has 36 cells
};

function derivative([R, F], p) {
  return [
    p.alpha * R * (1 - R / p.K) - p.beta * R * F,
    p.delta * R * F - p.gamma * F,
  ];
}

/** Classic fourth-order Runge–Kutta — accurate enough that the step is invisible. */
export function integrate({
  generations = 12,
  samplesPerGeneration = 24,
  params = DEFAULT_PARAMS,
  initial = [START.rabbits, START.foxes],
} = {}) {
  const dt = 1 / samplesPerGeneration;
  const steps = generations * samplesPerGeneration;
  let y = [...initial];
  const out = [{ t: 0, rabbits: y[0], foxes: y[1] }];

  for (let i = 0; i < steps; i += 1) {
    const k1 = derivative(y, params);
    const k2 = derivative([y[0] + (dt / 2) * k1[0], y[1] + (dt / 2) * k1[1]], params);
    const k3 = derivative([y[0] + (dt / 2) * k2[0], y[1] + (dt / 2) * k2[1]], params);
    const k4 = derivative([y[0] + dt * k3[0], y[1] + dt * k3[1]], params);
    y = [
      y[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      y[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    ];
    // populations cannot go negative; rounding error near zero can push them there
    y[0] = Math.max(y[0], 0);
    y[1] = Math.max(y[1], 0);
    out.push({ t: (i + 1) * dt, rabbits: y[0], foxes: y[1] });
  }
  return out;
}
