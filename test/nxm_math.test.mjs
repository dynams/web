// Tests for the n x m game math: equilibria correctness, algorithm
// convergence (the three experiments, with simulated humans), and the
// game-design separation guarantees.
//
// Run: npm test  (node --test)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import M from '../js/ds/environments/nxm_math.js'

const SEEDS = [1, 2, 3, 7, 11]
// note: 1x1 is not designed here — with four equilibria on a line, pairwise
// separation inside the box is rarely satisfiable by random search; the
// scalar case uses the published quadgame coefficients (first test below).
const DIMS = [
    { n: 2, m: 1 },
    { n: 2, m: 2 },
    { n: 3, m: 2 },
    { n: 4, m: 2 },
    { n: 4, m: 3 },
]

function designed(n, m, seed) {
    const d = M.designGame({ n, m, seed })
    assert.ok(d, `designGame must find a valid ${n}x${m} game (seed ${seed})`)
    return d
}

test('scalar game reduces to known closed forms', () => {
    // f_H = 1/2 a x^2 + b x y (centered at (x1,y1)), f_M analogous — check
    // Nash and Stackelberg against hand-derived scalar formulas.
    const G = M.makeGame({
        A: [[1.8]], B: [[-0.5595]], H: [[0.3976]],
        D: [[0.7]], C: [[-0.7]], E: [[3.4696]],
        x1: [0.39934], y1: [1.72834], x2: [0.05792], y2: [0.05792],
    })
    const ne = M.nash(G)
    // residuals of the first-order conditions must vanish
    assert.ok(M.norm(M.gradHx(G, ne.x, ne.y)) < 1e-10)
    assert.ok(M.norm(M.gradMy(G, ne.x, ne.y)) < 1e-10)

    const se = M.stackelberg(G)
    // verify against brute-force leader optimization
    let best = null
    for (let x = -3; x <= 3; x += 1e-4) {
        const y = M.brM(G, [x])
        const c = M.costH(G, [x], y)
        if (!best || c < best.c) best = { x, c }
    }
    assert.ok(Math.abs(se.x[0] - best.x) < 1e-3)
})

test('equilibria satisfy their defining conditions on random games', () => {
    for (const { n, m } of DIMS) {
        for (const seed of SEEDS.slice(0, 2)) {
            const { G } = designed(n, m, seed)

            const ne = M.nash(G)
            assert.ok(M.norm(M.gradHx(G, ne.x, ne.y)) < 1e-8, 'NE human FOC')
            assert.ok(M.norm(M.gradMy(G, ne.x, ne.y)) < 1e-8, 'NE machine FOC')

            // Stackelberg: numeric gradient of the leader's composite cost is 0
            const se = M.stackelberg(G)
            const f = x => M.costH(G, x, M.brM(G, x))
            const h = 1e-6
            for (let i = 0; i < n; i++) {
                const xp = se.x.slice(); xp[i] += h
                const xm = se.x.slice(); xm[i] -= h
                assert.ok(Math.abs((f(xp) - f(xm)) / (2 * h)) < 1e-4, 'SE stationarity')
            }
            // leader does at least as well as at Nash
            assert.ok(f(se.x) <= f(ne.x) + 1e-9, 'SE improves on NE for the leader')

            // CCVE: conjectural FOCs hold and slopes are mutually consistent
            const cc = M.ccve(G)
            assert.ok(cc.converged, 'CCVE fixed point converged')
            const Kres = M.madd(
                cc.K,
                M.solve(M.madd(G.A, M.matmul(M.T(cc.L), M.T(G.B))),
                        M.madd(G.B, M.matmul(M.T(cc.L), G.H))))
            assert.ok(Math.max(...Kres.flat().map(Math.abs)) < 1e-8, 'K consistency')

            // machine's conjectural FOC at the CCVE point
            const gM = M.vadd(
                M.matvec(M.madd(G.D, M.matmul(M.T(cc.K), M.T(G.C))), M.vsub(cc.y, G.y2)),
                M.matvec(M.madd(G.C, M.matmul(M.T(cc.K), G.E)), M.vsub(cc.x, G.x2)))
            assert.ok(M.norm(gM) < 1e-8, 'CCVE machine FOC')
        }
    }
})

test('steering policy places the human optimum at the machine optimum', () => {
    for (const { n, m } of DIMS) {
        const { G } = designed(n, m, 1)
        const st = M.steering(G)
        assert.ok(st.ok, `steering feasible for ${n}x${m}`)
        const ind = M.inducedHuman(G, st.L, st.l)
        assert.ok(ind.pd, 'induced human problem is convex')
        assert.ok(M.norm(M.vsub(ind.x, G.x2)) < 1e-6,
            'human optimum lands on machine target x2')
        const y = M.vadd(st.l, M.matvec(st.L, ind.x))
        assert.ok(M.norm(M.vsub(y, G.y2)) < 1e-6,
            'machine plays its own optimum y2 there')
    }
})

test('designGame separates all equilibria and keeps them in the box', () => {
    for (const { n, m } of DIMS) {
        const { eq } = designed(n, m, 3)
        for (const [k, s] of Object.entries(eq.sep)) {
            assert.ok(s > 0.35, `separation ${k} = ${s.toFixed(3)} > 0.35`)
        }
        for (const p of [eq.NE, eq.SE, eq.CC, eq.MO]) {
            assert.ok(p.x.every(v => Math.abs(v) <= 0.75), 'x in box')
            assert.ok(p.y.every(v => Math.abs(v) <= 0.75), 'y in box')
        }
    }
})

// ------------------------------------------------------------------
// The three experiments, simulated end to end with model humans.

test('a myopic-gradient human reaches Nash at any machine rate (model baseline)', () => {
    // fixed points of coupled gradient play are Nash points regardless of
    // timescale — so the Nash->Stackelberg shift requires an exploring human.
    const { G, eq } = designed(2, 2, 2)
    const human = { kind: 'grad', rate: 0.05 }
    for (const rate of [0.001, 0.3]) {
        const res = M.simulate({ G, human, machine: { kind: 'grad', rate }, steps: 200000 })
        assert.ok(M.norm(M.vsub(res.x, eq.NE.x)) < 0.02, `grad human at NE (rate ${rate})`)
    }
})

test('Experiment 1: against a probing human, slow machine -> Nash, fast machine -> Stackelberg', () => {
    for (const { n, m } of DIMS.slice(0, 4)) {
        const { G, eq } = designed(n, m, 2)
        // the human explores: finite-difference descent on experienced cost
        const human = { kind: 'prober', dwell: 40, delta: 0.08, eta: 0.25 }
        const steps = 2 * 40 * n * 800 // ~800 full probe sweeps
        const slow = M.simulate({ G, human, machine: { kind: 'grad', rate: 0.00002 }, steps })
        const fast = M.simulate({ G, human, machine: { kind: 'grad', rate: 0.5 }, steps })
        const dSlowNE = M.norm(M.vsub(slow.x, eq.NE.x))
        const dSlowSE = M.norm(M.vsub(slow.x, eq.SE.x))
        const dFastNE = M.norm(M.vsub(fast.x, eq.NE.x))
        const dFastSE = M.norm(M.vsub(fast.x, eq.SE.x))
        assert.ok(dSlowNE < dSlowSE,
            `slow machine near NE (${n}x${m}): dNE=${dSlowNE.toFixed(3)} dSE=${dSlowSE.toFixed(3)}`)
        assert.ok(dFastSE < dFastNE,
            `fast machine near SE (${n}x${m}): dNE=${dFastNE.toFixed(3)} dSE=${dFastSE.toFixed(3)}`)
    }
})

test('Experiment 2: iterated conjecture estimation converges to the CCVE', () => {
    for (const { n, m } of [{ n: 2, m: 2 }, { n: 3, m: 2 }]) {
        const { G, eq } = designed(n, m, 4)
        // Round: machine commits to the affine map through its conjecture K,
        // offset by +-delta probes along each of its m axes; the exploring
        // human settles each probe trial; least squares re-fits K against the
        // machine's *realized* actions (this choice is what makes the fixed
        // point the CCVE — see the note in nxm_math.js). Iterate.
        // damped refits: committing the raw LS estimate each round can make
        // the induced human problem ill-conditioned mid-run and destabilize
        // the loop (a real protocol hazard — see the design doc), so the
        // machine moves K halfway toward each new estimate.
        let K = M.zeros(n, m)
        const damp = 0.5
        const delta = 0.15
        const rand = M.rng(99)
        for (let round = 0; round < 12; round++) {
            const Lk = M.conjecturalSlopeM(G, K)
            const l0 = M.vsub(G.y2, M.matvec(Lk, G.x2))
            const data = []
            for (let j = 0; j < m; j++) {
                for (const sgn of [1, -1]) {
                    const probe = M.zeros(m); probe[j] = sgn * delta
                    const res = M.simulate({
                        G,
                        steps: 2 * 40 * n * 250,
                        human: { kind: 'prober', dwell: 40, delta: 0.08, eta: 0.25, rand: M.rng(round * 17 + j * 3 + (sgn > 0)) },
                        machine: { kind: 'policy', L: Lk, l: M.vadd(l0, probe) },
                    })
                    // measurement noise on the human's median action
                    const xh = res.x.map(v => v + (rand() * 2 - 1) * 0.005)
                    data.push({ y: res.y, x: xh })
                }
            }
            const Kls = M.lsq_conjecture(data).K
            K = M.madd(M.mscale(K, 1 - damp), M.mscale(Kls, damp))
        }
        const Kerr = Math.max(...M.msub(K, eq.CC.K).flat().map(Math.abs))
        assert.ok(Kerr < 0.08, `estimated K matches consistent K (err ${Kerr.toFixed(4)})`)
        // and the play it induces sits at the CCVE
        const res = M.simulate({
            G,
            steps: 2 * 40 * n * 400,
            human: { kind: 'prober', dwell: 40, delta: 0.08, eta: 0.25 },
            machine: {
                kind: 'policy',
                L: M.conjecturalSlopeM(G, K),
                l: M.vsub(G.y2, M.matvec(M.conjecturalSlopeM(G, K), G.x2)),
            },
        })
        assert.ok(M.norm(M.vsub(res.x, eq.CC.x)) < 0.08,
            `play converges to the CCVE (d=${M.norm(M.vsub(res.x, eq.CC.x)).toFixed(3)})`)
    }
})

test('Experiment 3: SPSA policy gradient steers the human to the machine optimum', () => {
    for (const { n, m } of [{ n: 2, m: 1 }, { n: 2, m: 2 }, { n: 3, m: 2 }]) {
        const { G } = designed(n, m, 5)
        const rand = M.rng(1234)
        // steady-state machine cost of policy (L, l): the human settles at
        // the minimum of its induced landscape (closed form), the machine
        // pays its cost there. Small noise models measurement error.
        const J = theta => {
            const { L, l } = M.unpackPolicy(theta, n, m)
            const ind = M.inducedHuman(G, L, l)
            if (!ind.pd) return 50 // induced problem non-convex: heavy penalty
            const y = M.vadd(l, M.matvec(L, ind.x))
            return M.costM(G, ind.x, y) + (rand() * 2 - 1) * 0.002
        }
        // start from the myopic best-response policy (what a follower plays)
        const L0 = M.mscale(M.solve(G.D, G.C), -1)
        const l0 = M.vsub(G.y2, M.matvec(L0, G.x2))
        let theta = M.packPolicy(L0, l0)
        let lr = 0.25
        const delta = 0.06
        for (let k = 0; k < 2500; k++) {
            const Delta = M.spsa_delta(theta.length, rand)
            const tp = theta.map((t, i) => t + delta * Delta[i])
            const tn = theta.map((t, i) => t - delta * Delta[i])
            const next = M.spsa_step({ theta, Jp: J(tp), Jn: J(tn), Delta, delta, lr })
            // keep the induced problem convex (project by rejection)
            const { L, l } = M.unpackPolicy(next, n, m)
            if (M.inducedHuman(G, L, l).pd) theta = next
            lr *= 0.9985
        }
        const { L, l } = M.unpackPolicy(theta, n, m)
        const ind = M.inducedHuman(G, L, l)
        const yF = M.vadd(l, M.matvec(L, ind.x))
        const dMO = M.norm(M.vsub(ind.x, G.x2))
        const cM = M.costM(G, ind.x, yF)
        // compare against the machine's cost when it merely best-responds (SE)
        const se = M.stackelberg(G)
        const cSE = M.costM(G, se.x, se.y)
        assert.ok(cM < cSE, `policy gradient beats follower play (${cM.toFixed(4)} < ${cSE.toFixed(4)})`)
        assert.ok(dMO < 0.25, `human steered near machine optimum (d=${dMO.toFixed(3)})`)
    }
})

test('conjecture least squares recovers a known policy', () => {
    const rand = M.rng(7)
    const n = 3, m = 2
    const Ktrue = [[0.4, -0.2], [0.1, 0.5], [-0.3, 0.2]]
    const k0 = [0.1, -0.05, 0.2]
    const data = []
    for (let t = 0; t < 12; t++) {
        const y = [rand() * 2 - 1, rand() * 2 - 1]
        const x = M.vadd(k0, M.matvec(Ktrue, y)).map(v => v + (rand() * 2 - 1) * 0.001)
        data.push({ y, x })
    }
    const fit = M.lsq_conjecture(data)
    assert.ok(Math.max(...M.msub(fit.K, Ktrue).flat().map(Math.abs)) < 0.01)
    assert.ok(M.norm(M.vsub(fit.k0, k0)) < 0.01)
})
