const registrar = {
  'text': {
    env: 'Screen',
    preset: { },
    params: {
      msg: "Hello",
      button: "World",
    },
    duration: 3,
  },
  'quadgame-0': {
    env: 'quadgame',
    preset: {
      a:1.8000, b:-1.1000, c:-0.7000, d:0.7000, e:1.3311, h:1.4000,
      k:0, l: 0, x1:0.6794, y1:1.7481, x2:0.5941, y2:0.5941, lr:0.3, 
      s:.5, x0: 0.5, y0: 0.5, tol:0.03 
    },
    params: {
      lr: 0.5, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 1,
    standby_wait: 5,
  },
  'quadgame-1': {
    env: 'quadgame',
    preset: {
    a: 1.8000, b: -0.5595, h: 0.3976, 
    d: 0.7000, c: -0.7000, e: 3.4696, 
    x1: 1.9967, y1: 8.6417, 
    x2: 0.2896, y2: 0.2896,
    s: .2, 
    sx: .2**2, cx: 0, 
    sy: .2**2, cy: 0,
    tol: 0.03, 
    lr: 0.1, 
    x0: 0, y0: 0, 
    random: 1, 
    rev: 0, 
    k:0, l:0, 
    xpert: 0, ypert: 0, 
    kpert: 0, lpert: 0
    },
    params: {
      lr: 0.1, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 1,
    standby_wait: 5
  },
  'quadgame-2': {
    env: 'quadgame',
    preset: {
    a: 1, b: -1/3, h: 7/15,
    d: 1, c: -1, e: 2,
    x1: 0.1, y1: 0.7,
    x2: 0, y2: 0,
    s: 1, sx:1, sy:1, cx:0, cy:0,
    x0: 0.5, y0: 0.5, tol:0.03,
    random: 1, rev: 0,
    xpert: 0, ypert: 0, 
    kpert: 0, lpert: 0,
    k: 0, l: 0, lr: 0.1, 
    ynash: -0.2
    },
    params: {
      lr: 0.1, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 1,
    standby_wait: 5
  },
  "graddescent-0": {
    env: 'graddescent',
    preset: {
      A: 2, tol:0.03
    },
    freq: 60,
    duration: 5,
    ready_wait: 1,
    standby_wait: 5
  },
  'reftrack-0': {
    env: 'reftrack',
    freq: 40,
    preset: {
      dt:0.1, c: 100, d: 0.01, 
      ramp: 400, scale: 400, shift: 100,
      amp: 400
    },
    duration: 40,
    ready_wait: 2,
    standby_wait: 5
  },
  'cobbgame-1': {
    env: 'cobbgame',
    preset: {
      a1: 0.3, b1: 0.6, d1: 9/8,
      a2: 0.4, b2: 0.8, d2: 1,
      x2: 0.7, y2: 0.7,
      tol:0.03,
      random: 1, rev: 0,
      xpert: 0, ypert: 0, 
      kpert: 0, lpert: 0,
      k: 0, l: 0, 
      lr: 0.1, 
    },
    params: {
      lr: 0.1, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 1,
    standby_wait: 5
  },
  // ---------------------------------------------------------------- n x m
  // Quadratic n x m games (js/ds/environments/nxmgame.js). Matrices were
  // produced by nxm_math.designGame (seeds noted) with all four equilibria
  // pairwise separated by > 0.35 inside [-0.75, 0.75]^n and the game operator
  // strongly monotone (gradient play stable at any rate). The 2D-pointer ->
  // R^n input mapping is chosen by params.map: 'direct'|'pairs'|'velocity'|
  // 'spokes' (see js/ds/experiments/nxm_mappings.js).
  'nxmgame-2x2': {
    env: 'nxmgame',
    preset: {
      n: 2, m: 2, seed: 3,
      A: [[1.1006,-0.1102],[-0.1102,0.7794]],
      B: [[0.1875,-0.096],[-0.752,0.4376]],
      H: [[0.9988,-0.4289],[-0.4289,0.4874]],
      D: [[0.7384,0.0829],[0.0829,0.7684]],
      C: [[0.8511,-0.0328],[0.4907,-0.0567]],
      E: [[1.6172,-0.0535],[-0.0535,0.5343]],
      x1: [0.3383,-0.0075], y1: [-0.6952,-0.1392],
      x2: [-0.0284,-0.7236], y2: [0.7074,0.559],
      sx: 1, cx: 0, tol: 0.08, lr: 0.1, random: 1,
      map: 'direct',
    },
    params: { lr: 0.1 },
    freq: 60, duration: 40, ready_wait: 1, standby_wait: 5,
  },
  'nxmgame-3x2': {
    env: 'nxmgame',
    preset: {
      n: 3, m: 2, seed: 4,
      A: [[1.3314,-0.0464,-0.1632],[-0.0464,1.5471,0.2498],[-0.1632,0.2498,1.1335]],
      B: [[0.8257,0.867],[-0.786,-0.3197],[-0.0202,-0.7522]],
      H: [[1.2546,0.5855],[0.5855,1.3066]],
      D: [[1.3724,-0.2381],[-0.2381,1.2581]],
      C: [[0.2019,-0.7026,0.2267],[-0.0115,-0.6509,0.2784]],
      E: [[0.6935,-0.1107,0.1198],[-0.1107,1.4268,-0.2955],[0.1198,-0.2955,0.7578]],
      x1: [0.0573,0.3174,0.169], y1: [-0.3478,-0.5293],
      x2: [0.6355,0.0486,0.1749], y2: [-0.4046,-0.2128],
      sx: 1, cx: 0, tol: 0.08, lr: 0.1, random: 1,
      map: 'pairs',
    },
    params: { lr: 0.1 },
    freq: 60, duration: 50, ready_wait: 1, standby_wait: 5,
  },
  'nxmgame-4x2': {
    env: 'nxmgame',
    preset: {
      n: 4, m: 2, seed: 7,
      A: [[1.1085,-0.3212,-0.0102,0.2573],[-0.3212,1.5973,0.1971,-0.1822],[-0.0102,0.1971,1.3791,0.0328],[0.2573,-0.1822,0.0328,1.1707]],
      B: [[-0.1917,0.7636],[-0.7072,-0.8734],[0.357,0.3549],[-0.1729,0.8508]],
      H: [[0.8812,0.2259],[0.2259,1.5562]],
      D: [[1.0191,-0.1671],[-0.1671,0.8886]],
      C: [[0.442,0.7024,-0.1273,-0.5444],[0.5365,-0.2102,0.028,0.026]],
      E: [[1.2851,0.3714,-0.0555,-0.2411],[0.3714,1.1379,-0.0948,-0.401],[-0.0555,-0.0948,0.6275,0.0096],[-0.2411,-0.401,0.0096,0.9447]],
      x1: [0.0398,0.4711,-0.5571,-0.1441], y1: [0.0837,0.6668],
      x2: [-0.5565,0.3189,0.1162,-0.0744], y2: [-0.1141,0.1963],
      sx: 1, cx: 0, tol: 0.08, lr: 0.1, random: 1,
      map: 'pairs',
    },
    params: { lr: 0.1 },
    freq: 60, duration: 60, ready_wait: 1, standby_wait: 5,
  },
  // calibration battery: reaching / tracking with scalar-cost-only feedback
  'nxmreach-0': {
    env: 'nxmgame',
    preset: {
      n: 4, m: 1, seed: 11, taskmode: 'reach',
      sx: 1, cx: 0, tol: 0.08, lr: 0, random: 0,
      map: 'pairs',
    },
    params: {},
    freq: 60, duration: 20, ready_wait: 1, standby_wait: 5,
  },
  'nxmtrack-0': {
    env: 'nxmgame',
    preset: {
      n: 4, m: 1, seed: 11, taskmode: 'track',
      amps: [0.5, 0.5, 0.5, 0.5], freqs: [0.03, 0.05, 0.08, 0.12],
      sx: 1, cx: 0, tol: 0.08, lr: 0, random: 0,
      map: 'pairs',
    },
    params: {},
    freq: 60, duration: 40, ready_wait: 1, standby_wait: 5,
  },
  'cobbgame-2': {
    env: 'cobbgame',
    preset: {
      a1: 0.175, b1: 0.5, d1: 1.1, 
      a2: 0.2, b2: 0.5, d2: 1.1,
      x2: 0.5, y2: 0.5,
      ynash: 0.5196,
      tol:0.03,
      random: 1, rev: 0,
      xpert: 0, ypert: 0, 
      kpert: 0, lpert: 0,
      k: 0, l: 0, 
      lr: -1, 
    },
    params: {
      lr: 0.1, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 1,
    standby_wait: 5
  },
}

export default registrar
