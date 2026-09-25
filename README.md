# Bioengineering Practicum · BIMB265125

Course material for the Bioengineering Practicum (T: 0 / P: 1 sks), Master's
Programme in Biology, Faculty of Biology, Universitas Gadjah Mada — Odd
Semester 2026/2027.

Teaching team: Matin Nuhamunada, S.Si., M.Sc., Ph.D. (Coordinator) ·
Dr. Miftahul Ilmi, S.Si., M.Si.

Companion site: <https://bimb265125.matinnu.org/>

## Notebooks

Students open these on Google Colab and save a copy in their own Drive
(*File → Save a copy in Drive*) before starting.

| # | Topic | Notebook | |
|---|---|---|---|
| 2 | Simple ODE models: mass action, open vs closed networks, Euler vs `solve_ivp`, Lotka–Volterra | [`M02_simple_ODE_models.ipynb`](notebooks/M02_simple_ODE_models.ipynb) | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/lab-biotek-bio-ugm/BIMB26512_Praktikum_Rekayasa_Biologi/blob/main/notebooks/M02_simple_ODE_models.ipynb) |
| 3 | Enzyme kinetics (Ingalls ch. 3): the mechanism as data, the Michaelis–Menten reduction, stiffness, a virtual assay, competitive inhibition | [`M03_michaelis_menten.ipynb`](notebooks/M03_michaelis_menten.ipynb) | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/lab-biotek-bio-ugm/BIMB26512_Praktikum_Rekayasa_Biologi/blob/main/notebooks/M03_michaelis_menten.ipynb) |

The notebooks are blank templates: they are committed without outputs, and the
`TODO` cells are left for students to fill in. Colab loads them straight from
`main`, so a change reaches students as soon as it is pushed.

## Repository layout

| Path | What |
|---|---|
| `index.qmd`, `meetings/` | The companion site (a Quarto book): one page per meeting |
| `notebooks/` | Colab notebooks for the hands-on blocks |
| `fox-rabbit-sim/` | The interactive Rabbit & Fox game from meeting 1 — see its own [README](fox-rabbit-sim/README.md) |
| `_quarto.yml`, `custom.scss` | Site configuration and theme |

Slide decks (`*.pptx`) are git-ignored. `_quarto.yml` expects them in the
repository root when you render the site.

## Building the site

```bash
quarto preview        # live preview while editing
quarto render         # full build into _book/
```

Every push to `main` renders the site and deploys it to Cloudflare Pages
(`.github/workflows/publish.yml`).

To add a meeting, write `meetings/mNN-<topic>.qmd`, then add it to `chapters`
in `_quarto.yml`, to the schedule table in `index.qmd` and, if it has a
notebook, to `resources` in `_quarto.yml` and to the table above.
