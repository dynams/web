// Simulates
// \minimize_x f_x(x,y),
// \minimize_y f_y(x,y)
// by
// x(t+1) = x(t) - lr*g_x(x,y)
// y(t+1) = x(t) - lr*g_y(x,y)
import { random_uniform } from "/js/ds/environments/utils.js";

function shift_centers({ P, S }) {
    let x = S.x;
    let y = S.y;
    if (P.xflip) {
        x = -x;
    }
    if (P.yflip) {
        y = -y;
    }

    let x1 = x - P.x1 * P.s;
    let y1 = y - P.y1 * P.s;
    let x2 = x - P.x2 * P.s;
    let y2 = y - P.y2 * P.s;

    return { x1, x2, y1, y2 };
}

function costs({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    let costx = (P.a * x1 * x1) / 2 + P.b * x1 * y1 + (P.h * y1 * y1) / 2;
    let costy = (P.d * y2 * y2) / 2 + P.c * x2 * y2 + (P.e * x2 * x2) / 2;
      
    costx /= P.s**2;
    costy /= P.s**2;

    return { costx, costy };
}


function gradients({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    const gradx = P.a * x1 + P.b * y1;
    const grady = P.c * x2 + P.d * y2 + P.l*(P.c * y2 + P.e * x2)
    const gradstackx = gradx - (P.c / P.d)* (P.b * x1 + P.h * y1);

    return { gradx, grady, gradstackx };
}

function bestresponse({ P, S }) {
    const brx = 0;
    const bry = -(P.c + P.e * P.l)/(P.d + P.c * P.l)*(S.x - P.s * P.x2) + P.s * P.y2;
    return { brx, bry };
}

function bestresponse_rev({ P, S }) {
    const brx = 0;
    const bry = (P.k + P.kpert) * (S.x - P.s * P.x2) + P.s * P.y2;
    return { brx, bry };
}

function gradients_rev({ P, S }) {
    const { x1, x2, y1, y2 } = shift_centers({ P, S });

    const gradx = P.a * x1 + P.b * y1;
    const grady = -(P.k + P.kpert) * x2 + y2;

    return { gradx, grady };
}

function step({ P, S, I }) {
    let g2;
    let y_next;

    const Ss = { 
      x: S.x, 
      y: S.y + P.ypert 
    };


    // State updates for x and y
    const x_next = I.x;
    if (P.lr > 0 && !P.rev ) {
      // Forward case (gradient)
      const { grady } = gradients({ P, S:Ss });
      y_next = S.y - P.lr * grady;
    } else if (P.lr > 0 && P.rev ) {
      // Reverse case (gradient)
      const { grady } = gradients_rev({ P, S:Ss })
      y_next = S.y - P.lr * grady;
    } else if (P.lr == -1 && !P.rev) {
      // Forward case (best response)
      const { bry } = bestresponse({ P, S:Ss });
      y_next = bry;
    } else if (P.lr == -1 && P.rev) {
      // Reverse case (best response)
      const { bry } = bestresponse_rev({ P, S:Ss });
      y_next = bry;
    }


    const { costx, costy } = costs({ P, S })
    const Sp = { t: S.t+1, x: x_next, y: y_next}
    const O = { cost: costx, costy }

    return { Sp, O };
}

function step_sim({ P, S }) {
    const { costx, costy } = costs({ P, S })
    const { grady, gradx, gradstackx, gradstacky } = gradients({ P, S });
    const gradnaivex = gradx;
    const gradnaivey = grady; 

    const gx = P.playstackx ? grad_stack_x : gradnaivex;
    const gy = P.playstacky ? grad_stack_y : gradnaivey;
    const x_next = S.x - P.lr_sim * gx;
    const y_next = S.y - P.lr * gy;

    const Sp = { x: x_next, y: y_next }; 
    const O = { costx, costy };
    return { Sp, O };
}

function reset({ P }) {
    const x0 = !P.random? P.x0 : random_uniform(-.8,.8)
    const y0 = !P.random? P.y0 : random_uniform(-.8,.8)
    const S = { t:0, x: x0, y: y0 };
    const I = { x: 0 };
    const { O } = step({ P, S, I });

    return { P, S, I, O };
}

export default { step, step_sim, reset }
