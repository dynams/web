/**
 * Object to control the game being played by the user; games differentiate based on their
 * inputs and outputs.
 *
 * @param {Array} trialSet - Array of objects, with each object containing parameters
 *                           you want the game to load through
 * @return {Object} GameController - Object to control the game state, meant to be
 *                                   called by a TrialController
 */
export function QuadraticGame({ trialSet }) {
  if (!trialSet || trialSet.length == 0) {
    return {
      error: "No supplied trials",
    };
  }

  let trialNumber = 1;
  let parameterSet = {
    P: {
      ...DEFAULT_GAME_PARAMETERS.P,
      ...trialSet[0],
    },
    ...DEFAULT_GAME_PARAMETERS,
  };
  console.log(parameterSet)

  return {
    updateGame: update,
    drawGame: draw,
    inputGame: inputs,
    resetGame: reset,
    switch_trial,
    data: parameterSet,
  };

  function update() {
    let { S, I, O, P } = parameterSet;
    var xx1 = S.x - P.x1 * P.scale;
    var yy1 = S.y - P.y1 * P.scale;
    var xx2 = S.x - P.x2 * P.scale;
    var yy2 = S.y - P.y2 * P.scale;
    
    if( parameterSet.P.flipx ) {
      xx1 = -xx1;
      xx2 = -xx2;
    }

    if( parameterSet.P.f )

    O.costx = (P.a * xx1 * xx1) / 2 + P.b * xx1 * yy1 + (P.h * yy1 * yy1) / 2;
    O.costy = (P.d * yy2 * yy2) / 2 + P.c * xx2 * yy2 + (P.e * xx2 * xx2) / 2;
    O.costx /= P.scale ** 2;
    O.costy /= P.scale ** 2;

    O.gradx = P.a * xx1 + P.b * yy1;
    O.grady = P.c * xx2 + P.d * yy2;
    O.gradstackx = O.gradx - (P.c * (P.b * xx1 + P.h * yy1)) / P.d;
    O.gradstacky = O.grady - (P.b * (P.c * yy2 + P.e * xx2)) / P.a;
    const grady = P.playstacky ? O.gradstacky : O.grady;
    const gradx = P.playstackx ? O.gradstackx : O.gradx;
    switch (P.mode) {
      case "simgrad":
        S.x = S.x - P.alpha * gradx;
        S.y = S.y - P.beta * grady;
        break;
      case "mouse":
        S.x = I.posX;
        S.y = S.y - P.beta * grady;
        break;
      case "both":
        S.x = I.posX;
        S.y = I.posY;
        break;
    }
  }

  function draw(canvas, H, game_info) {
    let { S, I, O, P } = parameterSet;
    let ctx = canvas.getContext("2d");
    let w = canvas.width;
    let h = canvas.height;

    recompute(P);

    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.lineWidth = 3;

    ctx.strokeRect(-w / 2, -h / 2, w, h);

    /*
        Draw cost topologies for both players
        */
    ctx.strokeStyle = P.colorx;
    let r1 = (P.a + P.h) / 2 + Math.sqrt((P.a - P.h) ** 2 / 4 + P.b * P.b);
    let r2 = (P.a + P.h) / 2 - Math.sqrt((P.a - P.h) ** 2 / 4 + P.b * P.b);
    let t = Math.atan2(r1 - P.a, P.b);
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        P.x1 * P.scale,
        P.y1 * P.scale,
        Math.sqrt(r2) * i * P.scale * P.lvlset,
        Math.sqrt(r1) * i * P.scale * P.lvlset,
        t,
        0,
        2 * Math.PI
      );
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(P.x1 * P.scale, P.y1 * P.scale, 1, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = P.colory;
    r1 = (P.d + P.e) / 2 + Math.sqrt((P.e - P.d) ** 2 / 4 + P.c * P.c);
    r2 = (P.d + P.e) / 2 - Math.sqrt((P.e - P.d) ** 2 / 4 + P.c * P.c);
    t = Math.atan2(r1 - P.e, P.c);
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(
        P.x2 * P.scale,
        P.y2 * P.scale,
        Math.sqrt(r2) * i * P.scale * P.lvlset,
        Math.sqrt(r1) * i * P.scale * P.lvlset,
        t,
        0,
        2 * Math.PI
      );

      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(P.x2 * P.scale, P.y2 * P.scale, 1, 0, 2 * Math.PI);
    ctx.fill();

    ctx.lineWidth = 20;

    let x, y;
    if (P.mode == "both") {
      x = I.posX;
      y = I.posY;
    } else if (P.mode == "mouse") {
      x = I.posX;
      y = S.y;
    } else if (P.mode == "simgrad") {
      x = S.x;
      y = S.y;
    }

    ctx.lineWidth = 20;
    ctx.strokeStyle = P.colorx;
    ctx.beginPath();
    ctx.moveTo(x - 5, -h / 2);
    ctx.lineTo(x + 5, -h / 2);
    ctx.stroke();

    ctx.strokeStyle = P.colory;
    ctx.beginPath();
    ctx.moveTo(w / 2, y - 5);
    ctx.lineTo(w / 2, y + 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(S.x, S.y, 8, 0, 2 * Math.PI);
    ctx.fill();

    //This should be moved to ExperimentController
    if (!game_info.hasStarted) {
      //draw circle for desired start
      ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(S.x, S.y, 8, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.lineWidth = 2;
    if (P.history && H.S.x.length >= 1) {
      ctx.strokeStyle = "white";
      ctx.beginPath();
      ctx.moveTo(H.S.x[0], H.S.y[0]);
      for (var i = 0; i < H.S.x.length; i += 2) {
        ctx.lineTo(H.S.x[i], H.S.y[i]);
      }
      ctx.stroke();
    }

    if (P.showinfo) {
      ctx.fillStyle = "navajowhite";
      ctx.beginPath();
      ctx.arc(P.xnash * P.scale, P.ynash * P.scale, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "salmon";
      ctx.beginPath();
      ctx.arc(P.xstack1 * P.scale, P.ystack1 * P.scale, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(P.xstack2 * P.scale, P.ystack2 * P.scale, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(P.xconj * P.scale, P.yconj * P.scale, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function inputs(canvas, x, y) {
    let { S, I, O, P } = parameterSet;

    if (P.inputmode == "lock") {
      I.movX = I.movX + x;
      I.movY = I.movY - y;
      //}
      //if (P.inputmode == 'absolute') {
      //  I.posX = x - canvas.width/2
      //  I.posY = canvas.height -y
      //}
      I.posX = I.movX;
      I.posY = I.movY;
    } else {
      I.posX = x - canvas.width / 2;
      I.posY = canvas.height / 2 - y;
    }

    if (P.mode == "lqr") I.posX = x;
  }

  function reset() {
    let { S, I, O, P } = parameterSet;
    S.x = -100;
    S.y = 100;

    recompute(P);
  }

  function switch_trial({ trialIndex }) {
    let { P } = parameterSet;
    if (trialIndex == trialSet.length + 1 || trialIndex < 1) {
      return {
        error: "Trial out of bounds",
      };
    }

    // runTest()

    P = {
      ...P,
      ...trialSet[trialIndex],
    };

    parameterSet = {
      P,
      ...parameterSet,
    };
  }

  function recompute() {
    const { P } = parameterSet;

    const xn = P.xnash;
    const yn = P.ynash;
    const xs1 = P.xstack1;
    const ys1 = P.ystack1;
    const xs2 = P.xstack2;
    const ys2 = P.ystack2;
    const xc = P.xconj;
    const yc = P.yconj;
    const a = P.a;
    const c = P.d;
    const h = P.h;
    const e = P.e;

    P.x1 =
      (xn * xs1 * yc -
        xs1 * xs2 * yc -
        xc * xs2 * yn +
        xs1 * xs2 * yn -
        xc * xn * ys1 +
        xc * xs2 * ys1 +
        xc * xn * ys2 -
        xn * xs1 * ys2) /
      (xn * yc -
        xs2 * yc -
        xc * yn +
        xs1 * yn -
        xn * ys1 +
        xs2 * ys1 +
        xc * ys2 -
        xs1 * ys2);
    P.x2 =
      (xn * xs2 * yc -
        xs1 * xs2 * yc -
        xc * xs1 * yn +
        xs1 * xs2 * yn +
        xc * xn * ys1 -
        xn * xs2 * ys1 -
        xc * xn * ys2 +
        xc * xs1 * ys2) /
      (xn * yc -
        xs1 * yc -
        xc * yn +
        xs2 * yn +
        xc * ys1 -
        xs2 * ys1 -
        xn * ys2 +
        xs1 * ys2);
    P.y1 =
      (xs1 * yc * yn -
        xs2 * yc * yn -
        xc * yn * ys1 +
        xs2 * yn * ys1 +
        xn * yc * ys2 -
        xs1 * yc * ys2 +
        xc * ys1 * ys2 -
        xn * ys1 * ys2) /
      (xn * yc -
        xs2 * yc -
        xc * yn +
        xs1 * yn -
        xn * ys1 +
        xs2 * ys1 +
        xc * ys2 -
        xs1 * ys2);
    P.y2 =
      (-xs1 * yc * yn +
        xs2 * yc * yn +
        xn * yc * ys1 -
        xs2 * yc * ys1 -
        xc * yn * ys2 +
        xs1 * yn * ys2 +
        xc * ys1 * ys2 -
        xn * ys1 * ys2) /
      (xn * yc -
        xs1 * yc -
        xc * yn +
        xs2 * yn +
        xc * ys1 -
        xs2 * ys1 -
        xn * ys2 +
        xs1 * ys2);
    P.b = (-a * xn + a * xs2) / (yn - ys2);
    P.c = (-c * yn + c * ys1) / (xn - xs1);
    P.e =
      (c *
        (xs1 * yc * yn -
          xs2 * yc * yn +
          xc * yn * yn -
          xs2 * yn * yn -
          xn * yc * ys1 +
          xs2 * yc * ys1 -
          xc * yn * ys1 +
          xs2 * yn * ys1 +
          xn * yc * ys2 -
          xs1 * yc * ys2 -
          xc * yn * ys2 -
          xs1 * yn * ys2 +
          2 * xs2 * yn * ys2 +
          xc * ys1 * ys2 +
          xn * ys1 * ys2 -
          2 * xs2 * ys1 * ys2 -
          xn * ys2 * ys2 +
          xs1 * ys2 * ys2)) /
      ((xn - xs1) * (xc - xs2) * (xn - xs2));
    P.h =
      (a *
        (xn * xn * yc -
          xn * xs1 * yc -
          xn * xs2 * yc +
          xs1 * xs2 * yc +
          xc * xs1 * yn -
          xs1 * xs1 * yn -
          xc * xs2 * yn +
          xs1 * xs2 * yn -
          xc * xn * ys1 -
          xn * xn * ys1 +
          2 * xn * xs1 * ys1 +
          xc * xs2 * ys1 +
          xn * xs2 * ys1 -
          2 * xs1 * xs2 * ys1 +
          xc * xn * ys2 -
          xc * xs1 * ys2 -
          xn * xs1 * ys2 +
          xs1 * xs1 * ys2)) /
      ((yc - ys1) * (yn - ys1) * (yn - ys2));
  }
}

//Helper functions
const s = (v) => Math.sin(v);
const c = (v) => Math.cos(v);

//Default parameters for Quadratic Game
export const DEFAULT_GAME_PARAMETERS = {
  P: {
    //parameters
    mode: "mouse",
    inputmode: "absolute", //or absolute
    colorx: "red",
    colory: "#899FEC",
    duration: 100, //seconds
    edit: false,
    period: 20, //ms
    smooth: 0.9,
    playstackx: false,
    playstacky: false,
    alpha: 0.03,
    beta: 0.03,
    xnash: -1,
    ynash: -1,
    xstack1: 1,
    ystack1: 1,
    xstack2: 0.1,
    ystack2: 0.8,
    xconj: 1.3,
    yconj: 0.3,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: -2,
    a: 1.8,
    h: 1,
    b: -0.15,
    c: 0.15,
    d: 0.7,
    e: 3,
    h: 1,
    scale: 40,
    lvlset: 1,
    history: false,
    showinfo: false,
    nash1: null,
    nash2: null,
  },
  I: {
    //inputs
    posX: 0,
    posY: 0,
  },
  O: {
    //outputs
    time: 0,
    costx: 0,
    costy: 0,
    gradx: 0, // d(f_x)/dx
    grady: 0, // d(f_y)/dy
    gradstackx: 0, //d(f_x)/dx
    gradstacky: 0,
  },
  S: {
    //state
    time: 0,
    x: 0,
    y: 0,
  },
};
