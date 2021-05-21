function step({ P, S, I }) {
  let x1 = P.dt*S.x2 + S.x1 // next state
  const x2 = P.c*I.x - P.d*S.x2 // for some reason when I add this in it starts flashing
  //x1 = Math.min(Math.max(x1, P.min), P.max)
  const Sp = { t: S.t+1, x1, x2}
  const O = { cost: (S.x1 - S.r)**2 }

  // Ben's code for first order system?
  // x = S.x + P.dt*I.x
  // x = Math.min(Math.max(x, P.min), P.max)
  // Sp = { t: S.t+1, x: x}
  return { Sp , O }
}

function reset({ P }) {
  const I = {x:0}
  const S = {t:0, x1:0, x2:0}
  const { O } = step({ P, S, I })

  return { P, S, I, O}
}

export default { step, reset }
