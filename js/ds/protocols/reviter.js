function step({ P, S, I }) {
  console.log(S);
  console.log(I);
  const g = (I.cp - I.cn)/(P.delta);
  let k_next = S.k - P.lr*g;

  console.log(P)
  if (k_next < P.kmin) {
    k_next = P.kmin
  } else if (k_next > P.kmax) {
    k_next = P.kmax
  }
  return { Sp: { t: S.t + 1, k: k_next } }
}

export default { step }
