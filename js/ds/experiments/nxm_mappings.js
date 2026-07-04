// nxm_mappings.js — 2D pointer -> n-dimensional action mappings.
//
// The human plays an action x in [-1,1]^n but only has a 2D pointer (plus
// wheel/keys as a discrete channel). Each mapping is a small state machine:
//
//   createMapping({ type, n, ...params })       -> M
//   mappingUpdate(M, ev, dt)                    -> x (length n, clipped)
//   mappingSync(M, x)                           -> force internal state to x
//   mappingDisplay(M)                           -> info for the draw layer
//
// ev: { px, py    — pointer in [-1,1] (screen-normalized, py up-positive)
//       wheel     — integer wheel detents since last update (0 if none)
//       key       — 'next'|'prev'|null discrete channel (space/arrows)
//       down      — pointer button held }
//
// Mapping types (see docs/nxmgame-design.md for the design rationale):
//
//   'direct'   n<=2. x = (px, py). The paper's interface (n=1 uses px only).
//   'pairs'    coordinate-pair hopping with clutched relative control: while
//              the button is held, the active pair (x_i, x_j) integrates
//              pointer *displacement* (drag); releasing lets the pointer
//              reposition freely (clutch), so the full box stays reachable
//              from a bounded screen. All other coordinates hold (zero-order
//              hold). Wheel/keys cycle the active pair; no jumps on switch.
//   'velocity' the pointer offset from screen center commands a velocity in a
//              2D subspace: xdot = gain * (u1*px + u2*py). Wheel/keys cycle
//              the subspace through coordinate planes; optional autorotate.
//              Pointer at center = hold everything.
//   'spokes'   n bipolar sliders drawn as diameters of a circle at angles
//              i*pi/n. The pointer grabs the *knob* of the nearest diameter
//              (angular capture band + proximity to the knob's current value,
//              so nothing teleports) and the projection onto the diameter
//              sets x_i absolutely; other coordinates hold. Random access,
//              values always visible, one coordinate moves at a time.
//
// All mappings guarantee reachability of [-1,1]^n and continuity of x(t).

import { zeros, clip, clipvec } from '../environments/nxm_math.js'

export const MAPPING_TYPES = ['direct', 'pairs', 'velocity', 'spokes']

export function pairList(n) {
    // consecutive coordinate pairs; odd n gets a final wrap pair (n-1, 0)
    const pairs = []
    for (let i = 0; i + 1 < n; i += 2) pairs.push([i, i + 1])
    if (n % 2 === 1 && n > 1) pairs.push([n - 1, 0])
    if (n === 1) pairs.push([0, 0])
    return pairs
}

export function createMapping({
    type = 'direct', n = 2,
    gain = 1.2,          // velocity gain (units/s at full deflection)
    relGain = 1.0,       // pairs: displacement multiplier
    captureBand = 0.35,  // spokes: max angular distance (rad) to capture
    grabTol = 0.18,      // spokes: max |proj - x_i| to grab the knob
    deadzone = 0.12,     // velocity/spokes: pointer radius that means "hold"
    autorotate = 0,      // velocity: seconds per automatic plane switch (0=off)
} = {}) {
    const M = {
        type, n, gain, relGain, captureBand, grabTol, deadzone, autorotate,
        // spokes: capture/release angles must fit between adjacent diameters
        // (spacing pi/n), else releasing one spoke lands in the next one's
        // capture band
        band: Math.min(captureBand, (Math.PI / Math.max(n, 1)) * 0.35),
        x: zeros(n),
        pairs: pairList(n),
        active: 0,          // active pair (pairs, velocity) or spoke index
        spoke: null,        // spokes: captured spoke index or null
        prev: null,         // last pointer sample (for relative control)
        clock: 0,
    }
    M.release = M.band * 1.4
    return M
}

export function mappingSync(M, x) {
    M.x = clipvec(x.slice(0, M.n), -1, 1)
    M.prev = null
    return M
}

export function mappingUpdate(M, ev, dt = 1 / 60) {
    const { px = 0, py = 0, wheel = 0, key = null } = ev || {}
    M.clock += dt
    const cyc = wheel !== 0 ? Math.sign(wheel) : key === 'next' ? 1 : key === 'prev' ? -1 : 0

    if (M.type === 'direct') {
        M.x[0] = clip(px, -1, 1)
        if (M.n > 1) M.x[1] = clip(py, -1, 1)
        return M.x.slice()
    }

    if (M.type === 'pairs') {
        if (cyc) {
            M.active = (M.active + cyc + M.pairs.length) % M.pairs.length
            M.prev = null // re-clutch on switch so nothing jumps
        }
        const [i, j] = M.pairs[M.active]
        if (!ev.down) {
            M.prev = null // clutch released: pointer repositions freely
        } else {
            if (M.prev) {
                M.x[i] = clip(M.x[i] + (px - M.prev.px) * M.relGain, -1, 1)
                if (j !== i) M.x[j] = clip(M.x[j] + (py - M.prev.py) * M.relGain, -1, 1)
            }
            M.prev = { px, py }
        }
        return M.x.slice()
    }

    if (M.type === 'velocity') {
        if (cyc) M.active = (M.active + cyc + M.pairs.length) % M.pairs.length
        if (M.autorotate > 0 && M.clock >= M.autorotate) {
            M.clock = 0
            M.active = (M.active + 1) % M.pairs.length
        }
        const [i, j] = M.pairs[M.active]
        let ux = px, uy = py
        let r = Math.hypot(ux, uy)
        if (r > 1) { ux /= r; uy /= r; r = 1 } // clamp deflection to the unit stick
        if (r > M.deadzone) {
            const s = (r - M.deadzone) / (1 - M.deadzone) / (r || 1)
            M.x[i] = clip(M.x[i] + M.gain * ux * s * dt, -1, 1)
            if (j !== i) M.x[j] = clip(M.x[j] + M.gain * uy * s * dt, -1, 1)
        }
        return M.x.slice()
    }

    if (M.type === 'spokes') {
        const r = Math.hypot(px, py)
        const theta = Math.atan2(py, px)
        // angular distance from the pointer to diameter i (a line, mod pi)
        const angDist = i => {
            const ti = (i * Math.PI) / M.n
            const d = (((theta - ti) % Math.PI) + Math.PI) % Math.PI
            return Math.min(d, Math.PI - d)
        }
        const projOn = i => {
            const ti = (i * Math.PI) / M.n
            return px * Math.cos(ti) + py * Math.sin(ti)
        }
        if (M.spoke == null) {
            // grab: pointer outside the deadzone, angularly on a diameter, and
            // close to that knob's current value (so nothing teleports)
            if (r >= M.deadzone) {
                let bestI = 0
                for (let i = 1; i < M.n; i++) if (angDist(i) < angDist(bestI)) bestI = i
                if (angDist(bestI) <= M.band &&
                    Math.abs(clip(projOn(bestI), -1, 1) - M.x[bestI]) <= M.grabTol) {
                    M.spoke = bestI
                    // slider semantics: the knob keeps its offset from the
                    // grab point, so the grab itself moves nothing
                    M.grabOff = M.x[bestI] - projOn(bestI)
                }
            }
        } else if (r >= M.deadzone && angDist(M.spoke) > M.release) {
            M.spoke = null // slid off the diameter: release, everything holds
        }
        // a grabbed knob follows the pointer displacement anywhere (including
        // through the center, so values near 0 are settable); others hold
        if (M.spoke != null) {
            M.x[M.spoke] = clip(projOn(M.spoke) + (M.grabOff || 0), -1, 1)
        }
        return M.x.slice()
    }

    throw new Error('nxm_mappings: unknown type ' + M.type)
}

export function mappingDisplay(M) {
    return {
        type: M.type,
        n: M.n,
        x: M.x.slice(),
        pairs: M.pairs,
        active: M.active,
        spoke: M.spoke,
    }
}

// ------------------------------------------------------------------
// Simulated users — idealized pointer policies per mapping, used by the
// automated controllability tests (test/nxm_controllability.test.mjs) and by
// the demo autopilot. Each returns the ev to feed mappingUpdate given the
// current mapping state and a desired target x* in [-1,1]^n.
// speed: pointer travel per second in normalized screen units.
export function simulatedUser(M, target, { speed = 2.0, switchTol = 0.03 } = {}) {
    const S = { pointer: { px: 0, py: 0 }, down: false }

    function step(dt) {
        const err = target.map((t, i) => t - M.x[i])
        const worst = err.reduce((a, e, i) => (Math.abs(e) > Math.abs(err[a]) ? i : a), 0)
        let ev = { px: S.pointer.px, py: S.pointer.py, wheel: 0, key: null, down: S.down }

        const towards = (gx, gy) => {
            const dx = gx - S.pointer.px
            const dy = gy - S.pointer.py
            const d = Math.hypot(dx, dy)
            const stepLen = Math.min(d, speed * dt)
            if (d > 1e-9) {
                S.pointer.px += (dx / d) * stepLen
                S.pointer.py += (dy / d) * stepLen
            }
            ev.px = S.pointer.px
            ev.py = S.pointer.py
        }

        if (M.type === 'direct') {
            towards(target[0], M.n > 1 ? target[1] : 0)
        } else if (M.type === 'pairs') {
            const [i, j] = M.pairs[M.active]
            const pairErr = Math.max(Math.abs(err[i]), j !== i ? Math.abs(err[j]) : 0)
            if (pairErr < switchTol && Math.abs(err[worst]) > switchTol) {
                ev.key = 'next' // this pair is done; move on
                ev.down = S.down = false
                S.pointer = { px: 0, py: 0 }
                ev.px = 0; ev.py = 0
            } else if (!S.down) {
                // clutch open: recenter the pointer, then press
                towards(0, 0)
                if (Math.hypot(S.pointer.px, S.pointer.py) < 0.02) {
                    S.down = true
                    ev.down = true
                }
            } else {
                // drag in the error direction; release the clutch at the edge
                const gx = clip(S.pointer.px + err[i] / M.relGain, -1, 1)
                const gy = clip(S.pointer.py + (j !== i ? err[j] / M.relGain : 0), -1, 1)
                towards(gx, gy)
                const atEdge = Math.abs(S.pointer.px) > 0.98 || Math.abs(S.pointer.py) > 0.98
                if (atEdge && pairErr > switchTol) {
                    ev.down = S.down = false
                }
            }
        } else if (M.type === 'velocity') {
            const [i, j] = M.pairs[M.active]
            const pairErr = Math.max(Math.abs(err[i]), j !== i ? Math.abs(err[j]) : 0)
            if (pairErr < switchTol && Math.abs(err[worst]) > switchTol) {
                ev.key = 'next'
                S.pointer = { px: 0, py: 0 }
                ev.px = 0; ev.py = 0
            } else {
                // proportional deflection along the in-plane error, with a
                // floor just outside the deadzone (else small errors command
                // zero velocity and the user deadlocks below the switch tol)
                let gx = err[i] * 3
                let gy = j !== i ? err[j] * 3 : 0
                const g = Math.hypot(gx, gy)
                if (g > 1e-9) {
                    const mag = clip(g, M.deadzone + 0.08, 1)
                    gx = (gx / g) * mag
                    gy = (gy / g) * mag
                }
                towards(gx, gy)
            }
        } else if (M.type === 'spokes') {
            // fix the worst coordinate: first travel to its knob (to grab it),
            // then drag the knob along the diameter to the target value
            const i = M.spoke != null && Math.abs(err[M.spoke]) > switchTol ? M.spoke : worst
            const ti = (i * Math.PI) / M.n
            if (M.spoke != null && M.spoke !== i) {
                // holding the wrong knob: release it first by moving
                // perpendicular to its diameter (projection stays constant,
                // so the knob's value is not disturbed while letting go)
                const tg = (M.spoke * Math.PI) / M.n
                const c = Math.cos(tg), s = Math.sin(tg)
                const p = S.pointer.px * c + S.pointer.py * s
                const q0 = -S.pointer.px * s + S.pointer.py * c
                const sgn = q0 >= 0 || Math.abs(q0) < 1e-9 ? 1 : -1
                // release requires angDist > M.release; the angle from the
                // diameter is atan(|q|/|p|), so scale q with |p|
                const q = sgn * Math.max(0.25, Math.abs(p) * Math.tan(M.release) * 1.4)
                towards(p * c - q * s, p * s + q * c)
            } else if (M.spoke === i) {
                // drag the knob straight to the target value (the pointer aims
                // at the target minus its grab offset, slider-style)
                const v = target[i] - (M.grabOff || 0)
                towards(v * Math.cos(ti), v * Math.sin(ti))
            } else {
                // approach the knob; if it sits inside the deadzone, approach
                // the nearest graspable point just outside it
                const dz = M.deadzone * 1.05
                const sgn = M.x[i] >= 0 ? 1 : -1
                const v = Math.abs(M.x[i]) < dz ? sgn * dz : M.x[i]
                towards(v * Math.cos(ti), v * Math.sin(ti))
            }
        }
        return ev
    }

    return { step, state: S }
}

export default {
    MAPPING_TYPES, pairList, createMapping, mappingUpdate, mappingSync,
    mappingDisplay, simulatedUser,
}
