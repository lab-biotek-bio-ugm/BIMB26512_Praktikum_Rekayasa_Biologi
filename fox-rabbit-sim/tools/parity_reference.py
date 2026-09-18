#!/usr/bin/env python3
"""Python reference for the parity harness — the same model that produced the
figures in the lecture deck. Prints the same summary statistics as
tools/parity.mjs so the two engines can be compared directly.

Run:  python3 tools/parity_reference.py [runs]
"""
import json
import sys

import numpy as np

GRID = 6
CAP = GRID * GRID
SANCT = {(0, 0), (0, 1), (1, 0), (1, 1)}
GENERATIONS = 12
RULES = {
    "v1": dict(influx=False, sanctuary=False),
    "v2": dict(influx=True, sanctuary=False),
    "v3": dict(influx=True, sanctuary=True),
}


def play(seed, influx, sanctuary, generations=GENERATIONS, rabbit_start=4, fox_start=1):
    rng = np.random.default_rng(seed)
    sanct = SANCT if sanctuary else set()
    R, F = rabbit_start, fox_start
    hist = [(R, F)]
    for _ in range(generations):
        R = min(R, CAP)
        cells = [(i, j) for i in range(GRID) for j in range(GRID)]
        idx = rng.choice(len(cells), size=min(R, len(cells)), replace=False)
        alive = {cells[i] for i in idx}
        new_F = 0
        for _f in range(F):
            i0 = int(rng.integers(0, GRID - 1))
            j0 = int(rng.integers(0, GRID - 1))
            patch = {(i0, j0), (i0 + 1, j0), (i0, j0 + 1), (i0 + 1, j0 + 1)} - sanct
            hit = alive & patch
            alive -= hit
            if len(hit) >= 3:
                new_F += 2
        R, F = len(alive) * 2, new_F
        if influx:
            if F == 0:
                F = 1
            if R == 0:
                R = 3
        hist.append((min(R, CAP), F))
    return np.array(hist)


runs = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
summary = {}
for key, rules in RULES.items():
    finalR, finalF, peakF, meanR = [], [], [], []
    fox_extinct, at_cap = 0, 0
    for seed in range(1, runs + 1):
        h = play(seed, **rules)
        R, F = h[:, 0], h[:, 1]
        finalR.append(R[-1])
        finalF.append(F[-1])
        peakF.append(F.max())
        meanR.append(R.mean())
        if (F[1:] == 0).any():
            fox_extinct += 1
        if (R == CAP).any():
            at_cap += 1
    summary[key] = {
        "mean_final_rabbits": round(float(np.mean(finalR)), 3),
        "median_final_rabbits": round(float(np.median(finalR)), 3),
        "mean_final_foxes": round(float(np.mean(finalF)), 3),
        "mean_peak_foxes": round(float(np.mean(peakF)), 3),
        "mean_mean_rabbits": round(float(np.mean(meanR)), 3),
        "pct_fox_extinct_ever": round(100 * fox_extinct / runs, 2),
        "pct_rabbits_hit_cap": round(100 * at_cap / runs, 2),
    }

print(json.dumps({"engine": "python", "runs": runs, "summary": summary}, indent=2))
