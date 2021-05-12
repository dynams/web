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
      x1:0.6794, y1:1.7481, x2:0.5941, y2:0.5941, lr:0.3, 
      s:.5, x0: 0.5, y0: 0.5, tol:0.03 
    },
    params: {
      lr: 0.5, xflip: 0
    },
    freq: 60,
    duration: 30,
    ready_wait: 2
  },
  "graddescent-0": {
    env: 'graddescent',
    preset: {
      A: 2, tol:0.03
    },
    freq: 60,
    duration: 1,
    ready_wait: 1
  }
}

export default registrar
