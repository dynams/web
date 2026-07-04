// Environment + outer-loop protocol contract tests: reset/step shapes, all
// machine modes, calibration task modes, and closed-loop rounds of the two
// outer-loop protocols against a simulated settling human.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import nxmgame from '../js/ds/environments/nxmgame.js'
import NxmIter from '../js/ds/protocols/nxmiter.js'
import M from '../js/ds/environments/nxm_math.js'

const PRESET_2x2 = {
    n: 2, m: 2, seed: 3, tol: 0.06, lr: 0.1, random: 0, sx: 1, cx: 0,
}

test('reset/step contract: shapes, cost output, equilibria logged', () => {
    const { P, S, I, O } = nxmgame.reset({ P: { ...PRESET_2x2 } })
    assert.equal(S.x.length, 2)
    assert.equal(S.y.length, 2)
    assert.equal(I.x.length, 2)
    assert.ok(typeof O.cost === 'number' && isFinite(O.cost))
    assert.ok(P.eq && P.eq.NE && P.eq.SE && P.eq.CC && P.eq.MO, 'equilibria stored in P')
    assert.ok(P.eq.steering, 'steering policy stored')
    assert.ok(['dNE', 'dSE', 'dCC', 'dMO'].every(k => typeof O[k] === 'number'))

    const { Sp, O: O2 } = nxmgame.step({ P, S, I: { x: [0.1, -0.2] } })
    assert.deepEqual(Sp.x, [0.1, -0.2], 'human input becomes next x')
    assert.equal(Sp.t, 1)
    assert.ok(isFinite(O2.cost))
})

test('machine modes: gradient descends, br sits on best response, nash holds, policy is affine', () => {
    const { P, S } = nxmgame.reset({ P: { ...PRESET_2x2 } })
    const G = M.makeGame(P)

    // gradient mode reduces machine cost against a held x
    let s = { ...S, y: [0.5, -0.5] }
    const x = [0.2, 0.1]
    const c0 = M.costM(G, x, s.y)
    for (let t = 0; t < 200; t++) s = nxmgame.step({ P, S: s, I: { x } }).Sp
    assert.ok(M.costM(G, x, s.y) < c0, 'gradient reduces machine cost')
    assert.ok(M.norm(M.vsub(s.y, M.brM(G, x))) < 1e-6, 'settles on best response')

    // br mode jumps to (conjectural) best response in one step
    const Pbr = { ...P, lr: -1 }
    const one = nxmgame.step({ P: Pbr, S, I: { x } }).Sp
    assert.ok(M.norm(M.vsub(one.y, M.brM(G, x))) < 1e-9)

    // lr = 0 holds ynash (defaulted to the NE y at reset)
    const Pnash = { ...P, lr: 0 }
    const held = nxmgame.step({ P: Pnash, S, I: { x } }).Sp
    assert.ok(M.norm(M.vsub(held.y, P.eq.NE.y)) < 1e-9)

    // policy mode: y = l + Lx exactly
    const { L, l } = P.eq.steering
    const Ppol = { ...P, L, l }
    const pol = nxmgame.step({ P: Ppol, S, I: { x } }).Sp
    assert.ok(M.norm(M.vsub(pol.y, M.vadd(l, M.matvec(L, x)))) < 1e-9)
})

test('calibration task modes produce distance costs and moving targets', () => {
    const { P, S } = nxmgame.reset({ P: { n: 3, m: 1, seed: 2, taskmode: 'reach', tol: 0.06 } })
    assert.equal(S.target.length, 3)
    const at = nxmgame.step({ P, S, I: { x: S.target.slice() } })
    assert.ok(at.O.cost < 1e-9, 'cost vanishes at the target')

    const tr = nxmgame.reset({ P: { n: 2, m: 1, seed: 2, taskmode: 'track', tol: 0.06 } })
    let target0 = tr.S.target.slice()
    let s = tr.S
    for (let t = 0; t < 120; t++) s = nxmgame.step({ P: tr.P, S: s, I: { x: s.x } }).Sp
    assert.ok(M.norm(M.vsub(s.target, target0)) > 1e-3, 'track target moves')
})

// Settle an *exploring* simulated human against the environment. In both
// outer-loop protocols the machine plays an affine map y = l + Lx (the
// conjectural best response is affine, and probes only shift l), so the
// exploring human's rest point is the minimum of the induced landscape —
// closed form via inducedHuman. The final env step supplies the machine's
// realized action (including the probe) exactly as a live trial would.
function settle(P) {
    const { P: PP, S } = nxmgame.reset({ P: { ...P, random: 0 } })
    const G = M.makeGame(PP)
    let L, l
    if (PP.L && PP.l) {
        L = PP.L
        l = PP.yprobe ? M.vadd(PP.l, PP.yprobe) : PP.l
    } else {
        L = M.conjecturalSlopeM(G, K_or_zero(PP, G))
        l = M.vsub(G.y2, M.matvec(L, G.x2))
        if (PP.yprobe) l = M.vadd(l, PP.yprobe)
    }
    const ind = M.inducedHuman(G, L, l)
    if (!ind.pd) return { pd: false, x: M.zeros(PP.n), y: M.zeros(PP.m), P: PP }
    const x = M.clipvec(ind.x, -1, 1)
    const Sp = nxmgame.step({ P: PP, S: { ...S, x }, I: { x } }).Sp
    return { pd: true, x: Sp.x, y: Sp.y, P: PP }
}
const K_or_zero = (P, G) => P.K || M.zeros(G.n, G.m)

test('outer loop conjectureiter-nxm: rounds drive K toward the consistent conjecture', () => {
    const n = 2, m = 2
    const base = { ...PRESET_2x2 }
    const { P: P0 } = nxmgame.reset({ P: { ...base } })
    const G = M.makeGame(P0)
    const cc = M.ccve(G)

    const study = {
        protocol: 'conjectureiter-nxm',
        params: { num_iter: 10, n, m, delta: 0.15, damp: 0.5 },
        tasks: Array.from({ length: 2 * m }, (_, i) => ({ id: String(i) })),
    }
    const st = NxmIter.init(study)
    for (let round = 0; round < 10; round++) {
        for (let id = 0; id < 2 * m; id++) {
            const tp = NxmIter.taskParams(st, id)
            const res = settle({ ...base, ...tp })
            // hand the protocol a fake trial log with the settled state
            const trial = Array.from({ length: 100 }, () => ({ S: { x: res.x, y: res.y }, O: {} }))
            NxmIter.collect(st, id, trial)
        }
    }
    assert.equal(st.t, 10)
    const err = Math.max(...M.msub(st.K, cc.K).flat().map(Math.abs))
    assert.ok(err < 0.08, `outer loop K near consistent K (err ${err.toFixed(4)})`)
})

test('outer loop policyiter-nxm: SPSA rounds reduce machine cost toward its optimum', () => {
    const n = 2, m = 2
    const base = { ...PRESET_2x2 }
    const { P: P0 } = nxmgame.reset({ P: { ...base } })
    const G = M.makeGame(P0)
    // start from the follower policy (what lr = -1 effectively plays)
    const L0 = M.mscale(M.solve(G.D, G.C), -1)
    const l0 = M.vsub(G.y2, M.matvec(L0, G.x2))

    const study = {
        protocol: 'policyiter-nxm',
        params: { num_iter: 800, n, m, delta: 0.06, lr: 0.25, decay: 0.9985, L0, l0, seed: 5 },
        tasks: [{ id: '0' }, { id: '1' }],
    }
    const st = NxmIter.init(study)
    const J0 = (() => {
        const r = settle({ ...base, L: L0, l: l0 })
        return M.costM(G, r.x, r.y)
    })()
    for (let round = 0; round < 800; round++) {
        for (const id of [0, 1]) {
            const tp = NxmIter.taskParams(st, id)
            const res = settle({ ...base, ...tp })
            // a non-convex induced landscape sends the human to the rails —
            // the machine observes a blown-up cost
            const cM = res.pd ? M.costM(G, res.x, res.y) : 10
            const trial = Array.from({ length: 100 }, () => ({ S: {}, O: { costM: cM } }))
            NxmIter.collect(st, id, trial)
        }
    }
    const { L, l } = M.unpackPolicy(st.theta, n, m)
    const fin = settle({ ...base, L, l })
    const J1 = M.costM(G, fin.x, fin.y)
    const dMO = M.norm(M.vsub(fin.x, G.x2))
    assert.ok(J1 < J0 * 0.25, `SPSA cut machine cost (${J0.toFixed(4)} -> ${J1.toFixed(4)})`)
    assert.ok(dMO < 0.3, `human median near machine optimum (d=${dMO.toFixed(3)})`)
})
