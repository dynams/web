# n×m games: design for testing the three co-adaptation experiments beyond scalar actions

This document designs, from the ground up, a platform extension that tests the
three experiments of *Human adaptation to adaptive machines converges to
game-theoretic equilibria* (Chasnov, Ratliff, Burden — arXiv:2305.01124,
Sci. Rep. 2025) in games where the **human controls n dimensions and the
machine controls m dimensions**. The central obstacle is input: a human holds
a 2-D pointer, so commanding x ∈ ℝⁿ requires an interface. We propose four
mappings, an automated + human test battery that certifies "n dimensions are
controllable by a 2-D mouse" before any game trial runs, and the statistical
evaluation for the game experiments themselves.

Everything described here is implemented and tested in this repo:

| piece | file |
|---|---|
| game math: equilibria, steering, estimators, game designer | `js/ds/environments/nxm_math.js` |
| environment (platform contract `reset/step`) | `js/ds/environments/nxmgame.js` |
| 2D-pointer → ℝⁿ mappings + simulated users | `js/ds/experiments/nxm_mappings.js` |
| presentation/IO layer (canvas UI + cost bar) | `js/ds/experiments/nxm.js` |
| between-trial machine updates (Exp 2, Exp 3) | `js/ds/protocols/nxmiter.js` |
| named configurations | `js/ds/protocols/registrar.js` (`nxmgame-*`, `nxmreach-0`, `nxmtrack-0`) |
| study definitions | `study/nxm-exp{1,2,3}.json`, `study/nxm-calib.json` |
| study page / interactive demo | `study/nxmgame.html`, `demo/nxmgame.html` |
| tests (math, experiments-in-sim, controllability, env) | `test/*.mjs`, run with `npm test` |

## 1. Background: what quadgame2 and the paper established

The existing platform runs scalar quadratic games. `study/quadgame.html`
(client-side engine, `js/ds/**`) is the mature path: a human moves a cursor
horizontally (x ∈ ℝ), a machine updates y ∈ ℝ, and the only feedback is a
black bar whose height is the human's cost ("make this as small as possible").
`study/quadgame2.html` is a thin WebSocket client where a server owns the
dynamics; `study/quadgame3.html` is a self-contained prototype. The paper's
three experiments, run on this platform with n = m = 1:

1. **Gradient play.** The machine descends its own cost with rate γ, swept
   over 7 values (2 reps each). Slow γ → outcomes at the **Nash equilibrium**
   (NE); fast γ → the **human-led Stackelberg equilibrium** (SE).
2. **Conjectural variations.** Between trials the machine estimates the slope
   of the human's policy from pairs of probe trials and best-responds
   *through* the estimate. Iterating moves outcomes from SE to the
   **consistent conjectural variations equilibrium** (CCVE).
3. **Policy gradient.** The machine commits to a policy (an affine map from
   the human's action to its own) and improves it by gradient estimates.
   Outcomes move to the **machine's global optimum** — a reverse-Stackelberg
   result: the machine steers the human while the human plays optimally
   against the landscape it experiences.

The n×m generalization asks: do these equilibrium-selection results survive
when the human's action space is bigger than their input device?

## 2. The n×m quadratic game

Human plays x ∈ ℝⁿ, machine plays y ∈ ℝᵐ:

```
f_H(x,y) = ½(x−x₁)ᵀA(x−x₁) + (x−x₁)ᵀB(y−y₁) + ½(y−y₁)ᵀH(y−y₁)
f_M(x,y) = ½(y−y₂)ᵀD(y−y₂) + (y−y₂)ᵀC(x−x₂) + ½(x−x₂)ᵀE(x−x₂)
```

A ≻ 0 (n×n), D ≻ 0 (m×m); H, E ⪰ 0 give each player a well-defined global
optimum at its center: (x₁,y₁) for the human when H − BᵀA⁻¹B ⪰ 0, (x₂,y₂)
for the machine when E − CᵀD⁻¹C ⪰ 0. This is the direct generalization of
quadgame's `a,b,h / d,c,e` coefficients.

Closed-form equilibria (all in `nxm_math.js`, verified in `test/nxm_math.test.mjs`):

- **NE**: stack the two first-order conditions into one linear solve.
- **SE (human leads)**: machine's reaction is affine with slope
  L_br = −D⁻¹C; the human minimizes the composite cost, with induced Hessian
  A + BL_br + L_brᵀBᵀ + L_brᵀH L_br (must be ≻ 0).
- **CCVE**: conjectures K = ∂x/∂y (machine's model of the human) and
  L = ∂y/∂x (human's model of the machine) satisfy the coupled fixed point
  K = −(A+LᵀBᵀ)⁻¹(B+LᵀH), L = −(D+KᵀCᵀ)⁻¹(C+KᵀE); the equilibrium point
  solves the two conjectural first-order conditions.
- **MO / reverse Stackelberg**: the machine plays y = l + Lx. The human's
  induced optimum equals the machine's global optimum (x₂,y₂) iff
  Lᵀv = w with v = Bᵀ(x₂−x₁) + H(y₂−y₁), w = −[A(x₂−x₁) + B(y₂−y₁)] and
  l = y₂ − Lx₂. For m > 1 this is an (m·n − n)-dimensional affine family;
  `steering()` searches it for a policy whose induced human Hessian is ≻ 0
  (the second-order condition that keeps the human's problem convex — without
  it the "steered" human runs to the rails and the prediction is void).

**Game design conditions.** `designGame(n, m, seed)` random-searches
coefficient space subject to, in order:

1. **Strong monotonicity**: sym([[A,B],[C,D]]) ≻ 0.05·I. This makes the NE
   unique and gradient play stable at *any* timescale ratio — the regime
   Experiment 1 sweeps. (Without it we found games whose Nash is unstable
   under gradient play: the coupled state saturates at the box bounds. The
   sweep would then be meaningless.)
2. Each player's global optimum exists (H, E constructed as
   BᵀA⁻¹B + SPD, CᵀD⁻¹C + SPD, so this holds by construction).
3. CCVE fixed point converges; SE second-order condition holds; steering
   policy exists with induced-Hessian margin.
4. **Identifiability**: all pairwise distances among {NE, SE, CCVE, MO}
   in the *human's* action space exceed 0.35, and every equilibrium lies in
   [−0.75, 0.75]ⁿ (reachable box with margin). Since the equilibria are
   affine in the centers, centers are re-drawn cheaply (30×) per matrix draw.

This succeeds for every seed we tried up to 6×3 (`test/nxm_math.test.mjs`).
Three vetted presets (2×2, 3×2, 4×2) are frozen in the registrar so trials
never pay the search cost. Note the scalar case (1×1) is *not* designable
this way — four equilibria on a line rarely separate — which is consistent
with the original paper hand-crafting its coefficients.

**Display.** The cost bar stays the *only* cost feedback (bar height
= √(sx·f_H − cx), soft-clipped, exactly the quadgame convention). n-dim
changes the *actuation* problem, not the sensing problem — this isolates the
interface manipulation from the information manipulation studied in the
follow-up paper (arXiv:2408.14640, which found richer cost displays shift
outcomes toward Nash). The interface canvas shows interface state only:
knob positions, active pair, grab state, and the orange align-targets that
implement the standby gate (‖S.x − I.x‖∞ < tol, generalizing siso's
`|S.x − I.x| < tol`).

## 3. The three experiments, generalized

### Experiment 1 — action-space gradient play

Machine: y ← y − γ∇_y f_M(x,y), γ ∈ {0.001 … 1.0} (7 log-spaced rates × 2
reps, shuffled; `study/nxm-exp1.json`). Hypothesis **H1**: the distribution
of median action vectors moves monotonically from NE (slow γ) to SE (fast γ)
along the NE–SE axis, for every n×m tested.

Two model-level facts sharpen this (both reproduced in simulation tests):

- A *myopic* human (partial-gradient descent) converges to NE at **any** γ —
  fixed points of coupled gradient play are Nash points regardless of
  timescale. So H1 is really a test of human *exploration*: the shift to SE
  requires the human to sense how the machine re-settles in response to their
  probes.
- A *probing* human model (hold x, perturb one coordinate ±δ for a dwell
  period, descend the finite-difference of the *experienced* cost — the
  paper's premise, implemented as `simulate({human: {kind:'prober'}})`)
  reproduces the full shift with nothing about the equilibria baked in:
  slow machine → the probe measures the partial derivative → NE; fast
  machine → the machine re-settles within the dwell → the probe measures the
  composite (leader's) landscape → SE. `test/nxm_math.test.mjs` verifies this
  at 2×1, 2×2, 3×2, 4×2.

n×m-specific additions to the analysis: convergence can be examined
*per eigendirection* of the induced Hessian (fast/slow directions of the
human's landscape), and the interface (Section 4) becomes a second factor —
mappings that serialize the dimensions (pairs/spokes) reduce the human's
effective per-dimension adaptation rate by ~n/2, which shifts the effective
γ/α ratio; the calibration battery measures each subject's α̂ so the γ sweep
can be centered per interface.

### Experiment 2 — conjecture estimation between trials

Each round plays 2m probe trials (25 s): the machine best-responds through
its current conjecture K (an n×m matrix — the machine's model of ∂x/∂y),
offset by ±δ along each of its m axes (`P.yprobe`). After the round, K is
re-fit by ridge least squares and moved a **damped** step (K ← ½K + ½K̂).
Hypothesis **H2**: median actions move from SE toward the CCVE across rounds,
and K̂ converges to the consistent conjecture.

Two protocol findings from building the simulation
(`test/nxm_math.test.mjs`, `test/nxmgame_env.test.mjs`):

- **Regress on realized actions, not commanded probes.** If the human settles
  at the minimum of the landscape induced by the machine's affine map, the
  regression of median x on the machine's *realized* median y has slope
  exactly the CV-consistent conjecture −(A+LᵀBᵀ)⁻¹(B+LᵀH) — the estimation
  loop's fixed point is then the CCVE, matching the paper. Regressing on the
  *commanded offset* instead yields a different matrix
  (−(A+BL+LᵀBᵀ+LᵀHL)⁻¹(B+LᵀH)) and a different fixed point. The scalar
  algebra hides this distinction less clearly than the matrix case; the
  implementation (`nxmiter.js`) fits realized actions.
- **Damping is load-bearing.** Committing the raw LS estimate each round can
  make the machine's induced map ill-conditioned mid-run (the human's
  landscape momentarily non-convex → data at the rails → worse estimate →
  blow-up). Damped updates (and the ridge term) keep the loop stable.

Trial budget scales as 2m per round (not n·m): each probe direction yields n
equations. 8 rounds × 4 trials × 25 s ≈ 13 min for the 3×2 study — feasible
in one session.

### Experiment 3 — policy gradient to reverse Stackelberg

The machine commits to y = l + Lx within each trial and improves
θ = vec(L, l) between trials by **two-point SPSA**: per round, two 25 s
trials at θ ± δΔ (Δ a fresh Rademacher vector), machine's median realized
cost gives the gradient estimate, θ steps. Warm start: the follower policy
(L₀ = −D⁻¹C), i.e., the machine begins by playing exactly what Experiment
1's fast limit plays. Hypothesis **H3**: the machine's realized cost
decreases across rounds and median human action converges to x₂ (machine's
optimum), while the human's cost *rises* — the steering result.

Why SPSA and not coordinate-wise finite differences: θ has m(n+1) entries
(8 at 3×2, 25 at 6×4) but SPSA needs **2 trials per step regardless of
dimension** — the only algorithm of the three whose trial budget is flat in
(n, m). Simulations converge to the machine optimum at 2×1, 2×2, 3×2
(`test/nxm_math.test.mjs`), and the closed-form steering target exists by
game design, so the analysis can report distance-to-target, not just
improvement. Safety: a policy whose induced human Hessian loses positive
definiteness sends the (simulated) human to the rails and the machine
observes a blown-up cost — SPSA backs off on its own in simulation, but the
live protocol should additionally cap ‖L‖ (trust region) since a human
subject experiencing a divergent landscape is a wasted (and unpleasant)
trial.

## 4. Navigating ℝⁿ with a 2-D mouse

Requirements for a game-valid interface: (R1) **full reachability** of
[−1,1]ⁿ; (R2) **continuity** — no teleports, or the machine's dynamics see
impulses; (R3) **zero-order hold** — a still input holds x still, so "settle
and stay" is expressible; (R4) **transparency** — the subject can see all n
values (actuation aid, not cost information); (R5) bounded, measurable cost
in acquisition time as n grows.

Four mappings are implemented (`nxm_mappings.js`), all satisfying R1–R4 by
construction and verified by test:

1. **`direct`** (n ≤ 2, baseline): x = pointer position. n=1 is exactly the
   paper's interface; n=2 is the natural extension. Anchors every comparison.
2. **`pairs`** — *coordinate-pair hopping, clutched relative control*: the
   active pair (xᵢ,xⱼ) integrates pointer displacement while the button is
   held (drag); release re-positions freely (clutch, so a bounded screen
   reaches the whole box); scroll/space cycles which pair is active; inactive
   coordinates hold. The human plays block-coordinate descent. Highest
   throughput in simulation.
3. **`velocity`** — *stick + plane switching*: pointer offset from center
   commands ẋ in the active 2-D coordinate plane (deadzone = hold; deflection
   clamped to the unit stick); scroll/space cycles planes; optional
   autorotation. Position-to-rate control trades precision for hands-free
   holding; it is the natural mapping if the platform later wants
   *simultaneous* (non-serialized) movement in a rotating subspace.
4. **`spokes`** — *radial sliders*: n bipolar sliders drawn as diameters of a
   circle at angles iπ/n. The pointer grabs the nearest knob (angular capture
   band scaled to π/n, plus proximity-to-knob so nothing teleports; grab
   keeps the pointer–knob offset like a normal slider) and drags along the
   diameter; everything else holds. Random access with all values visible;
   scales visually to n ≈ 8.

Alternatives considered and rejected for the *game* (usable as control
conditions): machine-chosen subspaces (e.g., top eigenvectors of A — the
interface becomes part of the game and confounds equilibrium selection);
fixed nonlinear embeddings of a 2-D manifold in ℝⁿ (violates R1: equilibria
generally off-manifold); time-multiplexed 1-D scanning (violates R5 badly).

Design subtleties that the tests forced (each was a real bug first):

- pairs without a clutch cannot reach the box (bounded pointer ⇒ bounded
  displacement);
- spokes' deadzone must gate *grabbing only* — releasing inside it made
  values near 0 unreachable;
- grab must preserve the pointer–knob offset or capture teleports the knob
  (continuity violation caught by T2);
- capture/release angles must fit within π/n or releasing one spoke lands in
  its neighbor's capture band (broke n ≥ 4);
- a *release maneuver* exists that never disturbs the held value: move
  perpendicular to the grabbed diameter (projection is invariant). The
  simulated user exploits this; human subjects discover it or use the
  deadzone.

## 5. Tests and evaluation: is ℝⁿ controllable through 2-D?

### 5.1 Automated battery (runs in CI, `npm test`)

`test/nxm_controllability.test.mjs` drives each mapping with an idealized
simulated user (pointer speed 2 units/s — deliberately human-scale) and
asserts:

- **T1 Reachability**: 12 random targets in [−0.9,0.9]ⁿ, each acquired to
  ‖·‖∞ < 0.05 within budget, for n ∈ {2,3,4,6,8} per mapping.
- **T2 Continuity**: max per-tick ‖Δx‖ < 0.12 across all runs (no teleports).
- **T3 Hold**: 5 s of frozen input ⇒ zero drift (velocity: centered stick).
- **T4 Throughput scaling**: mean acquisition time grows at most ~linearly
  in n (per-dimension time may not exceed 3× its n=2 value).
- **Integration**: a simulated user drives the 3×2 game through the `pairs`
  mapping against the best-responding machine and lands on the SE to within
  tolerance — interface, environment, and theory compose.

Current numbers (idealized user, mean seconds per target — ordering and
scaling matter, absolute values are optimistic):

| mapping | n=2 | n=3 | n=4 | n=6 | n=8 |
|---|---|---|---|---|---|
| direct   | 0.35 | — | — | — | — |
| pairs    | 0.36 | 0.57 | 0.63 | 1.02 | 1.33 |
| velocity | 1.03 | 2.11 | 2.33 | 3.61 | 4.92 |
| spokes   | 1.07 | 1.55 | 1.84 | 2.87 | 3.51 |

### 5.2 Human calibration battery (`study/nxm-calib.json`)

Same platform, machine off (`taskmode: 'reach' | 'track'`), scalar-cost-only
feedback (cost = ½‖x − target‖²), per subject × mapping × n:

- **H-T1 Reaching** (`nxmreach-0`): time-to-ε, endpoint error, path ratio.
  With bar-only feedback this is human gradient descent on a known bowl —
  fitting an exponential to the cost trace yields the subject's **effective
  descent rate α̂**, the quantity Experiment 1's γ sweep must bracket
  (γ_min ≪ α̂ ≪ γ_max). This generalizes the platform's existing
  `graddescent-0` calibration task to n-D.
- **H-T2 Tracking** (`nxmtrack-0`): per-dimension sum-of-sines
  (non-overlapping frequencies per dim) → per-dimension tracking bandwidth;
  **isotropy index** = min/max bandwidth across dims. Serialized mappings
  are anisotropic in *time*, and anisotropy biases which equilibrium
  coordinates converge first; measure it, tune per-dim gains if < 0.5.
- **H-T3 Hold**: keep x at a target 10 s → drift/jitter per mapping.
- **H-T4 Load**: NASA-TLX after each mapping block (the platform's existing
  survey flow), since game sessions run 40+ trials.

**Acceptance gate** (pre-registered, per subject × mapping × n): ≥ 90% of
reach targets acquired to ε = 0.15 within 15 s; α̂ inside the planned γ sweep
with a factor-4 margin on both sides; isotropy ≥ 0.5; else drop to smaller n
or a different mapping. Only gated (subject, mapping, n) cells run game
experiments — this is what "make sure n-dim is controllable by 2-D" means
operationally.

### 5.3 Evaluating the game experiments

Per trial: median action vector over the second half (the platform already
logs S/I/O at 60 Hz; `O` now includes per-frame distances dNE/dSE/dCC/dMO
and the full equilibrium set is uploaded inside `params.eq`). Per subject ×
condition: the median across reps, as in the paper.

- **Exp 1**: project median actions onto the NE→SE segment: ρ = 0 at NE, 1
  at SE (report the orthogonal residual too — it must be small if the theory
  is right, and it is a *new*, n-D-only falsification axis: the scalar
  experiments could not leave the line). Mixed-effects regression
  ρ ~ log γ + (1|subject); Wilcoxon tests at the extreme rates against 0 and
  1. Factorial version: rate × mapping.
- **Exp 2**: distance of round-r median action to SE and to CCVE; slope of
  d_CC across rounds; convergence of K̂ (Frobenius) to the consistent K —
  the machine's own estimate is logged, so the *mechanism* (not just the
  endpoint) is checkable.
- **Exp 3**: machine's median realized cost per round (should decrease),
  d_MO of the final rounds (should → 0), human's cost trajectory (should
  rise after the initial SE-like rounds — the signature that steering, not
  mutual benefit, is happening).
- **Model discrimination** (new, enabled by n > 1): myopic-human,
  prober-human, and leader-human models predict *different vector* limit
  points under the same machine; with n dimensions those predictions are
  linearly independent directions, so subjects' residual patterns identify
  which adaptation model humans actually use — in the scalar game these
  models can be collinear.

Power sketch: the paper resolved NE↔SE separations of ~0.3–0.5 with n = 20
subjects; the designed games hold all pairwise separations > 0.35 with
per-trial median SD ≈ 0.05–0.1 (from the calibration battery), so n = 20 per
population remains the target, one population per experiment as in the paper.

## 6. How to run

```
npm test                      # 19 tests: math/equilibria, the three
                              # experiments in simulation, controllability
                              # battery, environment + outer-loop contracts
python3 -m http.server 8000   # serve the repo root (any static server)
# demo:  http://localhost:8000/demo/nxmgame.html
#        presets 2x2/3x2/4x2, all four mappings, all machine modes,
#        equilibria distance meters, autopilot (ideal user -> SE)
# study: http://localhost:8000/study/nxmgame.html?protocol=nxmgame-3x2&map=spokes
#        full platform flow (standby gate -> trials -> zip download)
```

Server-run studies use the JSON definitions in `study/nxm-*.json` served at
`GET /study/{sid}` exactly like `quadgame.json`; Experiments 2 and 3 set
`study.protocol` to `conjectureiter-nxm` / `policyiter-nxm`, which ds.js now
routes to `js/ds/protocols/nxmiter.js` (task identity rides in
`task.params.id`, matching the existing outer-loop convention).

## 7. Open questions / next steps

- **Pilot the mappings** (5 subjects × 3 mappings × n ∈ {2,3,4}) to get real
  α̂ and throughput distributions; freeze one primary mapping (simulation
  says `pairs`) and keep one alternate as the interface factor.
- **quadgame2 / multiplayer path**: the environment is a pure module; porting
  it behind the WebSocket server (Engine B) needs only the server to call
  `step()` and the thin client to render `S.x[player][action]` — the message
  protocol already carries `num_actions`.
- **Simultaneity**: all serialized mappings force block-coordinate human
  dynamics. The `velocity` mapping with autorotation is the least-serialized
  option; comparing it against `pairs` tests whether *simultaneous* control
  changes equilibrium selection beyond what the effective-rate correction
  predicts.
- **Adaptive n**: the calibration gate naturally defines each subject's
  maximal controllable n — the game experiments can then be run at personal
  n_max, testing whether equilibrium convergence degrades at the interface
  frontier.
