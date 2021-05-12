// Defines inputs and drawing functionality
//
// Interfaces with a HTML5 2d context to draw
// the input, states and outputs of the experiment

import { center_origin } from "/js/ds/experiments/utils.js";
import { draw_dot } from "/js/ds/experiments/drawing.js"

export function start_condition({ P, S, I }) {
    return Math.abs(S.x - I.x) < P.k.tol;
}

export function mount({ canvas, set_I, get_P, set_P }) {
    const ctx = canvas.getContext("2d");
    window.addEventListener('resize', resizeCanvas, false);
    canvas.addEventListener("mousemove", function(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const { I } = input({ P: get_P() })(x);
        set_I(I);
        draw_I({ ctx, P: get_P(), I });
    });

    function resizeCanvas() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;

        let P = get_P()
        P.k = P.k || {w, h};
        P.k.w = w;
        P.k.h = h;
        set_P(P)
    }
    resizeCanvas();
}

export function destroy({ canvas }) {
    canvas.removeEventListener("mousemove")
}
export function draw({ P, S, I, O }) {
    return function(ctx) {
        ctx.fillStyle = "black";
        center_origin(P.k.w, P.k.h)(ctx);
        draw_S({ ctx, P, S });
        draw_O({ ctx, P, O });
        draw_I({ ctx, P, I });
    };
}


function input({ P }) {
    return function(x) {
        return { I: { x: x - P.k.w / 2 } };
    };
}

function draw_I({ ctx, P, I }) {
    draw_dot(ctx, I.x, P.k.h / 3, 2);
}

function draw_S({ ctx, P, S }) {
    ctx.beginPath();
    ctx.lineWidth = .5;
    ctx.moveTo(-P.k.w, P.k.h/3);
    ctx.lineTo(P.k.w, P.k.h/3)
    ctx.stroke();
    draw_dot(ctx, S.x, P.k.h / 3, 5);
}

function draw_O({ ctx, P, O }) {
    ctx.beginPath();
    ctx.lineWidth = 10;
    ctx.moveTo(0, P.k.h/3);
    ctx.lineTo(0, -((O.cost) * P.k.h)/10 + P.k.h/3, 0);
    ctx.stroke();
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    // ctx.fillText(O.cost.toFixed(2), 0, -P.k.h/6);
}


export default { mount, destroy, start_condition, draw }
