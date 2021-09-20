import { random_uniform } from "/js/ds/environments/utils.js";

function shift_centers({ P, S }) {
    const sgnx = P.xflip ? -1 : 1;
    const sgny = P.yflip ? -1 : 1;

    const x1 = sgnx * S.x - P.x1 * P.s;
    const y1 = sgny * S.y - P.y1 * P.s;

    const x2 = sgnx * S.x - P.x2 * P.s;
    const y2 = sgny * S.y - P.y2 * P.s;

    return { x1, x2, y1, y2 };
}

function costs({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    const fx = (P.a * x1 * x1) / 2 + P.b * x1 * y1 + (P.h * y1 * y1) / 2;
    const fy = (P.d * y2 * y2) / 2 + P.c * x2 * y2 + (P.e * x2 * x2) / 2;

    const costx = P.sx**2*(fx/P.s**2 - P.cx)
    const costy = P.sy**2*(fy/P.s**2 - P.cy)
    
    return { costx, costy };
}

function shift_pert({ P, mx, my }) {
    const dx = P.xpert * Math.sqrt(mx**2 + 1);
    const dy = P.ypert * Math.sqrt(my**2 + 1);

    return { dx, dy }
} 

function gradients({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    const mx = -(P.b + P.h * P.k)/(P.a + P.b * P.k);
    const my = -(P.c + P.e * P.l)/(P.d + P.c * P.l);
    const { dx, dy } = shift_pert({ P, mx, my });

    const gradx = (P.a + P.b * P.k) * (x1 + dx) + (P.b + P.h * P.k) * y1;
    const grady = (P.d + P.c * P.l) * (y2 + dy) + (P.c + P.e * P.l) * x2;

    return { gradx, grady };
}

function gradients_rev({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    const mx = P.l + P.lpert;
    const my = P.k + P.kpert;
    const { dx, dy } = shift_pert({ P, mx, my });

    const gradx = -mx * y1 + x1 + dx;
    const grady = -my * x2 + y2 + dy;

    return { gradx, grady };
}


function bestresponse({ P, S }) {
    const sgnx = P.xflip ? -1 : 1;
    const sgny = P.yflip ? -1 : 1;

    const mx = -(P.b + P.h * P.k)/(P.a + P.b * P.k);
    const my = -(P.c + P.e * P.l)/(P.d + P.c * P.l);

    const { dx, dy } = shift_pert({ P, mx, my });

    const brx = mx * (sgny * S.y - P.s * P.y1) + P.s * P.x1 + dx;
    const bry = my * (sgnx * S.x - P.s * P.x2) + P.s * P.y2 + dy;

    return { bry };
}

function bestresponse_rev({ P, S }) {
    const sgnx = P.xflip ? -1 : 1;
    const sgny = P.yflip ? -1 : 1;

    const mx = P.l + P.lpert;
    const my = P.k + P.kpert;

    const { dx, dy } = shift_pert({ P, mx, my });

    const brx =  mx * (sgny * S.x - P.s * P.y1) + P.s * P.x1 + dx;
    const bry =  my * (sgnx * S.x - P.s * P.x2) + P.s * P.y2 + dy;

    return { bry };
}

function step({ P, S, I }) {
    // State updates for x and y
    const x_next = I.x;
    let y_next;

    const Ss = { 
      x: x_next, 
      y: S.y
    };

    if (P.lr > 0) {
        if (!P.rev) {
            // Forward case (gradient)
            const { grady } = gradients({ P, S:Ss });
            y_next = S.y - P.lr * grady;
        } else  {
            // Reverse case (gradient)
            const { grady } = gradients_rev({ P, S:Ss })
            y_next = S.y - P.lr * grady;
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
        x: x_next, 
        y: y_next 
    }
    const { O } = output({ P, S: Sp});

    return { Sp, O };
}

function output({ P, S }) {
    const { costx, costy } = costs({ P, S })
    const O = { cost: costx, costy }
    return { O }
}
    

function step_sim({ P, S }) {
    const { costx, costy } = costs({ P, S })
    const { grady, gradx } = gradients({ P, S });

    const x_next = S.x - P.lr_sim * gradx;
    const y_next = S.y - P.lr * grady;

    const Sp = { x: x_next, y: y_next }; 
    const O = { costx, costy };

    return { Sp, O };
}

function reset({ P }) {
    const x0 = P.random ? random_uniform(-.8,.8) : P.x0;
    let y0 = P.random ? random_uniform(-.8,.8) : P.y0;

    const Ss = { t:0, x: x0, y: y0 };
    const I = { x: x0 };
    const { Sp } = step({ P, S:Ss, I });
    const S = { t:0, x: x0, y: Sp.y };
    const { O } = output({ P, S })

    return { P, S, I, O };
}

export default { step, step_sim, reset }
