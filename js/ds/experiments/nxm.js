// nxm.js — presentation/IO layer for the n x m game environment.
//
// Pairs with js/ds/environments/nxmgame.js. The 2D pointer (plus wheel /
// space / arrows / button as the discrete channel) drives an n-dimensional
// action through one of the mappings in nxm_mappings.js, selected by
// P.map: 'direct' | 'pairs' | 'velocity' | 'spokes'.
//
// Page contract (see study/nxmgame.html):
//   #output    — SVG rect: the scalar cost bar (same convention as siso.js)
//   #nxmcanvas — canvas: the input interface (sliders / spokes / joystick)
//
// The scalar bar is the ONLY cost feedback; the canvas shows the state of
// the *interface* (knob positions, active pair, grab state) plus the align
// targets for the standby gate — it never displays the cost landscape.

import {
    createMapping, mappingUpdate, mappingDisplay,
} from './nxm_mappings.js'

let map = null
let lastEv = { px: 0, py: 0, down: false }
let wheelAcc = 0
let keyQueue = null
let timer = null

function ensureMapping(P) {
    const type = P.map || 'direct'
    const n = P.n || 2
    if (!map || map.type !== type || map.n !== n) {
        map = createMapping({
            type, n,
            gain: P.gain == null ? 1.2 : P.gain,
            relGain: P.relGain == null ? 1.0 : P.relGain,
            autorotate: P.autorotate || 0,
        })
    }
    return map
}

export function start_condition({ P, S, I }) {
    if (!Array.isArray(S.x) || !Array.isArray(I.x)) return false
    for (let i = 0; i < S.x.length; i++) {
        if (Math.abs(S.x[i] - (I.x[i] == null ? 0 : I.x[i])) >= P.tol) return false
    }
    return true
}

export function mount({ getSpace, setInput, update_fn }) {
    function norm(clientX, clientY) {
        // normalize against the interface canvas when present (so pointer
        // angles line up with the drawn spokes/joystick); window otherwise
        const canvas = document.getElementById('nxmcanvas')
        if (canvas && canvas.clientWidth > 0) {
            const r = canvas.getBoundingClientRect()
            const scale = Math.min(r.width, r.height) * 0.42
            lastEv.px = (clientX - (r.left + r.width / 2)) / scale
            lastEv.py = -(clientY - (r.top + r.height / 2)) / scale
        } else {
            lastEv.px = (clientX / window.innerWidth) * 2 - 1
            lastEv.py = -((clientY / window.innerHeight) * 2 - 1) // up = positive
        }
    }
    const mousemove = e => norm(e.clientX, e.clientY)
    const touchmove = e => { norm(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault() }
    const mousedown = () => { lastEv.down = true }
    const mouseup = () => { lastEv.down = false }
    const wheel = e => { wheelAcc += Math.sign(e.deltaY) }
    const keydown = e => {
        if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'ArrowUp') keyQueue = 'next'
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') keyQueue = 'prev'
        if (e.code === 'Space') e.preventDefault()
    }
    window.addEventListener('mousemove', mousemove)
    window.addEventListener('touchmove', touchmove, { passive: false })
    window.addEventListener('touchstart', mousedown)
    window.addEventListener('touchend', mouseup)
    window.addEventListener('mousedown', mousedown)
    window.addEventListener('mouseup', mouseup)
    window.addEventListener('wheel', wheel)
    window.addEventListener('keydown', keydown)

    // the mapping integrates at a fixed rate independent of pointer events
    // (velocity mode moves with a still pointer; pairs clutch needs steady dt)
    const FPS = 60
    if (timer) window.clearInterval(timer)
    timer = window.setInterval(() => {
        const { P } = getSpace()
        if (!P || !P.n) return
        const M = ensureMapping(P)
        const ev = { ...lastEv, wheel: wheelAcc, key: keyQueue }
        wheelAcc = 0
        keyQueue = null
        const x = mappingUpdate(M, ev, 1 / FPS)
        setInput({ x, px: lastEv.px, py: lastEv.py, down: lastEv.down })
        update_fn()
    }, 1000 / FPS)
}

export function destroy() {
    if (timer) window.clearInterval(timer)
    timer = null
}

export function draw(PSIO) {
    drawBar(PSIO)
    drawInterface(PSIO)
}

// ---------------------------------------------------------------- cost bar
function drawBar({ O }) {
    const output = document.getElementById('output')
    if (!output || !O) return
    const bot = 80, mid = 70, tot = 10
    let val = O.cost == null ? 0 : O.cost
    if (val > 0.5) val = Math.atan(Math.PI * (val - 0.5)) / Math.PI + 1 / 2
    output.setAttribute('height', val * (mid - tot) + bot - mid + '%')
    output.setAttribute('y', (1 - val) * (mid - tot) + tot + '%')
}

// ---------------------------------------------------------------- interface
const FG = '#eee'
const DIM = '#666'
const HI = '#6cf'
const TGT = '#f80'

function drawInterface({ P, S, I }) {
    const canvas = document.getElementById('nxmcanvas')
    if (!canvas || !P || !P.n || !map) return
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
    }
    const ctx = canvas.getContext('2d')
    const W = canvas.width, Hh = canvas.height
    ctx.clearRect(0, 0, W, Hh)
    const d = mappingDisplay(map)
    const targets = P.showtarget && S && S.target ? S.target
        : S && Array.isArray(S.x) ? S.x : null

    if (d.type === 'spokes') drawSpokes(ctx, W, Hh, d, targets)
    else drawSliders(ctx, W, Hh, d, targets, P)
}

function drawSliders(ctx, W, H, d, targets, P) {
    // n vertical sliders; knob = diamond at x_i; active pair highlighted
    const n = d.n
    const pad = W * 0.12
    const gap = (W - 2 * pad) / Math.max(n - 1, 1)
    const top = H * 0.12, bot = H * 0.88
    const yOf = v => bot - ((v + 1) / 2) * (bot - top)
    const activePair = d.pairs[d.active] || []

    for (let i = 0; i < n; i++) {
        const x = n === 1 ? W / 2 : pad + i * gap
        const active = (d.type === 'pairs' || d.type === 'velocity') && activePair.includes(i)
        ctx.strokeStyle = active ? HI : DIM
        ctx.lineWidth = active ? 3 : 1
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x, bot)
        ctx.stroke()
        // center tick
        ctx.strokeStyle = DIM
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x - 6, yOf(0))
        ctx.lineTo(x + 6, yOf(0))
        ctx.stroke()
        // align target (standby gate) or task target
        if (targets && targets[i] != null) {
            ctx.strokeStyle = TGT
            ctx.lineWidth = 2
            const ty = yOf(targets[i])
            ctx.strokeRect(x - 9, ty - 4, 18, 8)
        }
        // knob
        ctx.fillStyle = active ? HI : FG
        const ky = yOf(d.x[i])
        ctx.beginPath()
        ctx.moveTo(x, ky - 8)
        ctx.lineTo(x + 8, ky)
        ctx.lineTo(x, ky + 8)
        ctx.lineTo(x - 8, ky)
        ctx.closePath()
        ctx.fill()
        // label
        ctx.fillStyle = active ? HI : DIM
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('x' + (i + 1), x, bot + 16)
    }
    if (d.type === 'velocity') {
        // joystick indicator: ring with deadzone and current deflection
        const r = Math.min(W, H) * 0.08
        const cx = W - r - 12, cy = r + 12
        ctx.strokeStyle = DIM
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, r * (map.deadzone || 0.12), 0, 7); ctx.stroke()
        ctx.fillStyle = HI
        ctx.beginPath()
        ctx.arc(cx + (lastEv.px || 0) * r, cy - (lastEv.py || 0) * r, 4, 0, 7)
        ctx.fill()
    }
    if (d.type === 'pairs') {
        ctx.fillStyle = lastEv.down ? HI : DIM
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(lastEv.down ? 'drag' : 'hold click to drag · scroll/space to switch', W - 10, 18)
    }
}

function drawSpokes(ctx, W, H, d, targets) {
    const n = d.n
    const cx = W / 2, cy = H / 2
    const R = Math.min(W, H) * 0.42
    const pt = (i, v) => {
        const th = (i * Math.PI) / n
        return [cx + v * R * Math.cos(th), cy - v * R * Math.sin(th)]
    }
    // outer circle + deadzone
    ctx.strokeStyle = DIM
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, R * (map.deadzone || 0.12), 0, 7); ctx.stroke()
    for (let i = 0; i < n; i++) {
        const grabbed = d.spoke === i
        ctx.strokeStyle = grabbed ? HI : DIM
        ctx.lineWidth = grabbed ? 3 : 1
        const [ax, ay] = pt(i, -1)
        const [bx, by] = pt(i, 1)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        if (targets && targets[i] != null) {
            const [tx, ty] = pt(i, targets[i])
            ctx.strokeStyle = TGT
            ctx.lineWidth = 2
            ctx.strokeRect(tx - 6, ty - 6, 12, 12)
        }
        const [kx, ky] = pt(i, d.x[i])
        ctx.fillStyle = grabbed ? HI : FG
        ctx.beginPath(); ctx.arc(kx, ky, 7, 0, 7); ctx.fill()
        const [lx, ly] = pt(i, 1.12)
        ctx.fillStyle = DIM
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('x' + (i + 1), lx, ly)
    }
    // pointer
    ctx.fillStyle = '#999'
    ctx.beginPath()
    ctx.arc(cx + (lastEv.px || 0) * R, cy - (lastEv.py || 0) * R, 3, 0, 7)
    ctx.fill()
}

export default { mount, destroy, start_condition, draw }
