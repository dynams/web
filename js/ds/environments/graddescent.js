// Simulates
// \minimize_x f(x)
// by gradient descent
// x(t+1) = x(t) - lr * f'(x)
//

import { random_uniform } from "/js/ds/environments/utils.js";

function cost({ P, S }) {
    const x = (S.x - P.x0) * 2;
    return (P.A * x ** 2) / 2 + 1;
}

function grad({ P, S }) {
    return P.A * (S.x - P.x0);
}

function step({ P, S, I }) {
    const Sp = { x: I.x };
    const O = { cost: cost({ P, S }), grad: grad({ P, S }) };
    return { Sp, O };
}

function step_sim({ P, S }) {
    const g = grad({ P, S });
    const Sp = { x: S.x - P.lr * g };
    const O = { cost: cost({ P, S }), grad: g };
    return { Sp, O };
}

function reset({ P }) {
    
    const PP = {...P,
        lr: 0,
    };
    const S = { x: random_uniform(-1, 1) } 
    const I = { x: 0 }
    const { O } = step({ P:PP, S, I })
    return { P:PP, S, I, O };
}


export default { step, reset, step_sim }
