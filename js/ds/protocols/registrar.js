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
  }
}

export default registrar
