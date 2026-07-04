// nxm_math.js — core math for n x m quadratic games.
//
// Human action x in R^n, machine action y in R^m. Each player has a centered
// quadratic cost, generalizing the scalar game in quadgame.js (a,b,h / d,c,e):
//
//   f_H(x,y) = 1/2 (x-x1)'A(x-x1) + (x-x1)'B(y-y1) + 1/2 (y-y1)'H(y-y1)
//   f_M(x,y) = 1/2 (y-y2)'D(y-y2) + (y-y2)'C(x-x2) + 1/2 (x-x2)'E(x-x2)
//
// A (n x n) and D (m x m) symmetric positive definite; H (m x m) and E (n x n)
// symmetric positive semidefinite. (x1,y1) is the human's global optimum when
// H - B'inv(A)B >= 0, and (x2,y2) is the machine's when E - C'inv(D)C >= 0.
//
// Equilibria (all closed form / fixed point):
//   nash          — simultaneous play
//   stackelberg   — human leads, machine best-responds
//   ccve          — consistent conjectural variations equilibrium
//   steering      — reverse Stackelberg: affine machine policy y = l + Lx that
//                   places the human's induced optimum at the machine's global
//                   optimum (x2, y2), with second-order (PD) repair
//
// Data-driven pieces used by the outer-loop protocols:
//   lsq_conjecture — least-squares fit of the human policy x = k0 + K y
//   spsa_step      — simultaneous-perturbation two-point gradient step
//
// Pure ES module: no DOM, no platform imports — importable from node tests.

// ---------------------------------------------------------------- rng
// Deterministic seeded generator (mulberry32) so experiments/tests reproduce.
export function rng(seed) {
    let a = seed >>> 0
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// ---------------------------------------------------------------- linear algebra
export const zeros = (r, c) =>
    c == null
        ? new Array(r).fill(0)
        : Array.from({ length: r }, () => new Array(c).fill(0))
export const eye = n => Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
export const T = M => M[0].map((_, j) => M.map(row => row[j]))
export const matmul = (X, Y) =>
    X.map(row => Y[0].map((_, j) => row.reduce((s, v, k) => s + v * Y[k][j], 0)))
export const matvec = (M, v) =>
    M.map(row => row.reduce((s, x, k) => s + x * v[k], 0))
export const vadd = (u, v) => u.map((x, i) => x + v[i])
export const vsub = (u, v) => u.map((x, i) => x - v[i])
export const vscale = (u, s) => u.map(x => x * s)
export const madd = (X, Y) => X.map((r, i) => r.map((x, j) => x + Y[i][j]))
export const msub = (X, Y) => X.map((r, i) => r.map((x, j) => x - Y[i][j]))
export const mscale = (X, s) => X.map(r => r.map(x => x * s))
export const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0)
export const norm = u => Math.sqrt(dot(u, u))
export const norminf = u => u.reduce((s, x) => Math.max(s, Math.abs(x)), 0)
export const outer = (u, v) => u.map(a => v.map(b => a * b))
export const clip = (x, lo, hi) => Math.min(Math.max(x, lo), hi)
export const clipvec = (u, lo, hi) => u.map(x => clip(x, lo, hi))

export function solve(Ain, bin) {
    // Gaussian elimination with partial pivoting; b may be a vector or matrix.
    const n = Ain.length
    const isVec = !Array.isArray(bin[0])
    const B = isVec ? bin.map(x => [x]) : bin.map(r => r.slice())
    const A = Ain.map(r => r.slice())
    for (let col = 0; col < n; col++) {
        let piv = col
        for (let r = col + 1; r < n; r++)
            if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
        ;[A[col], A[piv]] = [A[piv], A[col]]
        ;[B[col], B[piv]] = [B[piv], B[col]]
        if (Math.abs(A[col][col]) < 1e-12) throw new Error('nxm_math.solve: singular matrix')
        for (let r = 0; r < n; r++) {
            if (r === col) continue
            const f = A[r][col] / A[col][col]
            if (f === 0) continue
            for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
            for (let c = 0; c < B[0].length; c++) B[r][c] -= f * B[col][c]
        }
    }
    const X = B.map((row, i) => row.map(x => x / A[i][i]))
    return isVec ? X.map(r => r[0]) : X
}
export const inv = M => solve(M, eye(M.length))

export function mineig(Min, iters = 200) {
    // Smallest eigenvalue of a symmetric matrix by inverse-shift power iteration
    // fallback: for the small (<= ~8) dims used here, use eigenvalue bounds via
    // repeated deflation-free power iteration on (cI - M).
    const n = Min.length
    // Gershgorin upper bound for eigenvalues
    let c = -Infinity
    for (let i = 0; i < n; i++) {
        let r = 0
        for (let j = 0; j < n; j++) if (j !== i) r += Math.abs(Min[i][j])
        c = Math.max(c, Min[i][i] + r)
    }
    c += 1
    // power iteration on (cI - M): dominant eigenvalue = c - lambda_min(M)
    const S = eye(n).map((row, i) => row.map((v, j) => c * v - Min[i][j]))
    let v = new Array(n).fill(0).map((_, i) => 1 / Math.sqrt(n) + (i % 2 ? 1e-3 : -1e-3))
    let lam = 0
    for (let k = 0; k < iters; k++) {
        const w = matvec(S, v)
        lam = norm(w)
        if (lam < 1e-300) return c
        v = vscale(w, 1 / lam)
    }
    return c - lam
}
export const isPD = (M, tol = 1e-9) => mineig(M) > tol

// ---------------------------------------------------------------- game
export function makeGame({ A, B, H, D, C, E, x1, y1, x2, y2 }) {
    const n = A.length
    const m = D.length
    H = H || zeros(m, m)
    E = E || zeros(n, n)
    x1 = x1 || zeros(n)
    y1 = y1 || zeros(m)
    x2 = x2 || zeros(n)
    y2 = y2 || zeros(m)
    return { A, B, H, D, C, E, x1, y1, x2, y2, n, m }
}

export function costH(G, x, y) {
    const u = vsub(x, G.x1)
    const v = vsub(y, G.y1)
    return 0.5 * dot(u, matvec(G.A, u)) + dot(u, matvec(G.B, v)) + 0.5 * dot(v, matvec(G.H, v))
}
export function costM(G, x, y) {
    const u = vsub(x, G.x2)
    const v = vsub(y, G.y2)
    return 0.5 * dot(v, matvec(G.D, v)) + dot(v, matvec(G.C, u)) + 0.5 * dot(u, matvec(G.E, u))
}
export function gradHx(G, x, y) {
    return vadd(matvec(G.A, vsub(x, G.x1)), matvec(G.B, vsub(y, G.y1)))
}
export function gradMy(G, x, y) {
    return vadd(matvec(G.D, vsub(y, G.y2)), matvec(G.C, vsub(x, G.x2)))
}
export function brH(G, y) {
    // argmin_x f_H(x, y) = x1 - inv(A) B (y - y1)
    return vsub(G.x1, solve(G.A, matvec(G.B, vsub(y, G.y1))))
}
export function brM(G, x) {
    // argmin_y f_M(x, y) = y2 - inv(D) C (x - x2)
    return vsub(G.y2, solve(G.D, matvec(G.C, vsub(x, G.x2))))
}

// Machine's *conjectural* response given conjecture K (n x m) that the human's
// policy has slope dx/dy = K. First-order condition:
//   (D + K'C')(y - y2) + (C + K'E)(x - x2) = 0
// so the machine's play is affine in x: y = y2 + Lk (x - x2), with
//   Lk = -inv(D + K'C') (C + K'E).
// K = 0 recovers the plain best response.
export function conjecturalSlopeM(G, K) {
    const Dk = madd(G.D, matmul(T(K), T(G.C)))
    const Ck = madd(G.C, matmul(T(K), G.E))
    return mscale(solve(Dk, Ck), -1)
}
export function conjecturalBRM(G, K, x) {
    const Lk = conjecturalSlopeM(G, K)
    return vadd(G.y2, matvec(Lk, vsub(x, G.x2)))
}
export function conjecturalGradM(G, K, x, y) {
    // gradient of machine cost along its conjectured feasible direction
    const Dk = madd(G.D, matmul(T(K), T(G.C)))
    const Ck = madd(G.C, matmul(T(K), G.E))
    return vadd(matvec(Dk, vsub(y, G.y2)), matvec(Ck, vsub(x, G.x2)))
}

// ---------------------------------------------------------------- equilibria
export function nash(G) {
    // stack the two first-order conditions into one linear system
    const { n, m } = G
    const M = zeros(n + m, n + m)
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) M[i][j] = G.A[i][j]
    for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) M[i][n + j] = G.B[i][j]
    for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++) M[n + i][j] = G.C[i][j]
    for (let i = 0; i < m; i++)
        for (let j = 0; j < m; j++) M[n + i][n + j] = G.D[i][j]
    const b = [
        ...vadd(matvec(G.A, G.x1), matvec(G.B, G.y1)),
        ...vadd(matvec(G.C, G.x2), matvec(G.D, G.y2)),
    ]
    const z = solve(M, b)
    return { x: z.slice(0, n), y: z.slice(n) }
}

export function stackelberg(G) {
    // Human leads: machine plays y(x) = y2 - inv(D) C (x - x2), slope Lbr.
    // Human minimizes f_H(x, y(x)); with u = x - x1, v = y(x) - y1 = v0 + Lbr u:
    //   [A + B Lbr + Lbr'B' + Lbr'H Lbr] u = -(B + Lbr'H) v0
    const Lbr = mscale(solve(G.D, G.C), -1)
    const v0 = vadd(vsub(G.y2, G.y1), matvec(Lbr, vsub(G.x1, G.x2)))
    const BL = matmul(G.B, Lbr)
    const Hess = madd(madd(G.A, madd(BL, T(BL))), matmul(matmul(T(Lbr), G.H), Lbr))
    const rhs = vscale(matvec(madd(G.B, matmul(T(Lbr), G.H)), v0), -1)
    const u = solve(Hess, rhs)
    const x = vadd(G.x1, u)
    return { x, y: brM(G, x), hessian: Hess }
}

export function ccve(G, { iters = 500, tol = 1e-12 } = {}) {
    // Consistent conjectural variations equilibrium. Conjectures: human thinks
    // dy/dx = L, machine thinks dx/dy = K. Conjectural best responses have the
    // consistency fixed point:
    //   K = -inv(A + L'B') (B + L'H)
    //   L = -inv(D + K'C') (C + K'E)
    // Equilibrium point solves the two conjectural first-order conditions.
    const { n, m } = G
    let K = mscale(solve(G.A, G.B), -1)     // start from myopic slopes
    let L = mscale(solve(G.D, G.C), -1)
    let converged = false
    for (let k = 0; k < iters; k++) {
        const Knew = mscale(solve(madd(G.A, matmul(T(L), T(G.B))), madd(G.B, matmul(T(L), G.H))), -1)
        const Lnew = mscale(solve(madd(G.D, matmul(T(Knew), T(G.C))), madd(G.C, matmul(T(Knew), G.E))), -1)
        let d = 0
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) d = Math.max(d, Math.abs(Knew[i][j] - K[i][j]))
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) d = Math.max(d, Math.abs(Lnew[i][j] - L[i][j]))
        K = Knew
        L = Lnew
        if (d < tol) { converged = true; break }
    }
    // FOCs: (A + L'B')(x - x1) + (B + L'H)(y - y1) = 0
    //       (C + K'E)(x - x2) + (D + K'C')(y - y2) = 0
    const Ax = madd(G.A, matmul(T(L), T(G.B)))
    const Bx = madd(G.B, matmul(T(L), G.H))
    const Cy = madd(G.C, matmul(T(K), G.E))
    const Dy = madd(G.D, matmul(T(K), T(G.C)))
    const M = zeros(n + m, n + m)
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) M[i][j] = Ax[i][j]
        for (let j = 0; j < m; j++) M[i][n + j] = Bx[i][j]
    }
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) M[n + i][j] = Cy[i][j]
        for (let j = 0; j < m; j++) M[n + i][n + j] = Dy[i][j]
    }
    const b = [
        ...vadd(matvec(Ax, G.x1), matvec(Bx, G.y1)),
        ...vadd(matvec(Cy, G.x2), matvec(Dy, G.y2)),
    ]
    const z = solve(M, b)
    return { x: z.slice(0, n), y: z.slice(n), K, L, converged }
}

// Human's induced problem when the machine commits to policy y = l + L x:
// total gradient of f_H(x, l + Lx) is
//   [A + BL + L'B' + L'HL] (x - x1) + (B + L'H)(l + L x1 - y1) ... assembled below.
export function inducedHuman(G, L, l) {
    const BL = matmul(G.B, L)
    const Hess = madd(madd(G.A, madd(BL, T(BL))), matmul(matmul(T(L), G.H), L))
    // stationarity: Hess (x - x1) + (B + L'H)(v0) = 0 with v0 = l + L x - y1
    // evaluated consistently: write v = l + Lx - y1 = v1 + L(x - x1), v1 = l + L x1 - y1
    const v1 = vadd(vsub(l, G.y1), matvec(L, G.x1))
    const rhs = vscale(matvec(madd(G.B, matmul(T(L), G.H)), v1), -1)
    let x = null
    const pd = isPD(Hess)
    if (pd) x = vadd(G.x1, solve(Hess, rhs))
    return { Hess, x, pd }
}

export function steering(G, { seed = 1, tries = 4000, margin = 1e-3 } = {}) {
    // Reverse Stackelberg: find affine policy y = l + Lx such that the human's
    // induced optimum is the machine's global optimum (x2, y2).
    // Constraints:  l = y2 - L x2  and  L'v = w  with
    //   v = B'(x2 - x1) + H(y2 - y1)   (in R^m)
    //   w = -[A(x2 - x1) + B(y2 - y1)] (in R^n)
    // Solution family: L = v w'/(v'v) + Pker M for any M, Pker = I - vv'/(v'v).
    // Search the family for a policy whose induced human Hessian is PD.
    const { n, m } = G
    const v = vadd(matvec(T(G.B), vsub(G.x2, G.x1)), matvec(G.H, vsub(G.y2, G.y1)))
    const w = vscale(vadd(matvec(G.A, vsub(G.x2, G.x1)), matvec(G.B, vsub(G.y2, G.y1))), -1)
    const vv = dot(v, v)
    if (vv < 1e-12) {
        if (norm(w) < 1e-9) {
            // target already a stationary point for any policy with L'v = anything
            const L = zeros(m, n)
            const l = vsub(G.y2, matvec(L, G.x2))
            const ind = inducedHuman(G, L, l)
            return { L, l, ok: ind.pd, mineig: mineig(ind.Hess), v, w }
        }
        return { L: null, l: null, ok: false, reason: 'infeasible: v = 0 but w != 0', v, w }
    }
    const L0 = mscale(outer(v, w), 1 / vv) // m x n, satisfies L0'v = w
    const Pker = msub(eye(m), mscale(outer(v, v), 1 / vv))
    const rand = rng(seed)
    let best = null
    let scale = 0
    for (let t = 0; t < tries; t++) {
        // sample M with growing magnitude; t = 0 tries the minimum-norm L0
        const M = zeros(m, n).map(row => row.map(() => (rand() * 2 - 1) * scale))
        const L = madd(L0, matmul(Pker, M))
        const l = vsub(G.y2, matvec(L, G.x2))
        const me = mineig(inducedHuman(G, L, l).Hess)
        if (best == null || me > best.me) best = { L, l, me }
        if (me > margin) break
        scale = 0.25 + 2.5 * rand()
    }
    return {
        L: best.L,
        l: best.l,
        ok: best.me > margin,
        mineig: best.me,
        v, w,
    }
}

// Note on Experiment 2's estimation loop: if the machine plays the affine map
// y = y2 + L(x - x2) (+ probe offsets) and a settling human comes to rest at
// the minimum of the induced landscape, then regressing the human's rest
// action x on the machine's *realized* action y recovers exactly the
// conjectural-variations slope -inv(A + L'B')(B + L'H) — even though the
// human's response slope to the *commanded probe* is a different matrix,
// -inv(A + BL + L'B' + L'HL)(B + L'H). (Scalar case: both reduce to
// -(b+Lh)/(a+bL) after the change of variables; the matrix identity is
// verified numerically in the tests.) Consequence for the protocol: the
// conjecture must be fit against realized machine actions, not commanded
// offsets, for the CCVE prediction to hold.

export function equilibria(G) {
    const NE = nash(G)
    const SE = stackelberg(G)
    const CC = ccve(G)
    const MO = { x: G.x2.slice(), y: G.y2.slice() } // machine's global optimum
    const ST = steering(G)
    const pts = { NE, SE, CC, MO }
    const keys = Object.keys(pts)
    const sep = {}
    for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++)
            sep[keys[i] + '-' + keys[j]] = norm(vsub(pts[keys[i]].x, pts[keys[j]].x))
    return { NE, SE, CC, MO, ST, sep }
}

// ---------------------------------------------------------------- game design
// Randomly search for a game whose equilibria are pairwise separated (in the
// human's action space), all inside the reachable box, with feasible steering.
export function designGame({
    n = 2, m = 2, seed = 1,
    sepMin = 0.35,          // min pairwise distance between equilibria (per unit box)
    box = 0.75,             // all equilibria must lie in [-box, box]^n (and ^m)
    maxIters = 3000,        // matrix draws
    centerTries = 30,       // center draws per matrix draw (equilibria are affine
                            // in the centers, so re-drawing centers is cheap)
} = {}) {
    const rand = rng(seed)
    const randMat = (r, c, s) => zeros(r, c).map(row => row.map(() => (rand() * 2 - 1) * s))
    const spd = (k, diag, off) => {
        const R = randMat(k, k, off)
        return madd(matmul(T(R), R), mscale(eye(k), diag))
    }
    for (let it = 0; it < maxIters; it++) {
        const A = spd(n, 0.6 + rand(), 0.6)
        const D = spd(m, 0.4 + 0.8 * rand(), 0.5)
        const B = randMat(n, m, 0.9)
        const C = randMat(m, n, 0.9)
        // strong monotonicity of the game operator: sym([[A,B],[C,D]]) > 0.
        // This makes the Nash equilibrium unique and gradient play stable at
        // any timescale ratio — the regime Experiment 1 sweeps over.
        const J = zeros(n + m, n + m)
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) J[i][j] = A[i][j]
            for (let j = 0; j < m; j++) J[i][n + j] = B[i][j]
        }
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) J[n + i][j] = C[i][j]
            for (let j = 0; j < m; j++) J[n + i][n + j] = D[i][j]
        }
        const symJ = madd(J, T(J)).map(r => r.map(v => v / 2))
        if (mineig(symJ) < 0.05) continue
        // construct H and E so each player's global optimum exists:
        //   H - B'inv(A)B >= 0  and  E - C'inv(D)C >= 0  by construction
        const H = madd(matmul(matmul(T(B), inv(A)), B), spd(m, 0.05 + 0.3 * rand(), 0.2))
        const E = madd(matmul(matmul(T(C), inv(D)), C), spd(n, 0.05 + 0.5 * rand(), 0.3))
        for (let ct = 0; ct < centerTries; ct++) {
            const x1 = zeros(n).map(() => (rand() * 2 - 1) * box)
            const y1 = zeros(m).map(() => (rand() * 2 - 1) * box)
            const x2 = zeros(n).map(() => (rand() * 2 - 1) * box)
            const y2 = zeros(m).map(() => (rand() * 2 - 1) * box)
            const G = makeGame({ A, B, H, D, C, E, x1, y1, x2, y2 })
            let eq
            try {
                eq = equilibria(G)
            } catch (e) {
                break // matrix-level failure: draw new matrices
            }
            if (!eq.CC.converged) break
            if (mineig(eq.SE.hessian) < 1e-6) break
            // separation + box constraints (center-dependent: retry centers)
            if (!Object.values(eq.sep).every(s => s > sepMin)) continue
            const inBox = pt =>
                pt.x.every(v => Math.abs(v) <= box) && pt.y.every(v => Math.abs(v) <= box)
            if (![eq.NE, eq.SE, eq.CC, eq.MO].every(inBox)) continue
            if (!eq.ST.ok) continue
            return { G, eq, iters: it + 1 }
        }
    }
    return null
}

// ---------------------------------------------------------------- estimation
// Least-squares fit of the human's steady-state policy x = k0 + K y from probe
// trials: data = [{ y: R^m (machine action), x: R^n (human median response) }].
// Needs at least m+1 probes; ridge-regularized for robustness.
export function lsq_conjecture(data, { ridge = 1e-6 } = {}) {
    const m = data[0].y.length
    const n = data[0].x.length
    const p = m + 1
    // normal equations over features phi = [1, y']
    const XtX = zeros(p, p)
    const XtY = zeros(p, n)
    for (const { x, y } of data) {
        const phi = [1, ...y]
        for (let i = 0; i < p; i++) {
            for (let j = 0; j < p; j++) XtX[i][j] += phi[i] * phi[j]
            for (let j = 0; j < n; j++) XtY[i][j] += phi[i] * x[j]
        }
    }
    for (let i = 0; i < p; i++) XtX[i][i] += ridge
    const W = solve(XtX, XtY) // p x n; row 0 = k0', rows 1..m = K' rows
    const k0 = W[0].slice()
    const K = zeros(n, m)
    for (let j = 0; j < m; j++)
        for (let i = 0; i < n; i++) K[i][j] = W[1 + j][i]
    return { K, k0 }
}

// Two-point SPSA step on a flat parameter vector theta.
//   Jp = J(theta + delta*Delta), Jn = J(theta - delta*Delta), Delta in {+-1}^p
// Returns the updated theta. The perturbation Delta must be the one actually
// used to collect Jp/Jn (pass it in), so trials and updates stay consistent.
export function spsa_step({ theta, Jp, Jn, Delta, delta, lr }) {
    const g = (Jp - Jn) / (2 * delta)
    return theta.map((t, i) => t - lr * g * Delta[i])
}
export function spsa_delta(p, rand) {
    return zeros(p).map(() => (rand() < 0.5 ? -1 : 1))
}

// pack/unpack the machine policy (L: m x n, l: m) as a flat vector for SPSA
export function packPolicy(L, l) {
    return [...L.flat(), ...l]
}
export function unpackPolicy(theta, n, m) {
    const L = zeros(m, n)
    for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++) L[i][j] = theta[i * n + j]
    const l = theta.slice(m * n)
    return { L, l }
}

// ---------------------------------------------------------------- simulation
// Simulated-human harness used by tests and the demo autopilot.
//
// human.kind:
//   'grad'   — myopic gradient descent on the *partial* gradient d f_H/dx at
//              the current y. Converges to Nash under gradient-play machines
//              at any rate (fixed points of coupled gradient play are Nash).
//   'br'     — first-order lag toward the best response.
//   'prober' — the paper's premise: the human explores. Holds x, probes one
//              coordinate at a time (+-delta, dwell steps each), measures the
//              cost it actually experiences while the machine keeps adapting,
//              and takes finite-difference descent steps. Against a fast
//              machine the probe measures the *composite* landscape (machine
//              re-settles within a dwell) and the human behaves like a leader
//              (-> Stackelberg); against a slow machine the probe measures
//              the partial derivative (-> Nash). Nothing about the equilibria
//              is baked in — the shift emerges from timescales.
//
// If the machine plays a policy, the 'grad' human descends the *induced*
// landscape (it experiences y = l + Lx), matching the same premise.
export function simulate({
    G, steps = 4000,
    human = { kind: 'grad', rate: 0.05, noise: 0, rand: rng(2) },
    machine = { kind: 'grad', rate: 0.05, K: null, L: null, l: null, ynash: null },
    x0 = null, y0 = null,
}) {
    let x = x0 ? x0.slice() : zeros(G.n)
    let y = y0 ? y0.slice() : brM(G, x)
    const rand = human.rand || rng(2)
    const K0 = machine.K || zeros(G.n, G.m)
    // prober state
    const dwell = human.dwell || 40
    const delta = human.delta || 0.08
    const eta = human.eta || 0.3
    let dim = 0, sgn = 1, phase = 0, acc = 0, nacc = 0, cplus = 0

    const machineNext = xh => {
        if (machine.kind === 'policy') return vadd(machine.l, matvec(machine.L, xh))
        if (machine.kind === 'br') return conjecturalBRM(G, K0, xh)
        if (machine.kind === 'nash') return machine.ynash
        return vsub(y, vscale(conjecturalGradM(G, K0, xh, y), machine.rate))
    }

    for (let t = 0; t < steps; t++) {
        let xn
        if (human.kind === 'prober') {
            // the action actually played this step is the held x plus a probe
            const xh = x.slice()
            xh[dim] = clip(xh[dim] + sgn * delta, -1.5, 1.5)
            y = clipvec(machineNext(xh), -2, 2)
            if (phase >= dwell / 2) {
                let c = costH(G, xh, y)
                if (human.noise) c += (rand() * 2 - 1) * human.noise
                acc += c
                nacc++
            }
            phase++
            if (phase >= dwell) {
                const avg = acc / Math.max(nacc, 1)
                acc = 0; nacc = 0; phase = 0
                if (sgn === 1) {
                    cplus = avg
                    sgn = -1
                } else {
                    const g = (cplus - avg) / (2 * delta)
                    x[dim] = clip(x[dim] - eta * g, -1.5, 1.5)
                    sgn = 1
                    dim = (dim + 1) % G.n
                }
            }
            continue
        }
        if (human.kind === 'br') {
            const xstar = machine.kind === 'policy'
                ? inducedHuman(G, machine.L, machine.l).x
                : brH(G, y)
            xn = vadd(vscale(x, 1 - human.rate), vscale(xstar, human.rate))
        } else {
            let g
            if (machine.kind === 'policy') {
                // gradient of the induced landscape f_H(x, l + Lx)
                const yy = vadd(machine.l, matvec(machine.L, x))
                const gx = gradHx(G, x, yy)
                const gy = vadd(matvec(G.H, vsub(yy, G.y1)), matvec(T(G.B), vsub(x, G.x1)))
                g = vadd(gx, matvec(T(machine.L), gy))
            } else {
                g = gradHx(G, x, y)
            }
            xn = vsub(x, vscale(g, human.rate))
        }
        if (human.noise) xn = xn.map(v => v + (rand() * 2 - 1) * human.noise)
        x = clipvec(xn, -2, 2)
        y = clipvec(machineNext(x), -2, 2)
    }
    return { x, y }
}

export default {
    rng, zeros, eye, T, matmul, matvec, vadd, vsub, vscale, madd, msub, mscale,
    dot, norm, norminf, outer, clip, clipvec, solve, inv, mineig, isPD,
    makeGame, costH, costM, gradHx, gradMy, brH, brM,
    conjecturalSlopeM, conjecturalBRM, conjecturalGradM,
    nash, stackelberg, ccve, inducedHuman, steering,
    equilibria, designGame,
    lsq_conjecture, spsa_step, spsa_delta, packPolicy, unpackPolicy, simulate,
}
