// nxmiter.js — between-trial (outer-loop) machine updates for the n x m game,
// generalizing reviter.js / conjectureiter.js to matrix-valued parameters.
//
// Two protocols, selected by study.protocol:
//
// 'conjectureiter-nxm' (Experiment 2): each round plays 2m probe trials; the
//   machine holds the affine map induced by its conjecture K plus an offset
//   +-delta along each of its m axes (task.params.yprobe, from taskParams).
//   After the round, the human's median action is regressed on the machine's
//   *realized* median action (this choice makes the CCVE the predicted fixed
//   point — see the note in nxm_math.js) and K moves a damped step toward
//   the estimate.
//     study.params: { num_iter, n, m, delta = 0.15, damp = 0.5 }
//     study.tasks:  2m tasks with ids "0" .. "2m-1"
//
// 'policyiter-nxm' (Experiment 3): each round plays 2 trials at policies
//   (L, l) = unpack(theta +- delta*Delta) with a fresh Rademacher Delta; the
//   machine's median realized cost in each trial gives the two-point SPSA
//   gradient and theta takes a step. Predicted limit: the reverse-Stackelberg
//   steering policy, with the human's median action at the machine's optimum.
//     study.params: { num_iter, n, m, delta = 0.05, lr = 0.15, decay = 1,
//                     L0, l0 }  (L0/l0 default to zeros)
//     study.tasks:  2 tasks with ids "0" (plus) and "1" (minus)
//
// Pure module (no DOM): unit-testable from node.

import M from '../environments/nxm_math.js'

function medianVec(rows) {
    // per-coordinate median over the second half of the trial
    const half = rows.slice(Math.floor(rows.length / 2))
    const n = half[0].length
    return Array.from({ length: n }, (_, i) => {
        const v = half.map(r => r[i]).sort((a, b) => a - b)
        const k = v.length
        return k % 2 ? v[(k - 1) / 2] : (v[k / 2 - 1] + v[k / 2]) / 2
    })
}

function medianNum(vals) {
    const half = vals.slice(Math.floor(vals.length / 2)).sort((a, b) => a - b)
    const k = half.length
    return k % 2 ? half[(k - 1) / 2] : (half[k / 2 - 1] + half[k / 2]) / 2
}

export function init(study) {
    const P = study.params || {}
    const n = P.n
    const m = P.m
    const state = {
        protocol: study.protocol,
        t: 0, n, m,
        received: {},
        data: {},
    }
    if (study.protocol === 'conjectureiter-nxm') {
        state.delta = P.delta == null ? 0.15 : P.delta
        state.damp = P.damp == null ? 0.5 : P.damp
        state.K = P.K0 || M.zeros(n, m)
        state.rounds = 2 * m
    } else if (study.protocol === 'policyiter-nxm') {
        state.delta = P.delta == null ? 0.05 : P.delta
        state.lr = P.lr == null ? 0.15 : P.lr
        state.decay = P.decay == null ? 1 : P.decay
        const L0 = P.L0 || M.zeros(m, n)
        const l0 = P.l0 || M.zeros(m)
        state.theta = M.packPolicy(L0, l0)
        state.rand = M.rng(P.seed == null ? 42 : P.seed)
        state.Delta = M.spsa_delta(state.theta.length, state.rand)
        state.rounds = 2
    } else {
        throw new Error('nxmiter: unknown protocol ' + study.protocol)
    }
    return state
}

// Parameters to merge into a task before it runs, given its id (a string or
// number indexing the task's role within the current round).
export function taskParams(state, id) {
    const k = parseInt(id, 10)
    if (state.protocol === 'conjectureiter-nxm') {
        // probe axis j = floor(k/2), sign = +1 for even k, -1 for odd k
        const j = Math.floor(k / 2)
        const sgn = k % 2 === 0 ? 1 : -1
        const yprobe = M.zeros(state.m)
        if (j < state.m) yprobe[j] = sgn * state.delta
        return { K: state.K, yprobe, lr: -1 }
    }
    if (state.protocol === 'policyiter-nxm') {
        const sgn = k === 0 ? 1 : -1
        const th = state.theta.map((t, i) => t + sgn * state.delta * state.Delta[i])
        const { L, l } = M.unpackPolicy(th, state.n, state.m)
        return { L, l }
    }
    return {}
}

// Feed one finished trial. Returns { stepped } — true when a full round was
// consumed and the machine parameters advanced (state.t incremented).
export function collect(state, id, trial_dict) {
    const k = parseInt(id, 10)
    if (state.protocol === 'conjectureiter-nxm') {
        const xs = trial_dict.map(d => d.S.x)
        const ys = trial_dict.map(d => d.S.y)
        state.data[k] = { x: medianVec(xs), y: medianVec(ys) }
    } else {
        const cs = trial_dict.map(d => d.O.costM)
        state.data[k] = { J: medianNum(cs) }
    }
    state.received[k] = true

    const full = Array.from({ length: state.rounds }, (_, i) => state.received[i]).every(Boolean)
    if (!full) return { stepped: false }

    if (state.protocol === 'conjectureiter-nxm') {
        const pairs = Object.values(state.data)
        const Kls = M.lsq_conjecture(pairs).K
        state.K = M.madd(M.mscale(state.K, 1 - state.damp), M.mscale(Kls, state.damp))
    } else {
        const next = M.spsa_step({
            theta: state.theta,
            Jp: state.data[0].J,
            Jn: state.data[1].J,
            Delta: state.Delta,
            delta: state.delta,
            lr: state.lr,
        })
        state.theta = next
        state.lr *= state.decay
        state.Delta = M.spsa_delta(state.theta.length, state.rand)
    }
    state.received = {}
    state.data = {}
    state.t += 1
    return { stepped: true }
}

export default { init, taskParams, collect }
