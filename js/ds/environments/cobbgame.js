import { random_uniform } from "/js/ds/environments/utils.js";

function sat(x,a,b) {
    return Math.min(Math.max(x, a), b)
}

function costs({ P, S }) {
    const a1 = P.a1;
    const b1 = P.b1;
    const d1 = P.d1;

    const a2 = P.a2;
    const b2 = P.b2;
    const d2 = P.d2;

    const costx = -1*(1 - S.x)**a1 * (S.x + d1*S.y)**b1;
    let costy=0;
    if(!P.rev) {
      costy = -1*(1 - S.y)**a2 * (S.y + d2*S.x)**b2;
    } else {
      costy = (S.x - P.x2)**2/2 + (S.y - P.y2)**2/2;
    }

    return { costx, costy };
}

function shift_pert({ P, m }) {
    const dy = P.ypert * Math.sqrt(m**2 + 1);
    return { dy }
} 

function gradient({ P, S }) {
    const a = P.a2;
    const b = P.b2;
    const d = P.d2;

    const m = -(a*d)/(a + b + b*d*P.l);
    const { dy } = shift_pert({ P, m });
    const y = S.y - dy;

    const d2f2 = b*(1-y)**a * (y+d*S.x)**(b-1) 
      - a*(1-y)**(a-1) * (y+d*S.x)**b;
    const d2f1 = b*d*(1-y)**a * (y+d*S.x)**(b-1);

    const grady = d2f2 + P.l*d2f1;

    return { grady };
}

function gradient_rev({ P, S }) {

    const m = P.k + P.kpert;
    const { dy } = shift_pert({ P, m });

    const grady = -m * (S.x-P.x2) + P.y2 + dy;

    return { grady };
}


function bestresponse({ P, S }) {
    const a = P.a2;
    const b = P.b2;
    const d = P.d2;

    const m = -(a*d)/(a + b + b*d*P.l);

    const { dy } = shift_pert({ P, m });

    const bry = m * S.x + (b + b*d*P.l)/(a + b + b*d*P.l) + dy;

    return { bry };
}

function bestresponse_rev({ P, S }) {
    const m = P.k + P.kpert;

    const { dy } = shift_pert({ P, m });

    const bry =  m * (S.x - P.x2) + P.y2 + dy;

    return { bry };
}

function step({ P, S, I }) {
    // State updates for x and y
    const x_next = I.x*.3+.5;
    let y_next;

    const Ss = { 
      x: x_next, 
      y: S.y
    };

    if (P.lr > 0) {
        if (!P.rev) {
            // Forward case (gradient)
            const { grady } = gradient({ P, S:Ss });
            y_next = S.y + P.lr * grady;
        } else  {
            // Reverse case (gradient)
            const { grady } = gradient_rev({ P, S:Ss })
            y_next = S.y + P.lr * grady;
        }
    } else if (P.lr == -1) {
        if (!P.rev) {
            // Forward case (best response)
            const { bry } = bestresponse({ P, S:Ss });
            y_next = bry;
        } else {
            // Reverse case (best response)
            const { bry } = bestresponse_rev({ P, S:Ss });
            y_next = bry;
        }
    } else {
      console.log('error')
    }

    const Sp = { 
        t: S.t+1, 
        x: sat(x_next,0,1), 
        y: sat(y_next,0,1)
    }
    const { O } = output({ P, S: Sp});

    return { Sp, O };
}

function output({ P, S }) {
    const { costx, costy } = costs({ P, S })
    const c = (1.05 + costx);//P.cost_offset - costx - P.cost_offset
    const cc = c < 0 ? 0 : c;
    const ccc = Math.sqrt(cc*2);
    const O = { cost: ccc, costx, costy }
    return { O }
}
    

function reset({ P }) {
    const x0 = P.random ? random_uniform(.3,.7) : P.x0;
    let y0 = P.random ? random_uniform(.3,.7) : P.y0;

    const Ss = { t:0, x: x0, y: y0 };
    const { Sp } = step({ P, S:Ss, I: { x: x0 } });
    const S = { t:0, x: x0, y: Sp.y };
    const { O } = output({ P, S })
    const I = { x: 0  };

    return { P, S, I, O };
}

export default { step, reset }

