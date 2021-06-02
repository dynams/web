Array.prototype.add = function(b,c=1) {
  const a = this, d = [];
  if( Object.prototype.toString.call( b ) === '[object Array]' ) {
    if( a.length !== b.length ) {
      throw "Array lengths do not match.";
    } else {
      for(var i = 0; i < a.length; i++) {
        d[i] = a[i] + c*b[i];
      }
    }
  } else if( typeof b === 'number' ) {
    for(var i = 0; i < a.length; i++) {
      d[i] = a[i] + c*b;
    }
  }
  return d;
}

Array.prototype.mul = function(b) {
  const a = this, c = [];
  if( Object.prototype.toString.call( b ) === '[object Array]' ) {
    if( a.length !== b.length ) {
      throw "Array lengths do not match.";
    } else {
      for(var i = 0; i < a.length; i++) {
        c[i] = a[i] * b[i];
      }
    }
  } else if(typeof b === 'number') {
    for(var i = 0; i < a.length; i++) {
      c[i] = a[i]*b;
    }
  }
  return c;
}


function runge_kutta({ f, t, x, u, dt }) {
  const dx1 = f(t, x, u ).mul(dt)
  const dx2 = f(t, x.add(dx1, .5), u).mul(dt)
  const dx3 = f(t, x.add(dx2, .5), u).mul(dt)
  const dx4 = f(t, x.add(dx3, .5), u).mul(dt)
  const dx = dx1.add(dx2, 2).add(dx3, 2).add(dx4, 1).mul(1/6)

  return x.add(dx)
}

function second_order(t, x, u, b=1) {
  const q = x[0];
  const dq = x[1]
  const ddq = u;
  return [ dq, ddq - b*dq ]
}

function step({ P, S, I }) {
  const r = reference(S.t, P);

  const f = second_order;
  const t = S.t
  const x = [ S.q, S.dq ];
  const d = disturbance(S.t, P); // disturbance
  const u = I.x + P.d*d;

  const xp = runge_kutta({f, t, x, u, dt:P.dt})
  const q = xp[0];
  const dq = xp[1];
  const Sp = { t: S.t + 1, time: S.time + P.dt, q, dq, r }
  const O = { cost: (S.q - S.r)**2 }

  return { Sp , O }
}

function reset({ P }) {
  const I = { x:0 }
  const S = { t:0, time:0, d:0, q:0, dq:0, r:0 }
  const { O } = step({ P, S, I })

  return { P, S, I, O }
}

export let buff = {r:[], t:0}
const freqs = [2, 3, 5, 7, 11, 13, 17, 19]
//freqs = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
let amp1 = []
freqs.forEach((f, index) => {
  // working on this part - not sure if this is right equation
  amp1[index] = (.5/f)
});

const sum1 = amp1.reduce(function(a, b){
  return a + b;
}, 0);

let amp = []
freqs.forEach((f, index) => {
  amp[index] = (1./f)*sum1
});

export function reference(time, P) {
  time = time - P.shift
  let x = 0
  if (time < 0) return 0
  const weight = (0<time)*(time<P.ramp)*(time/P.ramp) + (time>=P.ramp)
  freqs.forEach((f, idx) => {
    if ((idx % 2 == 0 && P.mode == 'even') || 
        (idx % 2 == 1 && P.mode == 'odd')) {
      x += weight*Math.sin(time*f/P.scale)*amp[idx]
    }
  })
  return x
}

export function disturbance(time, P) {
  time = time - P.shift
  let x = 0
  if (time < 0) return 0
  const weight = (0<time)*(time<P.ramp)*(time/P.ramp) + (time>=P.ramp)
  freqs.forEach((f, idx) => {
    if ((idx % 2 == 1 && P.mode == 'even') || 
        (idx % 2 == 0 && P.mode == 'odd')) {
      x += weight*Math.sin(time*f/P.scale)*amp[idx]
    }
  })
  return x
}

export function init_reference(time, n, P) {
  let t = new Array(n).fill(1).map((e,i)=>i)
  const y = t.map((t)=>reference(time + t - n/2, P))
  return y
}

export default { step, reset, reference, init_reference }
