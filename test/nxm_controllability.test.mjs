// Controllability evaluation: can a 2D pointer command an n-dimensional
// action through each mapping? Idealized simulated users (one per mapping)
// drive random reaching tasks; we require:
//
//   T1 reachability — every random target in [-0.9, 0.9]^n acquired to
//      within eps in a bounded time budget,
//   T2 continuity   — the emitted action never jumps (no teleports; this is
//      what makes the game dynamics well-posed at 60 Hz),
//   T3 hold         — with the pointer at rest (or at the neutral input),
//      the action holds exactly (zero-order hold, no drift),
//   T4 throughput   — acquisition time grows at most ~linearly with n
//      (reported as a table; asserted loosely).
//
// These are the *automated* halves of the human test battery in
// docs/nxmgame-design.md (the human halves calibrate speed/gains).
//
// Run: npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Maps from '../js/ds/experiments/nxm_mappings.js'
import M from '../js/ds/environments/nxm_math.js'

const FPS = 60
const EPS = 0.05

function reach({ type, n, target, x0 = null, budgetSec = 60, params = {} }) {
    const Mp = Maps.createMapping({ type, n, ...params })
    if (x0) Maps.mappingSync(Mp, x0)
    const user = Maps.simulatedUser(Mp, target)
    let steps = 0
    let maxJump = 0
    let path = 0
    let prev = Mp.x.slice()
    const budget = Math.round(budgetSec * FPS)
    while (steps < budget) {
        const ev = user.step(1 / FPS)
        const x = Maps.mappingUpdate(Mp, ev, 1 / FPS)
        const jump = M.norm(M.vsub(x, prev))
        maxJump = Math.max(maxJump, jump)
        path += jump
        prev = x
        steps++
        if (M.norminf(M.vsub(x, target)) < EPS) break
    }
    const ok = M.norminf(M.vsub(Mp.x, target)) < EPS
    return { ok, steps, seconds: steps / FPS, maxJump, path, M: Mp, user }
}

function randTargets(n, count, seed) {
    const rand = M.rng(seed)
    return Array.from({ length: count }, () =>
        Array.from({ length: n }, () => (rand() * 2 - 1) * 0.9))
}

const CASES = [
    { type: 'direct', dims: [1, 2] },
    { type: 'pairs', dims: [2, 3, 4, 6, 8] },
    { type: 'velocity', dims: [2, 3, 4, 6, 8] },
    { type: 'spokes', dims: [2, 3, 4, 6, 8] },
]

test('T1 reachability: all random targets acquired within budget', () => {
    for (const { type, dims } of CASES) {
        for (const n of dims) {
            const targets = randTargets(n, 12, 100 + n)
            for (const [ti, target] of targets.entries()) {
                const r = reach({ type, n, target, budgetSec: 20 + 10 * n })
                assert.ok(r.ok,
                    `${type} n=${n} target#${ti} unreached after ${r.seconds.toFixed(1)}s ` +
                    `(residual ${M.norminf(M.vsub(r.M.x, target)).toFixed(3)})`)
            }
        }
    }
})

test('T2 continuity: the action never jumps', () => {
    // one 60 Hz tick at pointer speed 2 units/s can legitimately move a
    // direct-mapped 2D action by ~2/60 per axis; anything much larger than
    // that indicates a teleport (grab/switch discontinuity).
    const bound = 0.12
    for (const { type, dims } of CASES) {
        for (const n of dims) {
            for (const target of randTargets(n, 6, 200 + n)) {
                const r = reach({ type, n, target, budgetSec: 20 + 10 * n })
                assert.ok(r.maxJump < bound,
                    `${type} n=${n}: max per-tick jump ${r.maxJump.toFixed(3)} >= ${bound}`)
            }
        }
    }
})

test('T3 hold: action is a zero-order hold under neutral input', () => {
    for (const { type, dims } of CASES) {
        const n = dims[dims.length - 1]
        const target = randTargets(n, 1, 300 + n)[0]
        const r = reach({ type, n, target, budgetSec: 20 + 10 * n })
        assert.ok(r.ok, `${type} setup reach failed`)
        const held = r.M.x.slice()
        // neutral input = the pointer stops moving. For 'velocity' neutral is
        // the centered stick (that is its hold semantics); for the others the
        // pointer simply freezes where the reach left it.
        const p = r.user.state.pointer
        const ev = type === 'velocity'
            ? { px: 0, py: 0, wheel: 0, key: null, down: false }
            : { px: p.px, py: p.py, wheel: 0, key: null, down: r.user.state.down || false }
        for (let t = 0; t < 5 * FPS; t++) {
            Maps.mappingUpdate(r.M, ev, 1 / FPS)
        }
        const drift = M.norm(M.vsub(r.M.x, held))
        // spokes: a centered pointer sits inside the deadzone -> no grab, no
        // drift; velocity: centered pointer commands zero velocity.
        assert.ok(drift < 1e-9, `${type} n=${n}: drift ${drift} under neutral input`)
    }
})

test('T4 throughput: acquisition time scales at most ~linearly in n', () => {
    const table = []
    for (const { type, dims } of CASES) {
        const times = {}
        for (const n of dims) {
            const targets = randTargets(n, 10, 400 + n)
            let tot = 0
            for (const target of targets) {
                const r = reach({ type, n, target, budgetSec: 20 + 10 * n })
                assert.ok(r.ok, `${type} n=${n} throughput target unreached`)
                tot += r.seconds
            }
            times[n] = tot / targets.length
        }
        table.push({ type, ...Object.fromEntries(Object.entries(times).map(([k, v]) => [`n=${k}`, +v.toFixed(2)])) })
        const ns = dims.filter(n => n >= 2)
        if (ns.length >= 2) {
            const lo = times[ns[0]] / ns[0]
            const hi = times[ns[ns.length - 1]] / ns[ns.length - 1]
            // per-dimension cost must not blow up with n (allow 3x headroom)
            assert.ok(hi < Math.max(3 * lo, 3),
                `${type}: per-dim time grows too fast (${lo.toFixed(2)} -> ${hi.toFixed(2)} s/dim)`)
        }
    }
    console.table(table) // informative: mean seconds to target per mapping x n
})

test('integration: mapping + environment + machine best response reaches near the Stackelberg point', () => {
    // A simulated user drives the 'pairs' mapping toward the human-led
    // Stackelberg action while the nxmgame machine best-responds — verifying
    // that the mapping layer composes with the environment contract and that
    // the game outcome is achievable through the interface.
    const n = 3, m = 2
    const d = M.designGame({ n, m, seed: 7 })
    const { G, eq } = d
    const Mp = Maps.createMapping({ type: 'pairs', n })
    const user = Maps.simulatedUser(Mp, eq.SE.x)
    let x = M.zeros(n)
    let y = M.brM(G, x)
    for (let t = 0; t < 90 * FPS; t++) {
        const ev = user.step(1 / FPS)
        x = Maps.mappingUpdate(Mp, ev, 1 / FPS)
        y = M.brM(G, x) // machine plays best response (lr = -1 mode)
    }
    const dSE = M.norm(M.vsub(x, eq.SE.x))
    assert.ok(dSE < EPS * Math.sqrt(n), `reached SE through the interface (d=${dSE.toFixed(3)})`)
    // and the realized cost is near the theoretical SE cost
    const cH = M.costH(G, x, y)
    const cSE = M.costH(G, eq.SE.x, eq.SE.y)
    assert.ok(Math.abs(cH - cSE) < 0.02, `cost near SE cost (${cH.toFixed(4)} vs ${cSE.toFixed(4)})`)
})
