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
  const r = 0;

  const f = second_order;
  const t = S.t
  const x = [ S.q, S.dq ];
  const d = 0; // disturbance
  const u = I.x + d;

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

export default { step, reset }
