function step({ P, S, I }) {
  console.log(S);
  console.log(I);
  const g = (I.cp - I.cn)/(P.delta);
  const k_next = S.k - P.lr*g;
  if (k_next < 0.4) {
    return { Sp: { t: S.t + 1, k: 0.4 } }
  } else if (k_next > 1.1) {
    return { Sp: { t: S.t + 1, k: 1.1 } }
  }

  return { Sp: { t: S.t + 1, k: k_next } }
}

export default { step }
