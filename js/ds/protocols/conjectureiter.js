function inner_step({ P, S, I }) {
  const x = math.median(I.x);
  const y = math.median(I.y);
}

function step({ P, S, I }) {
  let l_next = (I.xp - I.xn)/(I.yp - I.yn) ;

  if (l_next < P.lmin) {
    l_next = P.lmin
  } else if (l_next > P.lmax) {
    l_next = P.lmax
  } 
  return { Sp: { t: S.t+1, l: l_next } }
}

export default { step };
